-- Ma Reliure — les décisions structurées, séparées du chat (§20-§22 du
-- cahier des charges du 11 septembre 2026).
--
-- « Vérifiez attentivement l'orthographe. Cette validation sera transmise à
-- l'atelier » n'est pas une phrase de chat qu'on peut mal relire trois
-- semaines plus tard — c'est un objet, avec une réponse horodatée et
-- immuable. Une correction crée une nouvelle décision (`superseded_by`),
-- jamais un UPDATE de la réponse déjà donnée.

CREATE TABLE IF NOT EXISTS public.marketplace_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  question TEXT NOT NULL,
  -- Options proposées (dorure : plusieurs styles ; couleur : plusieurs
  -- teintes) — un tableau JSON de chaînes, pas une table à part : c'est de la
  -- donnée d'affichage, jamais interrogée par colonne.
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_role TEXT NOT NULL,
  answer JSONB,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  -- Pointe vers la décision qui corrige celle-ci une fois qu'une réponse
  -- déjà donnée doit changer. NULL tant qu'aucune correction n'existe.
  superseded_by UUID REFERENCES public.marketplace_decisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_decisions_kind_check CHECK (kind IN (
    'COLOR', 'MATERIAL', 'PAPER', 'GILDING_TEXT', 'GILDING_STYLE', 'DECOR',
    'TECHNICAL_CHOICE', 'OTHER'
  )),
  CONSTRAINT marketplace_decisions_status_check
    CHECK (status IN ('open', 'answered', 'cancelled')),
  CONSTRAINT marketplace_decisions_requested_role_check
    CHECK (requested_role IN ('binder', 'admin')),
  CONSTRAINT marketplace_decisions_options_array_check
    CHECK (jsonb_typeof(options) = 'array'),
  -- Même discipline que marketplace_binder_invitations : un état "answered"
  -- dit toujours qui, quand, et quoi.
  CONSTRAINT marketplace_decisions_answer_complete_check CHECK (
    status <> 'answered'
    OR (answer IS NOT NULL AND answered_by IS NOT NULL AND answered_at IS NOT NULL)
  ),
  CONSTRAINT marketplace_decisions_cancelled_complete_check CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  )
);
GRANT ALL ON public.marketplace_decisions TO service_role;
ALTER TABLE public.marketplace_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_decisions" ON public.marketplace_decisions;
CREATE POLICY "No direct access to marketplace_decisions"
  ON public.marketplace_decisions FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS marketplace_decisions_case_idx
  ON public.marketplace_decisions(case_id, created_at);
-- La question la plus fréquente d'un dashboard : "quelles décisions
-- attendent encore une réponse ?"
CREATE INDEX IF NOT EXISTS marketplace_decisions_open_idx
  ON public.marketplace_decisions(case_id) WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.marketplace_decisions;
