-- Audit #53 (1er octobre 2026), C1 et C2. Additive : aucun accord, devis accepté ni facture émise
-- n'est réécrit, aucune protection d'immutabilité n'est affaiblie.
--
-- C1 — L'accord fige le vendeur du devis (`terms.seller` = `issuer` du devis). Un devis peut être
-- préparé sans identifiant d'entreprise ; la facture, elle, en exige un. Comparer les SIRET bruts
-- transformait un simple complément d'identité en « changement de vendeur » sans issue.
--   * Le vendeur est désormais comparé par son ENTITÉ juridique normalisée : en France le SIREN
--     (explicite, sinon les 9 premiers chiffres d'un SIRET), ailleurs l'identifiant saisi par
--     l'atelier, préfixé de son pays. Aucun format français n'est imposé hors de France.
--     Un changement d'établissement (SIRET) du même SIREN reste le même vendeur ; un autre SIREN
--     est un autre vendeur et exige un nouvel accord.
--   * Un NOUVEL accord exige une entité déterminable sur le devis : plus de nouvel accord incomplet.
--   * Un accord DÉJÀ enregistré sans entité se résout par une attestation explicite, horodatée et
--     immuable (table séparée) : l'accord reste intact, rien n'est déduit en silence, et une
--     incohérence visible (raison sociale différente) renvoie vers un nouvel accord.
--
-- C2 — Les devis créés après la publication du circuit externe ne peuvent plus être acceptés sans
-- accord référencé par les voies brouillon → accepté ou expiré → accepté. Frontière : la
-- transaction de publication de #53 elle-même, lue dans la base (création du bucket
-- `work-logistics-private`, même transaction que 20260928090000/110000 en production :
-- 2026-10-01T09:16:46.649Z, vérifié en lecture seule). Les devis antérieurs gardent exactement
-- leur comportement historique.

CREATE FUNCTION public.marketplace_norm_identifier(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT NULLIF(regexp_replace(upper(coalesce(p_value,'')),'[^A-Z0-9]','','g'),'')
$$;

-- Entité juridique d'un vendeur figé (jsonb `issuer`). NULL = non déterminable.
CREATE FUNCTION public.marketplace_seller_entity(p_issuer jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  WITH s AS (
    SELECT coalesce(marketplace_norm_identifier(p_issuer->>'country'),'FR') AS country,
      marketplace_norm_identifier(p_issuer->>'siren') AS siren,
      marketplace_norm_identifier(p_issuer->>'siret') AS siret
  )
  SELECT CASE WHEN country IN ('FR','FRANCE') THEN
      'FR:'||coalesce(siren, CASE WHEN siret ~ '^[0-9]{14}$' THEN left(siret,9) END)
    ELSE country||':'||coalesce(siren, siret) END
  FROM s
$$;

-- Un nouvel accord du circuit externe exige un vendeur identifiable (C1).
CREATE OR REPLACE FUNCTION public.marketplace_own_quote_eligible(p_quote uuid,p_binder uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM marketplace_binder_quotes q
    LEFT JOIN marketplace_binder_works w ON w.id=q.work_id AND w.binder_id=q.binder_id
    LEFT JOIN marketplace_binder_clients c ON c.id=q.client_id AND c.binder_id=q.binder_id
    WHERE q.id=p_quote AND q.binder_id=p_binder AND q.deposit_cents=0
    AND q.status='sent' AND q.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date
    AND marketplace_seller_entity(q.issuer) IS NOT NULL
    AND ((q.work_id IS NOT NULL AND w.source='mon_client' AND w.case_id IS NULL)
      OR (q.work_id IS NULL AND c.origin='mon_client' AND c.origin_case_id IS NULL)))
$$;

-- C2 : époque contractuelle du devis. Les lignes existantes valent « avant le circuit externe » ;
-- celles créées depuis la transaction de publication de #53 sont reclassées, uniquement si elles
-- ne sont pas acceptées (un devis accepté est immuable et n'a plus de transition d'acceptation).
ALTER TABLE public.marketplace_binder_quotes ADD COLUMN contract_epoch text NOT NULL DEFAULT 'pre_external_v1'
  CHECK (contract_epoch IN ('pre_external_v1','external_v1'));
DO $$
DECLARE v_frontier timestamptz;
BEGIN
  SELECT created_at INTO v_frontier FROM storage.buckets WHERE id='work-logistics-private';
  IF v_frontier IS NULL THEN RAISE EXCEPTION 'external_v1_publication_marker_missing'; END IF;
  UPDATE public.marketplace_binder_quotes SET contract_epoch='external_v1'
  WHERE created_at >= v_frontier AND status IN ('draft','sent','expired');
END $$;
ALTER TABLE public.marketplace_binder_quotes ALTER COLUMN contract_epoch SET DEFAULT 'external_v1';

CREATE OR REPLACE FUNCTION public.marketplace_require_own_agreement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a marketplace_own_client_agreements%ROWTYPE;
BEGIN
  -- L'époque est fixée par la base : un devis créé désormais ne peut pas se déclarer historique.
  IF (TG_OP='UPDATE' AND NEW.contract_epoch IS DISTINCT FROM OLD.contract_epoch)
    OR (TG_OP='INSERT' AND NEW.contract_epoch IS DISTINCT FROM 'external_v1') THEN
    RAISE EXCEPTION 'contract_epoch_immutable';
  END IF;
  IF NEW.status='accepted' AND (TG_OP='INSERT' OR OLD.status NOT IN ('accepted','invoiced'))
    AND NEW.payment_snapshot->>'circuit'='own_client'
    AND NEW.deposit_cents=0
    AND (
      -- Nouveau contrat : aucune voie d'acceptation sans accord référencé.
      NEW.contract_epoch='external_v1'
      -- Devis historique : règle publiée par #53, inchangée.
      OR (NEW.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date AND (TG_OP='INSERT' OR OLD.status='sent'))
    ) THEN
    SELECT * INTO a FROM marketplace_own_client_agreements WHERE quote_id=NEW.id AND binder_id=NEW.binder_id;
    IF NOT FOUND OR a.terms->>'currency' IS DISTINCT FROM NEW.currency
      OR (a.terms->>'total_ttc_cents')::bigint IS DISTINCT FROM NEW.total_ttc_cents THEN RAISE EXCEPTION 'own_agreement_required'; END IF;
    NEW.payment_snapshot := NEW.payment_snapshot || jsonb_build_object('agreement_version','own-external-v1',
      'platform_fee_cents',0,'agreement_recorded_at',a.accepted_at,'acceptance_evidence',a.evidence);
  END IF;
  RETURN NEW;
END $$;

-- C1 : attestation d'identité pour un accord déjà enregistré sans entité déterminable.
CREATE TABLE public.marketplace_own_agreement_identity_completions (
  quote_id uuid PRIMARY KEY REFERENCES public.marketplace_own_client_agreements(quote_id) ON DELETE RESTRICT,
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  seller_entity text NOT NULL,
  seller jsonb NOT NULL,
  attestation text NOT NULL CHECK(length(btrim(attestation)) BETWEEN 8 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.marketplace_own_agreement_identity_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_own_agreement_identity_completions FROM anon,authenticated;
GRANT SELECT,INSERT ON public.marketplace_own_agreement_identity_completions TO service_role;
CREATE TRIGGER identity_completion_immutable BEFORE UPDATE OR DELETE ON public.marketplace_own_agreement_identity_completions
FOR EACH ROW EXECUTE FUNCTION public.marketplace_settlement_immutable();

-- État de l'identité vendeur d'un accord, pour l'écran et pour l'émission.
CREATE FUNCTION public.marketplace_own_agreement_identity(p_quote uuid,p_binder uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a marketplace_own_client_agreements%ROWTYPE; c marketplace_own_agreement_identity_completions%ROWTYPE;
  p marketplace_binder_billing_profiles%ROWTYPE; v_profile jsonb; v_agreed text; v_current text;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO a FROM marketplace_own_client_agreements WHERE quote_id=p_quote AND binder_id=p_binder;
  IF NOT FOUND THEN RETURN jsonb_build_object('agreement',false); END IF;
  SELECT * INTO c FROM marketplace_own_agreement_identity_completions WHERE quote_id=p_quote;
  SELECT * INTO p FROM marketplace_binder_billing_profiles WHERE binder_id=p_binder;
  v_profile := jsonb_build_object('country',p.country,'siren',p.siren,'siret',p.siret,'legalName',p.legal_name);
  v_agreed := marketplace_seller_entity(a.terms->'seller');
  v_current := marketplace_seller_entity(v_profile);
  RETURN jsonb_build_object('agreement',true,
    'state', CASE
      WHEN v_agreed IS NOT NULL AND v_current IS NOT NULL AND v_agreed<>v_current THEN 'seller_changed'
      WHEN v_agreed IS NOT NULL THEN 'complete'
      WHEN c.quote_id IS NOT NULL AND c.seller_entity IS DISTINCT FROM v_current THEN 'seller_changed'
      WHEN c.quote_id IS NOT NULL THEN 'completed_by_attestation'
      WHEN v_current IS NULL THEN 'profile_identifier_missing'
      -- Compléter n'est pas remplacer : le nom figé à l'accord doit être celui du profil.
      -- Raison sociale si l'accord en porte une, sinon nom d'atelier ; sans nom, rien n'est attesté.
      WHEN nullif(btrim(a.terms->'seller'->>'legalName'),'') IS NOT NULL THEN CASE
        WHEN marketplace_norm_identifier(a.terms->'seller'->>'legalName') IS DISTINCT FROM marketplace_norm_identifier(p.legal_name)
          THEN 'seller_changed' ELSE 'attestation_required' END
      WHEN nullif(btrim(a.terms->'seller'->>'workshopName'),'') IS NOT NULL THEN CASE
        WHEN marketplace_norm_identifier(a.terms->'seller'->>'workshopName') IS DISTINCT FROM marketplace_norm_identifier(p.workshop_name)
          THEN 'seller_changed' ELSE 'attestation_required' END
      ELSE 'seller_changed' END,
    'attestation', CASE WHEN c.quote_id IS NULL THEN NULL ELSE jsonb_build_object('text',c.attestation,'at',c.created_at) END);
END $$;

CREATE FUNCTION public.marketplace_complete_own_agreement_identity(p_quote uuid,p_binder uuid,p_actor uuid,p_attestation text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_state jsonb; p marketplace_binder_billing_profiles%ROWTYPE; c marketplace_own_agreement_identity_completions%ROWTYPE;
  v_seller jsonb;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  -- Même verrou parent que l'acceptation et la facturation du devis.
  PERFORM 1 FROM marketplace_binder_quotes WHERE id=p_quote AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  SELECT * INTO c FROM marketplace_own_agreement_identity_completions WHERE quote_id=p_quote;
  SELECT * INTO p FROM marketplace_binder_billing_profiles WHERE binder_id=p_binder;
  v_seller := jsonb_build_object('country',p.country,'siren',p.siren,'siret',p.siret,'legalName',p.legal_name,
    'legalForm',p.legal_form,'workshopName',p.workshop_name);
  IF c.quote_id IS NOT NULL THEN
    IF c.seller_entity IS DISTINCT FROM marketplace_seller_entity(v_seller) OR c.attestation IS DISTINCT FROM btrim(p_attestation)
      OR c.actor_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'identity_completion_already_recorded'; END IF;
    RETURN;
  END IF;
  v_state := marketplace_own_agreement_identity(p_quote,p_binder,p_actor);
  IF v_state->>'state' IS DISTINCT FROM 'attestation_required' THEN
    RAISE EXCEPTION 'identity_completion_not_applicable:%', coalesce(v_state->>'state','no_agreement');
  END IF;
  INSERT INTO marketplace_own_agreement_identity_completions(quote_id,binder_id,actor_id,seller_entity,seller,attestation)
  VALUES(p_quote,p_binder,p_actor,marketplace_seller_entity(v_seller),v_seller,btrim(p_attestation));
END $$;

-- Garde d'émission : entité juridique normalisée, attestation pour les accords incomplets.
CREATE OR REPLACE FUNCTION public.marketplace_external_balance_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE net bigint; v_agreed text; v_terms jsonb;
BEGIN
  IF NEW.payment_snapshot->>'agreement_version'='own-external-v1' THEN
    IF NEW.status='issued' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'issued') THEN
      SELECT terms INTO v_terms FROM marketplace_own_client_agreements WHERE quote_id=NEW.quote_id;
      v_agreed := marketplace_seller_entity(v_terms->'seller');
      IF v_agreed IS NULL THEN
        SELECT seller_entity INTO v_agreed FROM marketplace_own_agreement_identity_completions WHERE quote_id=NEW.quote_id;
        IF v_agreed IS NULL THEN RAISE EXCEPTION 'seller_identity_completion_required'; END IF;
      END IF;
      IF marketplace_seller_entity(NEW.issuer) IS DISTINCT FROM v_agreed THEN
        RAISE EXCEPTION 'invoice_seller_changed_new_agreement_required';
      END IF;
    END IF;
    SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
      INTO net FROM marketplace_external_settlements WHERE invoice_id=NEW.id;
    IF NEW.amount_paid_cents IS DISTINCT FROM net OR NEW.deposit_paid_cents<>0
      OR NEW.payment_status IS DISTINCT FROM (CASE WHEN net=0 THEN 'unpaid' WHEN net=NEW.total_ttc_cents THEN 'paid' ELSE 'partial' END)
      OR (NEW.paid_at IS NOT NULL) IS DISTINCT FROM (net>0 AND net=NEW.total_ttc_cents) THEN
      RAISE EXCEPTION 'payment_evidence_required';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Contrat présenté à l'atelier : circuit applicable, accord exigé, blocage explicite (C1/C2).
CREATE OR REPLACE FUNCTION public.marketplace_own_contract(p_quote uuid,p_binder uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q marketplace_binder_quotes%ROWTYPE; v_applies boolean; v_required boolean; v_valid boolean;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO q FROM marketplace_binder_quotes WHERE id=p_quote AND binder_id=p_binder;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  v_applies := q.deposit_cents=0 AND EXISTS(SELECT 1 FROM marketplace_binder_quotes x
    LEFT JOIN marketplace_binder_works w ON w.id=x.work_id AND w.binder_id=x.binder_id
    LEFT JOIN marketplace_binder_clients c ON c.id=x.client_id AND c.binder_id=x.binder_id
    WHERE x.id=q.id AND ((x.work_id IS NOT NULL AND w.source='mon_client' AND w.case_id IS NULL)
      OR (x.work_id IS NULL AND c.origin='mon_client' AND c.origin_case_id IS NULL)));
  v_valid := q.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date;
  v_required := v_applies AND q.status IN ('draft','sent','expired') AND (q.contract_epoch='external_v1' OR (q.status='sent' AND v_valid));
  RETURN jsonb_build_object('eligible',marketplace_own_quote_eligible(p_quote,p_binder),'version','own-external-v1','revision',md5(to_jsonb(q)::text),
    'seller',q.issuer,'currency',q.currency,'totalCents',q.total_ttc_cents,'feeCents',0,
    'evidence',(SELECT evidence FROM marketplace_own_client_agreements WHERE quote_id=q.id),
    'circuitApplies',v_applies,'agreementRequired',v_required,'contractEpoch',q.contract_epoch,
    'blocker',CASE WHEN NOT v_required THEN NULL
      WHEN marketplace_seller_entity(q.issuer) IS NULL THEN 'seller_identity_missing'
      WHEN NOT v_valid THEN 'validity_expired'
      WHEN q.status<>'sent' THEN 'send_first'
      ELSE NULL END);
END $$;

-- Pourquoi une facture n'a pas de suivi des règlements (C2) : orientation explicite, aucun accord
-- fabriqué après coup.
CREATE OR REPLACE FUNCTION public.marketplace_external_settlement_state(p_invoice uuid,p_binder uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; q marketplace_binder_quotes%ROWTYPE; events jsonb; net bigint; disputed boolean;
  v_eligible boolean;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO i FROM marketplace_binder_invoices WHERE id=p_invoice AND binder_id=p_binder;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  SELECT * INTO q FROM marketplace_binder_quotes WHERE id=i.quote_id AND binder_id=p_binder;
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at,e.id),'[]'::jsonb),
    coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
    INTO events,net FROM marketplace_external_settlements e WHERE invoice_id=p_invoice;
  SELECT kind='dispute_open' INTO disputed FROM marketplace_external_settlements WHERE invoice_id=p_invoice AND kind IN ('dispute_open','dispute_close') ORDER BY created_at DESC,id DESC LIMIT 1;
  v_eligible := coalesce(i.payment_snapshot->>'agreement_version'='own-external-v1' AND i.status IN ('issued','credited'),false);
  RETURN jsonb_build_object('eligible',v_eligible,
    'currency',i.currency,'totalCents',i.total_ttc_cents,'netCents',net,'disputed',coalesce(disputed,false),'events',events,
    'reason',CASE WHEN v_eligible THEN NULL
      WHEN i.status='draft' THEN 'not_issued'
      WHEN i.payment_snapshot->>'agreement_version'='own-external-v1' THEN 'not_issued'
      WHEN i.payment_snapshot IS NULL THEN 'historical_before_circuits'
      WHEN i.payment_snapshot->>'circuit' IN ('legacy_resale','network_sale','concierge') THEN 'network'
      WHEN i.payment_snapshot->'provenance'->>'source'='unverified_contact' THEN 'unverified_contact'
      WHEN i.payment_snapshot->>'circuit'<>'own_client' THEN 'review_required'
      WHEN coalesce(q.deposit_cents,i.deposit_cents)>0 THEN 'deposit'
      ELSE 'accepted_without_agreement' END);
END $$;

REVOKE ALL ON FUNCTION public.marketplace_norm_identifier(text),public.marketplace_seller_entity(jsonb),
  public.marketplace_own_agreement_identity(uuid,uuid,uuid),public.marketplace_complete_own_agreement_identity(uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_norm_identifier(text),public.marketplace_seller_entity(jsonb),
  public.marketplace_own_agreement_identity(uuid,uuid,uuid),public.marketplace_complete_own_agreement_identity(uuid,uuid,uuid,text)
  TO service_role;
