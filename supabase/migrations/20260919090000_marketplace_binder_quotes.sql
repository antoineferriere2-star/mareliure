-- Ma Reliure — l'outil devis → facture du relieur.
--
-- Un relieur chiffre un ouvrage pour SES clients (marketplace ou non) :
-- ouvrage → dimensions → prestations → calcul → devis → facture. Ce n'est ni
-- une comptabilité ni un ERP : aucun paiement, aucun stock, aucune plateforme de
-- facturation électronique n'est branchée ici. Les colonnes `external_*` /
-- `electronic_invoice_*` des factures sont seulement les emplacements nullables
-- d'une future connexion à une Plateforme Agréée (fournisseur non figé).
--
-- Isolation : même patron que toutes les tables marketplace_* — RLS activée,
-- `anon` et `authenticated` refusés, accès par les server functions en
-- service-role, qui contrôlent l'atelier (binder_id) à chaque appel. Aucune
-- donnée métier n'est lisible sans passer par elles.
--
-- Les lignes d'un devis et d'une facture sont des SNAPSHOTS (libellé, prix,
-- TVA, identité de l'émetteur) : modifier le catalogue ou le profil plus tard ne
-- change jamais un document existant. Une facture ne se modifie plus (trigger).
--
-- Additive, rejouable : aucune table existante n'est touchée. Rollback en pied
-- de fichier. Ne pas exécuter le rollback si une facture a déjà été émise : ce
-- sont des pièces à conserver.

-- ---------------------------------------------------------------------------
-- 1. Profil de facturation de l'atelier (un par atelier)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_billing_profiles (
  binder_id UUID PRIMARY KEY REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  workshop_name TEXT,
  legal_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'FR',
  siret TEXT,
  vat_number TEXT,
  -- Forme juridique, capital, RCS… : texte libre imprimé sur les documents,
  -- jamais interprété par Ma Reliure.
  legal_notes TEXT,
  email TEXT,
  phone TEXT,
  -- `NULL` tant que l'atelier n'a pas choisi : Ma Reliure ne présume aucun
  -- régime fiscal. FRANCHISE = franchise en base de TVA (aucune TVA facturée).
  vat_regime TEXT,
  -- Taux proposé par défaut aux prestations qui n'en ont pas — une valeur de
  -- départ modifiable, pas une règle.
  default_vat_rate_bps INTEGER NOT NULL DEFAULT 2000,
  -- Mention imprimée en pied de document (ex. la mention de franchise) : texte
  -- de l'atelier, configurable.
  vat_mention TEXT,
  quote_prefix TEXT NOT NULL DEFAULT 'D',
  invoice_prefix TEXT NOT NULL DEFAULT 'F',
  quote_validity_days INTEGER NOT NULL DEFAULT 30,
  payment_terms TEXT,
  quote_notes TEXT,
  invoice_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_binder_billing_profiles
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_vat_regime_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_vat_rate_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_prefix_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_validity_check;
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD CONSTRAINT marketplace_binder_billing_profiles_vat_regime_check
    CHECK (vat_regime IS NULL OR vat_regime IN ('FRANCHISE', 'VAT_LIABLE')),
  ADD CONSTRAINT marketplace_binder_billing_profiles_vat_rate_check
    CHECK (default_vat_rate_bps BETWEEN 0 AND 10000),
  ADD CONSTRAINT marketplace_binder_billing_profiles_prefix_check
    CHECK (quote_prefix ~ '^[A-Za-z0-9]{1,8}$' AND invoice_prefix ~ '^[A-Za-z0-9]{1,8}$'),
  ADD CONSTRAINT marketplace_binder_billing_profiles_validity_check
    CHECK (quote_validity_days BETWEEN 1 AND 365);

-- ---------------------------------------------------------------------------
-- 2. Catalogue de l'atelier — catégories et prestations, à lui seul
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_binder_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  -- SET NULL : supprimer une catégorie ne supprime jamais une prestation.
  category_id UUID REFERENCES public.marketplace_binder_service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Prix HT de référence de l'atelier, en centimes. Jamais imposé par Ma Reliure.
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  -- `NULL` = utiliser le taux par défaut du profil.
  vat_rate_bps INTEGER,
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Archivée : n'apparaît plus dans le constructeur, reste lisible dans les
  -- anciens devis (qui portent leur propre snapshot).
  archived_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_binder_services
  DROP CONSTRAINT IF EXISTS marketplace_binder_services_price_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_services_vat_check;
ALTER TABLE public.marketplace_binder_services
  ADD CONSTRAINT marketplace_binder_services_price_check CHECK (unit_price_cents >= 0),
  ADD CONSTRAINT marketplace_binder_services_vat_check
    CHECK (vat_rate_bps IS NULL OR vat_rate_bps BETWEEN 0 AND 10000);

CREATE INDEX IF NOT EXISTS marketplace_binder_service_categories_binder_idx
  ON public.marketplace_binder_service_categories(binder_id, sort_order);
CREATE INDEX IF NOT EXISTS marketplace_binder_services_binder_idx
  ON public.marketplace_binder_services(binder_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. Clients de l'atelier (les siens — ce ne sont pas des comptes Ma Reliure)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_binder_clients_binder_idx
  ON public.marketplace_binder_clients(binder_id, name);

-- ---------------------------------------------------------------------------
-- 4. Numérotation — une séquence par atelier, par type de document, par année
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_document_counters (
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (binder_id, kind, year),
  CONSTRAINT marketplace_binder_document_counters_kind_check CHECK (kind IN ('quote', 'invoice'))
);

-- Le numéro suivant, atomique : l'UPSERT verrouille la ligne du compteur
-- jusqu'à la fin de la transaction appelante, donc deux appels simultanés ne
-- reçoivent jamais le même numéro. Appelée dans la MÊME transaction que
-- l'insertion du document (voir plus bas) : si l'insertion échoue, le compteur
-- est annulé avec elle — pas de trou dans la séquence des factures.
CREATE OR REPLACE FUNCTION public.marketplace_binder_next_document_number(
  p_binder_id UUID,
  p_kind TEXT,
  p_year INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO public.marketplace_binder_document_counters AS c (binder_id, kind, year, last_value)
  VALUES (p_binder_id, p_kind, p_year, 1)
  ON CONFLICT (binder_id, kind, year) DO UPDATE SET last_value = c.last_value + 1
  RETURNING c.last_value INTO v_seq;

  IF p_kind = 'quote' THEN
    SELECT quote_prefix INTO v_prefix FROM public.marketplace_binder_billing_profiles WHERE binder_id = p_binder_id;
    v_prefix := COALESCE(v_prefix, 'D');
  ELSE
    SELECT invoice_prefix INTO v_prefix FROM public.marketplace_binder_billing_profiles WHERE binder_id = p_binder_id;
    v_prefix := COALESCE(v_prefix, 'F');
  END IF;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Devis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  -- SET NULL : supprimer une fiche client ne réécrit pas un devis (qui porte
  -- son propre snapshot du client).
  client_id UUID REFERENCES public.marketplace_binder_clients(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  -- Snapshot du client
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address_line1 TEXT,
  client_postal_code TEXT,
  client_city TEXT,
  client_country TEXT,
  -- Snapshot de l'ouvrage (pas de table `books` dans cette première version)
  book_title TEXT,
  book_author TEXT,
  height_mm INTEGER,
  width_mm INTEGER,
  spine_mm INTEGER,
  book_notes TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  -- Snapshot de l'émetteur et du régime au moment de l'émission
  issuer JSONB NOT NULL DEFAULT '{}'::jsonb,
  vat_regime TEXT NOT NULL,
  vat_mention TEXT,
  payment_terms TEXT,
  notes TEXT,
  -- Montants, en centimes — recalculés côté serveur, jamais reçus du navigateur
  subtotal_cents INTEGER NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'NONE',
  discount_value INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_ht_cents INTEGER NOT NULL,
  total_vat_cents INTEGER NOT NULL,
  total_ttc_cents INTEGER NOT NULL,
  vat_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  deposit_type TEXT NOT NULL DEFAULT 'NONE',
  deposit_value INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (binder_id, quote_number)
);

ALTER TABLE public.marketplace_binder_quotes
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_vat_regime_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_discount_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_deposit_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_dimensions_check;
ALTER TABLE public.marketplace_binder_quotes
  ADD CONSTRAINT marketplace_binder_quotes_status_check
    CHECK (status IN ('draft', 'sent', 'accepted', 'refused', 'expired', 'invoiced')),
  ADD CONSTRAINT marketplace_binder_quotes_vat_regime_check
    CHECK (vat_regime IN ('FRANCHISE', 'VAT_LIABLE')),
  ADD CONSTRAINT marketplace_binder_quotes_discount_check
    CHECK (discount_type IN ('NONE', 'PERCENT', 'AMOUNT') AND discount_value >= 0 AND discount_cents >= 0),
  ADD CONSTRAINT marketplace_binder_quotes_deposit_check
    CHECK (deposit_type IN ('NONE', 'PERCENT', 'AMOUNT') AND deposit_value >= 0 AND deposit_cents >= 0),
  ADD CONSTRAINT marketplace_binder_quotes_amounts_check
    CHECK (subtotal_cents >= 0 AND total_ht_cents >= 0 AND total_vat_cents >= 0
           AND total_ttc_cents = total_ht_cents + total_vat_cents
           AND deposit_cents <= total_ttc_cents),
  ADD CONSTRAINT marketplace_binder_quotes_dimensions_check
    CHECK ((height_mm IS NULL OR height_mm > 0) AND (width_mm IS NULL OR width_mm > 0)
           AND (spine_mm IS NULL OR spine_mm > 0));

CREATE INDEX IF NOT EXISTS marketplace_binder_quotes_binder_idx
  ON public.marketplace_binder_quotes(binder_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_binder_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.marketplace_binder_quotes(id) ON DELETE CASCADE,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  -- SET NULL : une prestation supprimée du catalogue ne casse pas un ancien devis.
  service_id UUID REFERENCES public.marketplace_binder_services(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  -- Le prix du catalogue au moment où la ligne a été ajoutée : permet d'afficher
  -- « prix modifié pour ce devis » sans jamais toucher le catalogue.
  catalog_price_cents INTEGER,
  vat_rate_bps INTEGER NOT NULL,
  total_ht_cents INTEGER NOT NULL
);

ALTER TABLE public.marketplace_binder_quote_items
  DROP CONSTRAINT IF EXISTS marketplace_binder_quote_items_values_check;
ALTER TABLE public.marketplace_binder_quote_items
  ADD CONSTRAINT marketplace_binder_quote_items_values_check
    CHECK (quantity > 0 AND unit_price_cents >= 0 AND total_ht_cents >= 0
           AND vat_rate_bps BETWEEN 0 AND 10000);
CREATE INDEX IF NOT EXISTS marketplace_binder_quote_items_quote_idx
  ON public.marketplace_binder_quote_items(quote_id, position);

-- ---------------------------------------------------------------------------
-- 6. Factures — copie d'un devis accepté, puis figée
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  -- Un devis ne donne qu'une facture ; on ne supprime pas un devis facturé.
  quote_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_binder_quotes(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES public.marketplace_binder_clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address_line1 TEXT,
  client_postal_code TEXT,
  client_city TEXT,
  client_country TEXT,
  book_title TEXT,
  book_author TEXT,
  height_mm INTEGER,
  width_mm INTEGER,
  spine_mm INTEGER,
  book_notes TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  issuer JSONB NOT NULL DEFAULT '{}'::jsonb,
  vat_regime TEXT NOT NULL,
  vat_mention TEXT,
  payment_terms TEXT,
  notes TEXT,
  subtotal_cents INTEGER NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'NONE',
  discount_value INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_ht_cents INTEGER NOT NULL,
  total_vat_cents INTEGER NOT NULL,
  total_ttc_cents INTEGER NOT NULL,
  vat_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Acompte : demandé (issu du devis), payé, solde, payé intégralement. Aucun
  -- paiement n'est encaissé par Ma Reliure ici : ces colonnes préparent le
  -- modèle, elles ne déclenchent rien.
  deposit_type TEXT NOT NULL DEFAULT 'NONE',
  deposit_value INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  deposit_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  -- Emplacements NULLABLES d'une future connexion à une Plateforme Agréée
  -- (fournisseur non figé : aucune valeur n'est interprétée par Ma Reliure).
  external_provider TEXT,
  external_invoice_id TEXT,
  external_status TEXT,
  electronic_invoice_status TEXT,
  electronic_invoice_sent_at TIMESTAMPTZ,
  external_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (binder_id, invoice_number)
);

ALTER TABLE public.marketplace_binder_invoices
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_payment_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_amounts_check;
ALTER TABLE public.marketplace_binder_invoices
  ADD CONSTRAINT marketplace_binder_invoices_payment_status_check
    CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid')),
  ADD CONSTRAINT marketplace_binder_invoices_amounts_check
    CHECK (total_ttc_cents = total_ht_cents + total_vat_cents
           AND deposit_cents <= total_ttc_cents
           AND deposit_paid_cents >= 0 AND amount_paid_cents >= 0);

CREATE INDEX IF NOT EXISTS marketplace_binder_invoices_binder_idx
  ON public.marketplace_binder_invoices(binder_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_binder_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.marketplace_binder_invoices(id) ON DELETE RESTRICT,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  service_id UUID REFERENCES public.marketplace_binder_services(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  vat_rate_bps INTEGER NOT NULL,
  total_ht_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS marketplace_binder_invoice_items_invoice_idx
  ON public.marketplace_binder_invoice_items(invoice_id, position);

-- Une facture émise ne se modifie plus. Seuls restent modifiables : le suivi de
-- paiement et les emplacements d'une plateforme externe — jamais le contenu
-- (client, ouvrage, lignes, montants, numéro, émetteur). Même patron que
-- marketplace_commercial_proposals_forbid_change_after_acceptance.
CREATE OR REPLACE FUNCTION public.marketplace_binder_invoices_forbid_content_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mutable TEXT[] := ARRAY[
    'updated_at', 'deposit_paid_cents', 'amount_paid_cents', 'payment_status', 'paid_at',
    'external_provider', 'external_invoice_id', 'external_status',
    'electronic_invoice_status', 'electronic_invoice_sent_at', 'external_metadata'
  ];
BEGIN
  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'marketplace_binder_invoices content is immutable once issued (invoice %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_binder_invoices_immutable ON public.marketplace_binder_invoices;
CREATE TRIGGER marketplace_binder_invoices_immutable
  BEFORE UPDATE ON public.marketplace_binder_invoices
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_invoices_forbid_content_change();

CREATE OR REPLACE FUNCTION public.marketplace_binder_invoice_items_forbid_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'marketplace_binder_invoice_items is immutable (item %)', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_binder_invoice_items_immutable ON public.marketplace_binder_invoice_items;
CREATE TRIGGER marketplace_binder_invoice_items_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_binder_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_invoice_items_forbid_change();

-- ---------------------------------------------------------------------------
-- 7. Écritures transactionnelles
-- ---------------------------------------------------------------------------
-- Les montants, les lignes et l'émetteur sont calculés par le serveur (module
-- TypeScript testé) et transmis ici en JSON ; ces fonctions ne calculent rien :
-- elles attribuent le numéro et écrivent le document ET ses lignes dans une
-- seule transaction.

CREATE OR REPLACE FUNCTION public.marketplace_binder_create_quote(
  p_binder_id UUID,
  p_quote JSONB,
  p_items JSONB
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_number TEXT;
BEGIN
  v_number := public.marketplace_binder_next_document_number(
    p_binder_id, 'quote', EXTRACT(YEAR FROM (p_quote->>'issue_date')::DATE)::INTEGER
  );

  INSERT INTO public.marketplace_binder_quotes
  SELECT r.*
  FROM jsonb_populate_record(
    NULL::public.marketplace_binder_quotes,
    p_quote || jsonb_build_object(
      'id', v_id, 'binder_id', p_binder_id, 'quote_number', v_number, 'status', 'draft',
      'created_at', now(), 'updated_at', now()
    )
  ) AS r;

  INSERT INTO public.marketplace_binder_quote_items
  SELECT r.*
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord),
       LATERAL jsonb_populate_record(
         NULL::public.marketplace_binder_quote_items,
         e.item || jsonb_build_object(
           'id', gen_random_uuid(), 'quote_id', v_id, 'binder_id', p_binder_id, 'position', e.ord
         )
       ) AS r;

  RETURN v_id;
END;
$$;

-- Un devis ne se modifie qu'à l'état brouillon. Le numéro, le statut et la
-- date d'émission ne changent pas.
CREATE OR REPLACE FUNCTION public.marketplace_binder_update_quote(
  p_binder_id UUID,
  p_quote_id UUID,
  p_quote JSONB,
  p_items JSONB
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'quote_not_editable'; END IF;

  UPDATE public.marketplace_binder_quotes q SET
    client_id = r.client_id, valid_until = r.valid_until,
    client_name = r.client_name, client_email = r.client_email, client_phone = r.client_phone,
    client_address_line1 = r.client_address_line1, client_postal_code = r.client_postal_code,
    client_city = r.client_city, client_country = r.client_country,
    book_title = r.book_title, book_author = r.book_author,
    height_mm = r.height_mm, width_mm = r.width_mm, spine_mm = r.spine_mm, book_notes = r.book_notes,
    issuer = r.issuer, vat_regime = r.vat_regime, vat_mention = r.vat_mention,
    payment_terms = r.payment_terms, notes = r.notes,
    subtotal_cents = r.subtotal_cents, discount_type = r.discount_type,
    discount_value = r.discount_value, discount_cents = r.discount_cents,
    total_ht_cents = r.total_ht_cents, total_vat_cents = r.total_vat_cents,
    total_ttc_cents = r.total_ttc_cents, vat_breakdown = r.vat_breakdown,
    deposit_type = r.deposit_type, deposit_value = r.deposit_value, deposit_cents = r.deposit_cents
  FROM jsonb_populate_record(NULL::public.marketplace_binder_quotes, p_quote) AS r
  WHERE q.id = p_quote_id AND q.binder_id = p_binder_id;

  DELETE FROM public.marketplace_binder_quote_items
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id;

  INSERT INTO public.marketplace_binder_quote_items
  SELECT r.*
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord),
       LATERAL jsonb_populate_record(
         NULL::public.marketplace_binder_quote_items,
         e.item || jsonb_build_object(
           'id', gen_random_uuid(), 'quote_id', p_quote_id, 'binder_id', p_binder_id, 'position', e.ord
         )
       ) AS r;

  RETURN p_quote_id;
END;
$$;

-- Devis accepté → facture, sans ressaisie, en UNE transaction : le numéro de
-- facture n'est consommé que si la facture ET ses lignes sont écrites (pas de
-- trou), et un devis ne peut être facturé qu'une fois (verrou + UNIQUE).
CREATE OR REPLACE FUNCTION public.marketplace_binder_convert_quote_to_invoice(
  p_binder_id UUID,
  p_quote_id UUID,
  p_issue_date DATE,
  p_invoice_notes TEXT,
  -- L'identité de l'émetteur À LA DATE DE LA FACTURE (celle du profil courant,
  -- contrôlée par le serveur) ; `NULL` : reprendre celle du devis.
  p_issuer JSONB
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_quote public.marketplace_binder_quotes%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_number TEXT;
BEGIN
  SELECT * INTO v_quote
  FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_quote.status = 'invoiced' THEN RAISE EXCEPTION 'quote_already_invoiced'; END IF;
  IF v_quote.status <> 'accepted' THEN RAISE EXCEPTION 'quote_not_accepted'; END IF;

  v_number := public.marketplace_binder_next_document_number(
    p_binder_id, 'invoice', EXTRACT(YEAR FROM p_issue_date)::INTEGER
  );

  INSERT INTO public.marketplace_binder_invoices (
    id, binder_id, quote_id, client_id, invoice_number, issue_date,
    client_name, client_email, client_phone, client_address_line1,
    client_postal_code, client_city, client_country,
    book_title, book_author, height_mm, width_mm, spine_mm, book_notes,
    currency, issuer, vat_regime, vat_mention, payment_terms, notes,
    subtotal_cents, discount_type, discount_value, discount_cents,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown,
    deposit_type, deposit_value, deposit_cents
  ) VALUES (
    v_id, p_binder_id, p_quote_id, v_quote.client_id, v_number, p_issue_date,
    v_quote.client_name, v_quote.client_email, v_quote.client_phone, v_quote.client_address_line1,
    v_quote.client_postal_code, v_quote.client_city, v_quote.client_country,
    v_quote.book_title, v_quote.book_author, v_quote.height_mm, v_quote.width_mm, v_quote.spine_mm,
    v_quote.book_notes,
    v_quote.currency, COALESCE(p_issuer, v_quote.issuer), v_quote.vat_regime, v_quote.vat_mention, v_quote.payment_terms,
    p_invoice_notes,
    v_quote.subtotal_cents, v_quote.discount_type, v_quote.discount_value, v_quote.discount_cents,
    v_quote.total_ht_cents, v_quote.total_vat_cents, v_quote.total_ttc_cents, v_quote.vat_breakdown,
    v_quote.deposit_type, v_quote.deposit_value, v_quote.deposit_cents
  );

  INSERT INTO public.marketplace_binder_invoice_items (
    invoice_id, binder_id, position, service_id, label, description, unit,
    quantity, unit_price_cents, vat_rate_bps, total_ht_cents
  )
  SELECT v_id, binder_id, position, service_id, label, description, unit,
         quantity, unit_price_cents, vat_rate_bps, total_ht_cents
  FROM public.marketplace_binder_quote_items
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id
  ORDER BY position;

  UPDATE public.marketplace_binder_quotes SET status = 'invoiced' WHERE id = p_quote_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Isolation : service_role seulement, RLS deny-all, fonctions non exposées
-- ---------------------------------------------------------------------------
GRANT ALL ON public.marketplace_binder_billing_profiles TO service_role;
GRANT ALL ON public.marketplace_binder_service_categories TO service_role;
GRANT ALL ON public.marketplace_binder_services TO service_role;
GRANT ALL ON public.marketplace_binder_clients TO service_role;
GRANT ALL ON public.marketplace_binder_document_counters TO service_role;
GRANT ALL ON public.marketplace_binder_quotes TO service_role;
GRANT ALL ON public.marketplace_binder_quote_items TO service_role;
GRANT ALL ON public.marketplace_binder_invoices TO service_role;
GRANT ALL ON public.marketplace_binder_invoice_items TO service_role;

ALTER TABLE public.marketplace_binder_billing_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_billing_profiles" ON public.marketplace_binder_billing_profiles;
CREATE POLICY "No direct access to marketplace_binder_billing_profiles"
  ON public.marketplace_binder_billing_profiles FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_service_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_service_categories" ON public.marketplace_binder_service_categories;
CREATE POLICY "No direct access to marketplace_binder_service_categories"
  ON public.marketplace_binder_service_categories FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_services" ON public.marketplace_binder_services;
CREATE POLICY "No direct access to marketplace_binder_services"
  ON public.marketplace_binder_services FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_clients" ON public.marketplace_binder_clients;
CREATE POLICY "No direct access to marketplace_binder_clients"
  ON public.marketplace_binder_clients FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_document_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_document_counters" ON public.marketplace_binder_document_counters;
CREATE POLICY "No direct access to marketplace_binder_document_counters"
  ON public.marketplace_binder_document_counters FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_quotes" ON public.marketplace_binder_quotes;
CREATE POLICY "No direct access to marketplace_binder_quotes"
  ON public.marketplace_binder_quotes FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_quote_items" ON public.marketplace_binder_quote_items;
CREATE POLICY "No direct access to marketplace_binder_quote_items"
  ON public.marketplace_binder_quote_items FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_invoices" ON public.marketplace_binder_invoices;
CREATE POLICY "No direct access to marketplace_binder_invoices"
  ON public.marketplace_binder_invoices FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_invoice_items" ON public.marketplace_binder_invoice_items;
CREATE POLICY "No direct access to marketplace_binder_invoice_items"
  ON public.marketplace_binder_invoice_items FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON FUNCTION public.marketplace_binder_next_document_number(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_create_quote(UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_update_quote(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_next_document_number(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_create_quote(UUID, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_update_quote(UUID, UUID, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- 9. updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS marketplace_binder_billing_profiles_touch ON public.marketplace_binder_billing_profiles;
CREATE TRIGGER marketplace_binder_billing_profiles_touch
  BEFORE UPDATE ON public.marketplace_binder_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();
DROP TRIGGER IF EXISTS marketplace_binder_service_categories_touch ON public.marketplace_binder_service_categories;
CREATE TRIGGER marketplace_binder_service_categories_touch
  BEFORE UPDATE ON public.marketplace_binder_service_categories
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();
DROP TRIGGER IF EXISTS marketplace_binder_services_touch ON public.marketplace_binder_services;
CREATE TRIGGER marketplace_binder_services_touch
  BEFORE UPDATE ON public.marketplace_binder_services
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();
DROP TRIGGER IF EXISTS marketplace_binder_clients_touch ON public.marketplace_binder_clients;
CREATE TRIGGER marketplace_binder_clients_touch
  BEFORE UPDATE ON public.marketplace_binder_clients
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();
DROP TRIGGER IF EXISTS marketplace_binder_quotes_touch ON public.marketplace_binder_quotes;
CREATE TRIGGER marketplace_binder_quotes_touch
  BEFORE UPDATE ON public.marketplace_binder_quotes
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();
DROP TRIGGER IF EXISTS marketplace_binder_invoices_touch ON public.marketplace_binder_invoices;
CREATE TRIGGER marketplace_binder_invoices_touch
  BEFORE UPDATE ON public.marketplace_binder_invoices
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rollback (NE PAS exécuter si une facture a déjà été émise : pièces à conserver)
-- ---------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB);
-- DROP FUNCTION IF EXISTS public.marketplace_binder_update_quote(UUID, UUID, JSONB, JSONB);
-- DROP FUNCTION IF EXISTS public.marketplace_binder_create_quote(UUID, JSONB, JSONB);
-- DROP TABLE IF EXISTS public.marketplace_binder_invoice_items;
-- DROP TABLE IF EXISTS public.marketplace_binder_invoices;
-- DROP FUNCTION IF EXISTS public.marketplace_binder_invoice_items_forbid_change();
-- DROP FUNCTION IF EXISTS public.marketplace_binder_invoices_forbid_content_change();
-- DROP TABLE IF EXISTS public.marketplace_binder_quote_items;
-- DROP TABLE IF EXISTS public.marketplace_binder_quotes;
-- DROP FUNCTION IF EXISTS public.marketplace_binder_next_document_number(UUID, TEXT, INTEGER);
-- DROP TABLE IF EXISTS public.marketplace_binder_document_counters;
-- DROP TABLE IF EXISTS public.marketplace_binder_clients;
-- DROP TABLE IF EXISTS public.marketplace_binder_services;
-- DROP TABLE IF EXISTS public.marketplace_binder_service_categories;
-- DROP TABLE IF EXISTS public.marketplace_binder_billing_profiles;
