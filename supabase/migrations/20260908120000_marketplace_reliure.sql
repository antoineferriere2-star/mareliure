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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  -- Set by the marketplace's own triage, never by the engine: the Playbook
  -- states the facts as Brief lines, the marketplace decides what they mean.
  manual_review_required BOOLEAN NOT NULL DEFAULT false,
  heritage_flag BOOLEAN NOT NULL DEFAULT false,
  declared_value_band TEXT,
  -- NULL until triage has run. Lets the reconciliation pass tell "not looked
  -- at yet" from "looked at, nothing to flag".
  triaged_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.marketplace_cases TO service_role;
ALTER TABLE public.marketplace_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_cases"
  ON public.marketplace_cases FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_cases_status_idx ON public.marketplace_cases(status);
CREATE INDEX marketplace_cases_triage_idx ON public.marketplace_cases(triaged_at)
  WHERE triaged_at IS NULL;
CREATE TRIGGER marketplace_cases_touch
  BEFORE UPDATE ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- The ingestion point. A trigger rather than a call from
-- handleSubmitSession, because the alternative is the generic runtime
-- importing the marketplace — the exact anti-pattern CLAUDE.md forbids ("une
-- Mission qui connaît le CRM"). The function stays deliberately dumb: it
-- creates the row and computes nothing. Triage is TypeScript, in
-- src/marketplace/, run over rows where triaged_at IS NULL.
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
  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_intake_missions m WHERE m.mission_id = NEW.mission_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.marketplace_cases (dossier_id, mission_id, reference)
  VALUES (
    NEW.id,
    NEW.mission_id,
    'RL-' || lpad(nextval('public.marketplace_case_reference_seq')::text, 3, '0')
  )
  ON CONFLICT (dossier_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER build_dossiers_marketplace_ingest
  AFTER INSERT ON public.build_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_ingest_dossier();

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
  UNIQUE (case_id, binder_id)
);
GRANT ALL ON public.marketplace_case_matches TO service_role;
ALTER TABLE public.marketplace_case_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_case_matches"
  ON public.marketplace_case_matches FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_case_matches_binder_idx
  ON public.marketplace_case_matches(binder_id, state);
CREATE INDEX marketplace_case_matches_case_idx ON public.marketplace_case_matches(case_id);

-- The three-relieur ceiling, enforced where it cannot be forgotten. The server
-- function checks it too and returns a readable error; this is the guarantee
-- that no other path can ever exceed it.
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

  IF existing >= 3 THEN
    RAISE EXCEPTION 'A case may be sent to at most 3 relieurs.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER marketplace_case_matches_ceiling
  BEFORE INSERT ON public.marketplace_case_matches
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
  UNIQUE (case_id, binder_id)
);
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
