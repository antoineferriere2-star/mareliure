-- Ma Reliure — candidature atelier partenaire.
--
-- Le seul chemin d'entrée d'un atelier était un mailto: — aucune trace
-- structurée, rien à filtrer ni à retrouver. Cette table capture la
-- candidature ; elle ne crée jamais elle-même un atelier. La création reste
-- un acte humain (§7 : "Ma Reliure crée ou approuve l'atelier partenaire"),
-- déclenchée depuis l'admin après lecture de la candidature — le flux
-- d'invitation de marketplace_binder_invitations (Phase A) est inchangé.

CREATE TABLE IF NOT EXISTS public.marketplace_binder_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  workshop_name TEXT NOT NULL,
  legal_entity_type TEXT NOT NULL,
  city TEXT,
  years_experience INTEGER,
  -- Une bande, pas un montant exact : suffisant pour une première lecture,
  -- moins intrusif qu'un chiffre précis demandé par un formulaire public —
  -- même logique que declared_value_band sur marketplace_cases.
  average_annual_revenue_band TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  -- Renseigné une fois l'atelier réellement créé par l'admin — jamais posé
  -- automatiquement par ce formulaire.
  converted_binder_id UUID REFERENCES public.marketplace_binders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_binder_applications
  DROP CONSTRAINT IF EXISTS marketplace_binder_applications_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_applications_legal_entity_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_applications_revenue_band_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_applications_years_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_applications_reviewed_complete_check;

ALTER TABLE public.marketplace_binder_applications
  ADD CONSTRAINT marketplace_binder_applications_status_check
    CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected')),
  ADD CONSTRAINT marketplace_binder_applications_legal_entity_check CHECK (legal_entity_type IN (
    'auto_entrepreneur', 'ei', 'eirl', 'eurl', 'sarl', 'sas', 'autre'
  )),
  ADD CONSTRAINT marketplace_binder_applications_revenue_band_check CHECK (
    average_annual_revenue_band IS NULL OR average_annual_revenue_band IN (
      'under_20k', '20k_50k', '50k_100k', '100k_250k', 'over_250k', 'undisclosed'
    )
  ),
  ADD CONSTRAINT marketplace_binder_applications_years_check
    CHECK (years_experience IS NULL OR years_experience >= 0),
  -- Même discipline que marketplace_binder_invitations : un état "traité"
  -- dit toujours qui et quand, jamais une case cochée sans trace.
  ADD CONSTRAINT marketplace_binder_applications_reviewed_complete_check CHECK (
    status = 'new' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  );

GRANT ALL ON public.marketplace_binder_applications TO service_role;
ALTER TABLE public.marketplace_binder_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_applications"
  ON public.marketplace_binder_applications;
CREATE POLICY "No direct access to marketplace_binder_applications"
  ON public.marketplace_binder_applications FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS marketplace_binder_applications_status_idx
  ON public.marketplace_binder_applications(status, created_at);

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.marketplace_binder_applications;
