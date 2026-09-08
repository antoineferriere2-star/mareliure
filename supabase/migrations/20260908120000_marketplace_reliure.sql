-- Reliure marketplace — the transaction domain that sits on top of the Métré
-- qualification engine. See docs/reliure-marketplace-architecture.md.
--
-- Two rules govern everything below:
--
--   1. No copy of the qualification. `marketplace_cases.dossier_id` REFERENCES
--      build_dossiers; the answers, the photos, the Project Brief and the
--      visitor summary stay where the engine put them. One source of truth.
--   2. Same isolation as build_*: service_role only, RLS denies anon and
--      authenticated outright. Every read and write goes through a TanStack
--      server function that proves who the caller is first. No policy on any
--      build_* table is touched by this migration.

-- ---------------------------------------------------------------------------
-- Which Missions feed the marketplace
-- ---------------------------------------------------------------------------
-- Enrolment is explicit data, not a convention. A Deck Mission, or any SaaS
-- customer's Mission, is absent from this table and therefore produces no
-- marketplace case — which is what keeps the marketplace out of the generic
-- engine entirely.
CREATE TABLE public.marketplace_intake_missions (
  mission_id UUID PRIMARY KEY REFERENCES public.build_missions(id) ON DELETE CASCADE,
  vertical_id TEXT NOT NULL DEFAULT 'bookbinding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.marketplace_intake_missions TO service_role;
ALTER TABLE public.marketplace_intake_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_intake_missions"
  ON public.marketplace_intake_missions FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Relieurs
-- ---------------------------------------------------------------------------
CREATE TABLE public.marketplace_binders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  workshop_name TEXT,
  city TEXT,
  postal_code TEXT,
  bio TEXT,
  years_experience INTEGER,
  training TEXT,
  avatar_path TEXT,
  -- draft | pending_review | approved | rejected | suspended.
  -- Only 'approved' ever receives an invitation; enforced in the server
  -- function that creates matches, and asserted by its test.
  status TEXT NOT NULL DEFAULT 'draft',
  -- How many projects this workshop says it can hold at once. Feeds the
  -- matching score's workload term; never a hard gate.
  capacity_slots INTEGER NOT NULL DEFAULT 3,
  accepted_project_types TEXT[] NOT NULL DEFAULT '{}',
  min_project_cents INTEGER,
  max_project_cents INTEGER,
  response_rate NUMERIC(4,3),
  rating_avg NUMERIC(3,2),
  rating_count INTEGER NOT NULL DEFAULT 0,
  -- Stripe Connect lands in P1; the column exists so the P1 migration is a
  -- backfill rather than a schema change on a live table.
  stripe_account_id TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_binders_status_check CHECK (
    status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')
  ),
  CONSTRAINT marketplace_binders_capacity_check CHECK (capacity_slots >= 0),
  CONSTRAINT marketplace_binders_price_range_check CHECK (
    min_project_cents IS NULL
    OR max_project_cents IS NULL
    OR min_project_cents <= max_project_cents
  )
);
GRANT ALL ON public.marketplace_binders TO service_role;
ALTER TABLE public.marketplace_binders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_binders"
  ON public.marketplace_binders FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_binders_status_idx ON public.marketplace_binders(status);
CREATE TRIGGER marketplace_binders_touch
  BEFORE UPDATE ON public.marketplace_binders
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- Skills are rows, not an enum: adding "reliure japonaise" must never require
-- a migration (§29).
CREATE TABLE public.marketplace_binder_skills (
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  skill_slug TEXT NOT NULL,
  PRIMARY KEY (binder_id, skill_slug)
);
GRANT ALL ON public.marketplace_binder_skills TO service_role;
ALTER TABLE public.marketplace_binder_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_binder_skills"
  ON public.marketplace_binder_skills FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE TABLE public.marketplace_binder_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  before_photo_path TEXT,
  after_photo_path TEXT,
  techniques TEXT[] NOT NULL DEFAULT '{}',
  materials TEXT[] NOT NULL DEFAULT '{}',
  year INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.marketplace_binder_portfolio TO service_role;
ALTER TABLE public.marketplace_binder_portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_binder_portfolio"
  ON public.marketplace_binder_portfolio FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_binder_portfolio_binder_idx
  ON public.marketplace_binder_portfolio(binder_id, position);

-- ---------------------------------------------------------------------------
-- Cases — the bridge between a qualified Dossier and a transaction
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.marketplace_case_reference_seq START WITH 1;
GRANT USAGE ON SEQUENCE public.marketplace_case_reference_seq TO service_role;

CREATE TABLE public.marketplace_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The whole point of this table. UNIQUE, so one Dossier can never spawn two
  -- transactions, and ON DELETE CASCADE so a deleted Dossier never leaves a
  -- case pointing at nothing.
  dossier_id UUID NOT NULL UNIQUE REFERENCES public.build_dossiers(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.build_missions(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,
  -- Transaction status, deliberately distinct from build_dossiers.status
  -- (qualification) — the two answer different questions.
  status TEXT NOT NULL DEFAULT 'under_review',
  -- Canonical ownership. The visitor submits anonymously, so this is NULL
  -- until the customer proves possession of the Dossier (its existing
  -- build_dossier_access_tokens link) or their verified e-mail matches an
  -- unclaimed case. From then on it is the ONLY thing authorising a customer:
  -- see src/marketplace/permissions.ts.
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  -- How the case was claimed: 'access_token' (possession proof) or
  -- 'verified_email' (rapprochement). Kept because the two carry different
  -- levels of assurance and a dispute will ask which one applied.
  claim_method TEXT,
  -- Set by the marketplace's own triage, never by the engine, and computed
  -- from build_runtime_sessions.answers — never by reading the Project Brief.
  manual_review_required BOOLEAN NOT NULL DEFAULT false,
  heritage_flag BOOLEAN NOT NULL DEFAULT false,
  -- The marketplace's own vocabulary (src/marketplace/cases/caseProfile.ts),
  -- not the Playbook's option values: a Playbook rewording must never become a
  -- silent schema change here.
  declared_value_band TEXT,
  -- Stable codes, never sentences. The French wording lives in
  -- src/marketplace/cases/triage.ts and is free to change without a migration.
  triage_flags TEXT[] NOT NULL DEFAULT '{}',
  -- NULL until triage has run. Lets the reconciliation pass tell "not looked
  -- at yet" from "looked at, nothing to flag".
  triaged_at TIMESTAMPTZ,
  -- What a human wrote. Triage never touches this column.
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_cases_status_check CHECK (status IN (
    'under_review', 'matching', 'sent_to_binders', 'quotes_received',
    'binder_selected', 'awaiting_payment', 'paid', 'shipping_to_binder',
    'received_by_binder', 'in_progress', 'awaiting_approval',
    'shipping_to_customer', 'delivered', 'completed', 'cancelled'
  )),
  CONSTRAINT marketplace_cases_value_band_check CHECK (
    declared_value_band IS NULL
    OR declared_value_band IN ('under_100', '100_500', '500_1000', 'over_1000', 'unknown')
  ),
  CONSTRAINT marketplace_cases_claim_method_check CHECK (
    claim_method IS NULL OR claim_method IN ('access_token', 'verified_email')
  ),
  -- A claimed case always records when and how, so a half-written claim can
  -- never look like an unclaimed case anyone may still take.
  --
  -- Deliberately one-directional. The symmetric version — "no owner implies no
  -- claimed_at" — reads better and is wrong: customer_user_id is ON DELETE SET
  -- NULL, so deleting an account would leave claimed_at behind and the CHECK
  -- would abort the deletion. A case whose owner's account is gone is a real
  -- state, and it must not be one that makes DELETE FROM auth.users fail.
  CONSTRAINT marketplace_cases_claim_complete CHECK (
    customer_user_id IS NULL OR (claimed_at IS NOT NULL AND claim_method IS NOT NULL)
  )
);
GRANT ALL ON public.marketplace_cases TO service_role;
ALTER TABLE public.marketplace_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_cases"
  ON public.marketplace_cases FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_cases_status_idx ON public.marketplace_cases(status);
CREATE INDEX marketplace_cases_triage_idx ON public.marketplace_cases(triaged_at)
  WHERE triaged_at IS NULL;
-- Every customer read starts from "which cases are mine?".
CREATE INDEX marketplace_cases_customer_idx ON public.marketplace_cases(customer_user_id)
  WHERE customer_user_id IS NOT NULL;
CREATE TRIGGER marketplace_cases_touch
  BEFORE UPDATE ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- The ingestion point. A trigger rather than a call from
-- handleSubmitSession, because the alternative is the generic runtime
-- importing the marketplace — the exact anti-pattern CLAUDE.md forbids ("une
-- Mission qui connaît le CRM"). The function stays deliberately dumb: it
-- creates the row and computes nothing. Triage is TypeScript, in
-- src/marketplace/, run over rows where triaged_at IS NULL, and it reads
-- build_runtime_sessions.answers — never the Project Brief's prose.
--
-- THE CRITICAL PROPERTY: this trigger runs inside the transaction that
-- inserts the visitor's Dossier. Anything it raises would roll back a
-- submission the visitor already completed — the marketplace breaking Métré,
-- which is precisely what keeping them apart is meant to prevent. So every
-- failure is swallowed and the Dossier stands. A case that was not created is
-- repaired by marketplace_ingest_missing_cases() below, which the back-office
-- runs on every visit.
CREATE OR REPLACE FUNCTION public.marketplace_ingest_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mission_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- A Mission that is not enrolled is ignored entirely: no row, no sequence
  -- consumed, no side effect. Deck and every SaaS customer's Mission take this
  -- branch and never learn that a marketplace exists.
  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_intake_missions m WHERE m.mission_id = NEW.mission_id
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.marketplace_cases (dossier_id, mission_id, reference)
    VALUES (
      NEW.id,
      NEW.mission_id,
      'RL-' || lpad(nextval('public.marketplace_case_reference_seq')::text, 3, '0')
    )
    -- Idempotence, guaranteed by the UNIQUE on dossier_id. A re-ingestion
    -- attempt does nothing rather than raising.
    ON CONFLICT (dossier_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Deliberately silent, and deliberately last. The visitor's Dossier is
    -- worth more than the marketplace's bookkeeping, and the bookkeeping is
    -- repairable.
    NULL;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER build_dossiers_marketplace_ingest
  AFTER INSERT ON public.build_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_ingest_dossier();

-- The repair path. Creates a case for every Dossier of an enrolled Mission
-- that has none — whether the trigger swallowed an error, or the Mission was
-- enrolled after those Dossiers already existed. Returns how many it made.
-- Idempotent by construction: the NOT EXISTS and the UNIQUE both hold.
CREATE OR REPLACE FUNCTION public.marketplace_ingest_missing_cases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created INTEGER;
BEGIN
  WITH missing AS (
    SELECT d.id AS dossier_id, d.mission_id
    FROM public.build_dossiers d
    JOIN public.marketplace_intake_missions m ON m.mission_id = d.mission_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.marketplace_cases c WHERE c.dossier_id = d.id
    )
    ORDER BY d.created_at
  )
  INSERT INTO public.marketplace_cases (dossier_id, mission_id, reference)
  SELECT
    missing.dossier_id,
    missing.mission_id,
    'RL-' || lpad(nextval('public.marketplace_case_reference_seq')::text, 3, '0')
  FROM missing
  ON CONFLICT (dossier_id) DO NOTHING;

  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_ingest_missing_cases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_ingest_missing_cases() TO service_role;

-- ---------------------------------------------------------------------------
-- Matching — at most three relieurs per case (§32)
-- ---------------------------------------------------------------------------
CREATE TABLE public.marketplace_case_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  -- invited | declined | quoted | selected
  state TEXT NOT NULL DEFAULT 'invited',
  -- What the score said at invitation time. Kept for later calibration; the
  -- admin's choice is what actually created the row.
  match_score INTEGER,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,
  UNIQUE (case_id, binder_id),
  CONSTRAINT marketplace_case_matches_state_check CHECK (
    state IN ('invited', 'declined', 'quoted', 'selected')
  ),
  CONSTRAINT marketplace_case_matches_score_check CHECK (
    match_score IS NULL OR (match_score >= 0 AND match_score <= 100)
  )
);
GRANT ALL ON public.marketplace_case_matches TO service_role;
ALTER TABLE public.marketplace_case_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_case_matches"
  ON public.marketplace_case_matches FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_case_matches_binder_idx
  ON public.marketplace_case_matches(binder_id, state);
CREATE INDEX marketplace_case_matches_case_idx ON public.marketplace_case_matches(case_id);

-- At most one chosen relieur per case. Without this, two concurrent
-- selections would leave two workshops each believing the book is theirs.
CREATE UNIQUE INDEX marketplace_case_matches_one_selected_uidx
  ON public.marketplace_case_matches(case_id)
  WHERE state = 'selected';

-- The three-relieur ceiling, enforced where it cannot be forgotten. The server
-- function checks it too and returns a readable error; this is the guarantee
-- that no other path can ever exceed it.
--
-- AFTER, not BEFORE, and that is the whole correctness of it. A BEFORE ROW
-- trigger's SELECT cannot see the other rows of its own statement, so a single
-- `INSERT ... VALUES (4 rows)` on an empty case would have every row read a
-- count of zero and pass — the ceiling would only ever catch invitations sent
-- in separate statements. An AFTER ROW trigger sees the rows the statement has
-- already inserted, so the fourth one raises and the whole statement rolls
-- back. AFTER triggers ignore the return value; NULL is the convention.
CREATE OR REPLACE FUNCTION public.marketplace_enforce_match_ceiling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing INTEGER;
BEGIN
  SELECT count(*) INTO existing
  FROM public.marketplace_case_matches
  WHERE case_id = NEW.case_id;

  IF existing > 3 THEN
    RAISE EXCEPTION 'A case may be sent to at most 3 relieurs.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER marketplace_case_matches_ceiling
  AFTER INSERT ON public.marketplace_case_matches
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_enforce_match_ceiling();

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
CREATE TABLE public.marketplace_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  technique TEXT,
  materials TEXT,
  options TEXT,
  -- Money is integer cents everywhere in this schema. No floats, ever.
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  lead_time_weeks INTEGER NOT NULL,
  caveats TEXT,
  valid_until DATE,
  -- draft | submitted | selected | rejected | expired | withdrawn
  state TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One live proposal per relieur per case. A revised price replaces the
  -- previous one rather than adding a second offer the customer must compare.
  UNIQUE (case_id, binder_id),
  CONSTRAINT marketplace_quotes_state_check CHECK (
    state IN ('draft', 'submitted', 'selected', 'rejected', 'expired', 'withdrawn')
  ),
  -- Money is integer cents and a proposal is never free or negative. The app
  -- validates the same bounds with a readable message; this is the guarantee.
  CONSTRAINT marketplace_quotes_amount_check CHECK (amount_cents > 0),
  CONSTRAINT marketplace_quotes_lead_time_check CHECK (lead_time_weeks > 0)
);

-- At most one selected proposal per case: the customer chooses once, and a
-- second "selected" row would make two relieurs both believe they have the job.
CREATE UNIQUE INDEX marketplace_quotes_one_selected_uidx
  ON public.marketplace_quotes(case_id)
  WHERE state = 'selected';
GRANT ALL ON public.marketplace_quotes TO service_role;
ALTER TABLE public.marketplace_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_quotes"
  ON public.marketplace_quotes FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_quotes_case_idx ON public.marketplace_quotes(case_id, state);
CREATE TRIGGER marketplace_quotes_touch
  BEFORE UPDATE ON public.marketplace_quotes
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage for relieur photos (avatars and portfolio before/after)
-- ---------------------------------------------------------------------------
-- Private like every other bucket here: reads go through a signed URL minted
-- server-side. A portfolio is public-facing content, but the objects
-- themselves are not world-readable — the marketplace decides what to expose.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-binder-photos',
  'marketplace-binder-photos',
  FALSE,
  8388608, -- 8 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "No direct access to marketplace-binder-photos" ON storage.objects;
CREATE POLICY "No direct access to marketplace-binder-photos"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'marketplace-binder-photos' AND FALSE)
  WITH CHECK (bucket_id = 'marketplace-binder-photos' AND FALSE);

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC on new functions by default. The trigger
-- functions raise if called directly, so this is tidiness rather than a hole —
-- but "tidiness" is what an audit reads, and leaving PUBLIC on a SECURITY
-- DEFINER function invites the question every time.
REVOKE ALL ON FUNCTION public.marketplace_ingest_dossier() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_enforce_match_ceiling()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- Every object this migration creates, in dependency order. Nothing here
-- touches a build_* table beyond dropping the one trigger it added, so undoing
-- this leaves Métré exactly as it was — which is the property that made the
-- trigger acceptable in the first place.
--
--   DROP TRIGGER IF EXISTS build_dossiers_marketplace_ingest ON public.build_dossiers;
--   DROP FUNCTION IF EXISTS public.marketplace_ingest_dossier();
--   DROP FUNCTION IF EXISTS public.marketplace_ingest_missing_cases();
--   DROP FUNCTION IF EXISTS public.marketplace_enforce_match_ceiling();
--   DROP TABLE IF EXISTS public.marketplace_quotes;
--   DROP TABLE IF EXISTS public.marketplace_case_matches;
--   DROP TABLE IF EXISTS public.marketplace_cases;
--   DROP SEQUENCE IF EXISTS public.marketplace_case_reference_seq;
--   DROP TABLE IF EXISTS public.marketplace_binder_portfolio;
--   DROP TABLE IF EXISTS public.marketplace_binder_skills;
--   DROP TABLE IF EXISTS public.marketplace_binders;
--   DROP TABLE IF EXISTS public.marketplace_intake_missions;
--   DROP POLICY IF EXISTS "No direct access to marketplace-binder-photos" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'marketplace-binder-photos';
--
-- The bucket delete fails while objects remain, deliberately: dropping a
-- relieur's portfolio photos should be a decision, not a side effect.
