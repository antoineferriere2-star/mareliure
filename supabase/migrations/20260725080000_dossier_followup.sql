-- Commercial follow-up on a Dossier (Espace Client portal): a separate
-- pipeline from build_dossiers.status, which tracks the runtime session
-- lifecycle ('draft' | 'ready') and must not be reused for this.
ALTER TABLE public.build_dossiers
  ADD COLUMN commercial_status TEXT NOT NULL DEFAULT 'nouveau',
  -- 'nouveau' | 'contacte' | 'devise' | 'gagne' | 'perdu'
  ADD COLUMN commercial_notes TEXT,
  ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX build_dossiers_commercial_status_idx ON public.build_dossiers(commercial_status);
