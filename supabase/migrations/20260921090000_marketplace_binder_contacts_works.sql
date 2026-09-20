-- Ma Reliure — Contacts + Ouvrages (PR 1 de la V1 métier « tout part d'un ouvrage »).
--
-- Deux objets, et le lien qui manquait :
--
--   * CONTACT — `marketplace_binder_clients` évolue, elle n'est pas dupliquée : prénom / nom /
--     entreprise, ORIGINE (`mon_client` | `ma_reliure`), archivage. Aucune colonne existante n'est
--     modifiée ni supprimée.
--   * OUVRAGE — `marketplace_binder_works`, l'objet métier central : à qui il est, ce qu'il est,
--     ses dimensions, son poids, son état, sa source. Il n'existait qu'en copie (snapshot) dans
--     chaque devis et chaque facture ; il devient une fiche vivante.
--   * LIEN — `marketplace_binder_quotes.work_id`, nullable : un devis peut se rattacher à un
--     ouvrage. Les documents émis gardent leurs snapshots (client, ouvrage) : le lien est une
--     référence, jamais une source de vérité. La facture n'est PAS touchée (elle se rattache à
--     l'ouvrage par son devis) : ni sa table, ni son trigger d'immutabilité, ni la fonction de
--     conversion de la Phase 0.
--
-- Pas de photos ici — seulement leur structure (`marketplace_binder_work_photos`, catégories
-- intake / before / reception / during / after) : aucune UX photo, aucun bucket dans cette PR.
--
-- Isolation : même patron que toutes les tables marketplace_* — RLS activée, `anon` et
-- `authenticated` refusés, accès par server functions en service-role qui contrôlent l'atelier.
-- En plus, la BASE refuse qu'un ouvrage pointe le contact d'un autre atelier, ou qu'un devis
-- pointe l'ouvrage d'un autre atelier (deux triggers) : une erreur du serveur ne suffit pas à
-- mélanger deux ateliers.
--
-- Additive et rejouable : aucune table existante n'est réécrite. Rollback en pied de fichier.

-- ---------------------------------------------------------------------------
-- 1. Contact : `marketplace_binder_clients`, étendue
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binder_clients
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS organization TEXT,
  -- D'où vient ce contact. `mon_client` : le relieur l'a créé lui-même. `ma_reliure` : il arrive
  -- d'un projet apporté par la plateforme (PR ultérieure). Une conversion de l'un vers l'autre
  -- n'est jamais implicite : aucune fonction de cette migration ne change une origine.
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'mon_client',
  ADD COLUMN IF NOT EXISTS origin_case_id UUID REFERENCES public.marketplace_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.marketplace_binder_clients
  DROP CONSTRAINT IF EXISTS marketplace_binder_clients_origin_check;
ALTER TABLE public.marketplace_binder_clients
  ADD CONSTRAINT marketplace_binder_clients_origin_check
    CHECK (origin IN ('mon_client', 'ma_reliure') AND (origin_case_id IS NULL OR origin = 'ma_reliure'));

-- Retrouver un contact par son e-mail (détection de doublon à l'écran — jamais une contrainte :
-- deux clients peuvent légitimement partager une adresse).
CREATE INDEX IF NOT EXISTS marketplace_binder_clients_email_idx
  ON public.marketplace_binder_clients(binder_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_binder_clients_active_idx
  ON public.marketplace_binder_clients(binder_id, name) WHERE archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Numérotation des ouvrages — O-AAAA-NNNN, une séquence par atelier et par année
-- ---------------------------------------------------------------------------
-- Séparée de la numérotation des devis et des factures, volontairement : ces dernières
-- sont des pièces comptables sans trou (Phase 0), un ouvrage n'en est pas une.
CREATE TABLE IF NOT EXISTS public.marketplace_binder_work_counters (
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (binder_id, year)
);

CREATE OR REPLACE FUNCTION public.marketplace_binder_next_work_reference(
  p_binder_id UUID,
  p_year INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO public.marketplace_binder_work_counters AS c (binder_id, year, last_value)
  VALUES (p_binder_id, p_year, 1)
  ON CONFLICT (binder_id, year) DO UPDATE SET last_value = c.last_value + 1
  RETURNING c.last_value INTO v_seq;
  RETURN 'O-' || p_year::TEXT || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ouvrage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT : un ouvrage est une mémoire de l'atelier, pas une donnée jetable.
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  -- SET NULL : archiver ou supprimer un contact ne détruit pas l'ouvrage.
  contact_id UUID REFERENCES public.marketplace_binder_clients(id) ON DELETE SET NULL,
  -- Numéro lisible, attribué par le serveur dans la même transaction que l'insertion.
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  edition_note TEXT,
  description TEXT,
  -- Millimètres entiers (la même unité que les devis) ; « épaisseur » = ce que les devis
  -- appellent `spine_mm`.
  height_mm INTEGER,
  width_mm INTEGER,
  thickness_mm INTEGER,
  -- Grammes. Facultatif tant qu'aucune étiquette réelle n'est produite.
  weight_grams INTEGER,
  -- Centimes, facultatif : ce que le propriétaire déclare, pas une expertise.
  declared_value_cents INTEGER,
  condition_notes TEXT,
  internal_notes TEXT,
  -- Cycle de vie de la FICHE seulement. L'état de travail (à examiner, en cours, à facturer…)
  -- appartient à l'intervention, qui arrive dans une PR ultérieure.
  status TEXT NOT NULL DEFAULT 'active',
  -- Acquisition : le relieur crée lui-même l'ouvrage (`mon_client`) ou il vient d'un projet Ma
  -- Reliure (`ma_reliure`, avec `case_id`). Financièrement distincts, à ne jamais confondre.
  source TEXT NOT NULL DEFAULT 'mon_client',
  case_id UUID UNIQUE REFERENCES public.marketplace_cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (binder_id, reference)
);

ALTER TABLE public.marketplace_binder_works
  DROP CONSTRAINT IF EXISTS marketplace_binder_works_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_works_source_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_works_dimensions_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_works_weight_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_works_value_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_works_title_check;
ALTER TABLE public.marketplace_binder_works
  ADD CONSTRAINT marketplace_binder_works_status_check CHECK (status IN ('active', 'archived')),
  ADD CONSTRAINT marketplace_binder_works_source_check
    CHECK (source IN ('mon_client', 'ma_reliure') AND (case_id IS NULL OR source = 'ma_reliure')),
  ADD CONSTRAINT marketplace_binder_works_dimensions_check
    CHECK ((height_mm IS NULL OR height_mm BETWEEN 1 AND 2000)
       AND (width_mm IS NULL OR width_mm BETWEEN 1 AND 2000)
       AND (thickness_mm IS NULL OR thickness_mm BETWEEN 1 AND 2000)),
  ADD CONSTRAINT marketplace_binder_works_weight_check
    CHECK (weight_grams IS NULL OR weight_grams BETWEEN 1 AND 50000),
  ADD CONSTRAINT marketplace_binder_works_value_check
    CHECK (declared_value_cents IS NULL OR declared_value_cents BETWEEN 0 AND 100000000),
  ADD CONSTRAINT marketplace_binder_works_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 300);

CREATE INDEX IF NOT EXISTS marketplace_binder_works_binder_idx
  ON public.marketplace_binder_works(binder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_binder_works_contact_idx
  ON public.marketplace_binder_works(contact_id) WHERE contact_id IS NOT NULL;

DROP TRIGGER IF EXISTS marketplace_binder_works_touch ON public.marketplace_binder_works;
CREATE TRIGGER marketplace_binder_works_touch
  BEFORE UPDATE ON public.marketplace_binder_works
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- Un ouvrage ne pointe jamais le contact d'un autre atelier.
CREATE OR REPLACE FUNCTION public.marketplace_binder_works_same_binder()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.marketplace_binder_clients c
    WHERE c.id = NEW.contact_id AND c.binder_id = NEW.binder_id
  ) THEN
    RAISE EXCEPTION 'work_contact_other_binder' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_binder_works_same_binder ON public.marketplace_binder_works;
CREATE TRIGGER marketplace_binder_works_same_binder
  BEFORE INSERT OR UPDATE OF contact_id, binder_id ON public.marketplace_binder_works
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_works_same_binder();

-- ---------------------------------------------------------------------------
-- 4. Photos d'un ouvrage — la structure seulement (aucune UX, aucun bucket dans cette PR)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_work_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES public.marketplace_binder_works(id) ON DELETE CASCADE,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  -- intake : photos du dossier d'origine · before / reception / during / after : la vie de l'atelier.
  stage TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_binder_work_photos
  DROP CONSTRAINT IF EXISTS marketplace_binder_work_photos_stage_check;
ALTER TABLE public.marketplace_binder_work_photos
  ADD CONSTRAINT marketplace_binder_work_photos_stage_check
    CHECK (stage IN ('intake', 'before', 'reception', 'during', 'after'));
CREATE INDEX IF NOT EXISTS marketplace_binder_work_photos_work_idx
  ON public.marketplace_binder_work_photos(work_id, stage, created_at);

-- ---------------------------------------------------------------------------
-- 5. Le lien devis → ouvrage (nullable, jamais une source de vérité)
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binder_quotes
  ADD COLUMN IF NOT EXISTS work_id UUID REFERENCES public.marketplace_binder_works(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS marketplace_binder_quotes_work_idx
  ON public.marketplace_binder_quotes(work_id) WHERE work_id IS NOT NULL;

-- Un devis ne se rattache jamais à l'ouvrage d'un autre atelier. Ne se déclenche qu'à
-- l'insertion et quand `work_id` change : `marketplace_binder_update_quote` ne le touche pas.
CREATE OR REPLACE FUNCTION public.marketplace_binder_quotes_work_same_binder()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.work_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.marketplace_binder_works w
    WHERE w.id = NEW.work_id AND w.binder_id = NEW.binder_id
  ) THEN
    RAISE EXCEPTION 'quote_work_other_binder' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_binder_quotes_work_same_binder ON public.marketplace_binder_quotes;
CREATE TRIGGER marketplace_binder_quotes_work_same_binder
  BEFORE INSERT OR UPDATE OF work_id ON public.marketplace_binder_quotes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_quotes_work_same_binder();

-- ---------------------------------------------------------------------------
-- 6. Création d'un ouvrage : numéro + ligne dans UNE transaction
-- ---------------------------------------------------------------------------
-- Le navigateur ne fournit jamais l'atelier, le numéro, la source ni le dossier d'origine : la
-- fonction les impose. Un ouvrage créé par ici est TOUJOURS `mon_client` ; un ouvrage issu d'un
-- projet Ma Reliure passera par sa propre fonction, dans la PR qui l'introduit.
CREATE OR REPLACE FUNCTION public.marketplace_binder_create_work(
  p_binder_id UUID,
  p_work JSONB
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_ref TEXT;
BEGIN
  v_ref := public.marketplace_binder_next_work_reference(p_binder_id, EXTRACT(YEAR FROM now())::INTEGER);
  INSERT INTO public.marketplace_binder_works
  SELECT r.*
  FROM jsonb_populate_record(
    NULL::public.marketplace_binder_works,
    p_work || jsonb_build_object(
      'id', v_id, 'binder_id', p_binder_id, 'reference', v_ref,
      'status', 'active', 'source', 'mon_client', 'case_id', NULL,
      'created_at', now(), 'updated_at', now()
    )
  ) AS r;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Isolation : service_role seulement, RLS deny-all, fonctions non exposées
-- ---------------------------------------------------------------------------
GRANT ALL ON public.marketplace_binder_work_counters TO service_role;
GRANT ALL ON public.marketplace_binder_works TO service_role;
GRANT ALL ON public.marketplace_binder_work_photos TO service_role;

ALTER TABLE public.marketplace_binder_work_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_work_counters" ON public.marketplace_binder_work_counters;
CREATE POLICY "No direct access to marketplace_binder_work_counters"
  ON public.marketplace_binder_work_counters FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_works ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_works" ON public.marketplace_binder_works;
CREATE POLICY "No direct access to marketplace_binder_works"
  ON public.marketplace_binder_works FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.marketplace_binder_work_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_work_photos" ON public.marketplace_binder_work_photos;
CREATE POLICY "No direct access to marketplace_binder_work_photos"
  ON public.marketplace_binder_work_photos FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON FUNCTION public.marketplace_binder_next_work_reference(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_next_work_reference(UUID, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.marketplace_binder_create_work(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_create_work(UUID, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.marketplace_binder_works_same_binder() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_quotes_work_same_binder() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- DROP TRIGGER IF EXISTS marketplace_binder_quotes_work_same_binder ON public.marketplace_binder_quotes;
-- DROP FUNCTION IF EXISTS public.marketplace_binder_quotes_work_same_binder();
-- ALTER TABLE public.marketplace_binder_quotes DROP COLUMN IF EXISTS work_id;
-- DROP TABLE IF EXISTS public.marketplace_binder_work_photos;
-- DROP TABLE IF EXISTS public.marketplace_binder_works;
-- DROP FUNCTION IF EXISTS public.marketplace_binder_works_same_binder();
-- DROP FUNCTION IF EXISTS public.marketplace_binder_create_work(UUID, JSONB);
-- DROP FUNCTION IF EXISTS public.marketplace_binder_next_work_reference(UUID, INTEGER);
-- DROP TABLE IF EXISTS public.marketplace_binder_work_counters;
-- ALTER TABLE public.marketplace_binder_clients DROP COLUMN IF EXISTS first_name, DROP COLUMN IF EXISTS last_name,
--   DROP COLUMN IF EXISTS organization, DROP COLUMN IF EXISTS origin, DROP COLUMN IF EXISTS origin_case_id,
--   DROP COLUMN IF EXISTS archived_at;
-- (Ne pas exécuter si des ouvrages réels existent : ce sont des données de l'atelier à conserver.)
-- ---------------------------------------------------------------------------
