-- Ma Reliure — le fil du projet.
--
-- Une fois un atelier retenu, le livre se suit dans Ma Reliure : ce que
-- l'atelier dit, ce qu'il demande au client, ce que le client décide, les
-- photos de l'avancement, et les imprévus que Ma Reliure reprend en main.
--
--   marketplace_project_messages    la conversation et les mises à jour
--   marketplace_project_decisions   les questions fermées, tranchées une fois
--   marketplace_project_files       les photos et PDF, jamais publics
--   marketplace_project_reads       où chacun s'est arrêté de lire
--   marketplace_scope_issues        les imprévus, entre l'atelier et Ma Reliure
--
-- Aucune de ces tables n'est lisible par `anon` ni `authenticated` : le modèle
-- d'accès vit dans `src/marketplace/permissions.ts`, appliqué par les server
-- functions avant chaque lecture. Le recopier en politiques RLS ferait deux
-- sources de vérité pour la même règle.
--
-- Additive et rejouable. Aucune politique `build_*` n'est touchée. Aucun
-- montant n'est porté par ces tables : une décision, un message ou un imprévu
-- ne changent jamais un prix.

-- ---------------------------------------------------------------------------
-- 1. « Travail terminé »
-- ---------------------------------------------------------------------------
-- Entre « travail en cours » et « en route vers le client » manquait l'état où
-- le livre est fini et attend son retour. Sans lui, finir un livre annonçait
-- une expédition qui n'existe pas.

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_status_check;
ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_status_check CHECK (status IN (
    'under_review', 'pricing', 'matching', 'awaiting_binder_response',
    'binder_accepted', 'binder_selected', 'awaiting_payment', 'paid',
    'shipping_to_binder', 'received_by_binder', 'in_progress',
    'awaiting_approval', 'work_finished', 'shipping_to_customer', 'delivered',
    'completed', 'cancelled',
    'sent_to_binders', 'quotes_received'
  ));

-- ---------------------------------------------------------------------------
-- 2. Messages et mises à jour
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketplace_project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  binder_id UUID REFERENCES public.marketplace_binders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'message',
  update_type TEXT,
  body TEXT NOT NULL DEFAULT '',
  important BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.marketplace_project_messages
  DROP CONSTRAINT IF EXISTS marketplace_project_messages_role_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_messages_kind_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_messages_update_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_messages_body_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_messages_binder_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_messages_important_check;

ALTER TABLE public.marketplace_project_messages
  ADD CONSTRAINT marketplace_project_messages_role_check
    CHECK (author_role IN ('customer', 'binder', 'admin')),
  ADD CONSTRAINT marketplace_project_messages_kind_check
    CHECK (kind IN ('message', 'update')),
  -- Une mise à jour d'avancement vient de l'atelier ou de Ma Reliure, et son
  -- type est facultatif ; un message n'en a jamais.
  ADD CONSTRAINT marketplace_project_messages_update_check CHECK (
    (kind = 'message' AND update_type IS NULL)
    OR (kind = 'update' AND author_role IN ('binder', 'admin')
      AND (update_type IS NULL OR update_type IN (
        'RECEIVED', 'IN_PROGRESS', 'DETAIL', 'FINISHED', 'BEFORE_RETURN'
      )))
  ),
  -- Un message dit quelque chose ; une mise à jour peut n'être qu'une photo.
  ADD CONSTRAINT marketplace_project_messages_body_check CHECK (
    char_length(body) <= 5000
    AND (kind = 'update' OR char_length(btrim(body)) > 0)
  ),
  ADD CONSTRAINT marketplace_project_messages_binder_check
    CHECK (author_role <> 'binder' OR binder_id IS NOT NULL),
  ADD CONSTRAINT marketplace_project_messages_important_check
    CHECK (NOT important OR author_role IN ('binder', 'admin'));

CREATE INDEX IF NOT EXISTS marketplace_project_messages_case_idx
  ON public.marketplace_project_messages(case_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Décisions
-- ---------------------------------------------------------------------------
-- Une question fermée, posée par l'atelier ou Ma Reliure, tranchée une fois
-- par le client. Changer d'avis crée une nouvelle décision qui remplace la
-- précédente (`supersedes_decision_id`) : l'ancienne reste, datée.

CREATE TABLE IF NOT EXISTS public.marketplace_project_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  created_by_role TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  binder_id UUID REFERENCES public.marketplace_binders(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL,
  question TEXT NOT NULL,
  description TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  gilding_text JSONB,
  allow_free_text BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'OPEN',
  selected_option_id TEXT,
  free_text_answer TEXT,
  answered_at TIMESTAMPTZ,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason TEXT,
  supersedes_decision_id UUID REFERENCES public.marketplace_project_decisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_project_decisions
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_role_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_type_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_question_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_options_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_gilding_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_open_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_answered_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_decisions_cancelled_check;

ALTER TABLE public.marketplace_project_decisions
  ADD CONSTRAINT marketplace_project_decisions_role_check
    CHECK (created_by_role IN ('binder', 'admin')),
  ADD CONSTRAINT marketplace_project_decisions_type_check CHECK (decision_type IN (
    'COLOR', 'MATERIAL', 'PAPER', 'GILDING_TEXT', 'GILDING_STYLE', 'DECOR',
    'FORMAT_DETAIL', 'TECHNICAL_CHOICE', 'OTHER'
  )),
  ADD CONSTRAINT marketplace_project_decisions_status_check
    CHECK (status IN ('OPEN', 'ANSWERED', 'CANCELLED')),
  ADD CONSTRAINT marketplace_project_decisions_question_check
    CHECK (char_length(btrim(question)) BETWEEN 3 AND 300),
  ADD CONSTRAINT marketplace_project_decisions_options_check CHECK (
    jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 1 AND 6
  ),
  ADD CONSTRAINT marketplace_project_decisions_gilding_check CHECK (
    decision_type <> 'GILDING_TEXT' OR jsonb_typeof(gilding_text) = 'object'
  ),
  ADD CONSTRAINT marketplace_project_decisions_open_check CHECK (
    status <> 'OPEN'
    OR (answered_at IS NULL AND selected_option_id IS NULL AND free_text_answer IS NULL)
  ),
  ADD CONSTRAINT marketplace_project_decisions_answered_check CHECK (
    status <> 'ANSWERED'
    OR (answered_at IS NOT NULL AND answered_by IS NOT NULL
      AND (selected_option_id IS NOT NULL OR free_text_answer IS NOT NULL))
  ),
  ADD CONSTRAINT marketplace_project_decisions_cancelled_check
    CHECK (status <> 'CANCELLED' OR cancelled_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS marketplace_project_decisions_case_idx
  ON public.marketplace_project_decisions(case_id, status);

-- Ce qui a été demandé ne se réécrit pas, et ce qui a été tranché ne se
-- modifie plus — même par le service. Sans ce verrou, « le client a confirmé
-- LES MISÉRABLES » ne vaudrait que jusqu'à la prochaine requête.
CREATE OR REPLACE FUNCTION public.marketplace_project_decisions_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'OPEN' THEN
    RAISE EXCEPTION 'A settled decision cannot change.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.decision_type IS DISTINCT FROM OLD.decision_type
     OR NEW.question IS DISTINCT FROM OLD.question
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.options IS DISTINCT FROM OLD.options
     OR NEW.gilding_text IS DISTINCT FROM OLD.gilding_text
     OR NEW.allow_free_text IS DISTINCT FROM OLD.allow_free_text THEN
    RAISE EXCEPTION 'A decision''s question and options cannot be rewritten.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_project_decisions_freeze ON public.marketplace_project_decisions;
CREATE TRIGGER marketplace_project_decisions_freeze
  BEFORE UPDATE ON public.marketplace_project_decisions
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_project_decisions_freeze();

-- ---------------------------------------------------------------------------
-- 4. Fichiers
-- ---------------------------------------------------------------------------
-- Chaque fichier est rattaché à ce qu'il illustre : un message, une option de
-- décision, un imprévu. Il vit dans un bucket privé et ne se lit que par URL
-- signée, délivrée après contrôle d'accès au fil.

CREATE TABLE IF NOT EXISTS public.marketplace_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  owner_kind TEXT NOT NULL,
  owner_id UUID NOT NULL,
  option_id TEXT,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_project_files
  DROP CONSTRAINT IF EXISTS marketplace_project_files_owner_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_files_mime_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_files_size_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_files_path_check,
  DROP CONSTRAINT IF EXISTS marketplace_project_files_role_check;

ALTER TABLE public.marketplace_project_files
  ADD CONSTRAINT marketplace_project_files_owner_check CHECK (
    owner_kind IN ('message', 'decision_option', 'scope_issue')
    AND (owner_kind = 'decision_option') = (option_id IS NOT NULL)
  ),
  ADD CONSTRAINT marketplace_project_files_mime_check CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
  )),
  ADD CONSTRAINT marketplace_project_files_size_check
    CHECK (size_bytes BETWEEN 1 AND 10485760),
  -- Un fichier ne peut pas se rattacher au dossier d'un autre : son chemin
  -- commence par le dossier auquel il appartient.
  ADD CONSTRAINT marketplace_project_files_path_check
    CHECK (storage_path LIKE 'cases/' || case_id::text || '/%'),
  ADD CONSTRAINT marketplace_project_files_role_check
    CHECK (uploaded_role IN ('customer', 'binder', 'admin'));

CREATE INDEX IF NOT EXISTS marketplace_project_files_owner_idx
  ON public.marketplace_project_files(owner_kind, owner_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-project-files',
  'marketplace-project-files',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 5. Lectures
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketplace_project_reads (
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);

ALTER TABLE public.marketplace_project_reads
  DROP CONSTRAINT IF EXISTS marketplace_project_reads_role_check;
ALTER TABLE public.marketplace_project_reads
  ADD CONSTRAINT marketplace_project_reads_role_check
    CHECK (role IN ('customer', 'binder', 'admin'));

-- ---------------------------------------------------------------------------
-- 6. Imprévus
-- ---------------------------------------------------------------------------
-- Ce que l'atelier découvre en ouvrant le livre. Visible de l'atelier et de Ma
-- Reliure seulement : le client n'apprend pas un surcoût par un artisan. Aucun
-- montant ici — un changement de périmètre repasse par le Pricebook.

CREATE TABLE IF NOT EXISTS public.marketplace_scope_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  binder_id UUID REFERENCES public.marketplace_binders(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_scope_issues
  DROP CONSTRAINT IF EXISTS marketplace_scope_issues_reason_check,
  DROP CONSTRAINT IF EXISTS marketplace_scope_issues_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_scope_issues_description_check,
  DROP CONSTRAINT IF EXISTS marketplace_scope_issues_resolved_check;

ALTER TABLE public.marketplace_scope_issues
  ADD CONSTRAINT marketplace_scope_issues_reason_check CHECK (reason IN (
    'SEWING_WORSE', 'PAPER_FRAGILE', 'EXTRA_RESTORATION', 'MATERIAL_UNAVAILABLE',
    'NOT_FEASIBLE', 'OTHER'
  )),
  ADD CONSTRAINT marketplace_scope_issues_status_check
    CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED')),
  ADD CONSTRAINT marketplace_scope_issues_description_check
    CHECK (char_length(btrim(description)) BETWEEN 3 AND 3000),
  ADD CONSTRAINT marketplace_scope_issues_resolved_check
    CHECK (status <> 'RESOLVED' OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL));

CREATE INDEX IF NOT EXISTS marketplace_scope_issues_case_idx
  ON public.marketplace_scope_issues(case_id, status);

-- ---------------------------------------------------------------------------
-- 7. Fermeture
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketplace_project_messages',
    'marketplace_project_decisions',
    'marketplace_project_files',
    'marketplace_project_reads',
    'marketplace_scope_issues'
  ] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "No direct access to %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "No direct access to %s" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t, t
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Répondre à une décision
-- ---------------------------------------------------------------------------
-- Atomique, et seulement sur une décision ouverte : deux clics, deux onglets
-- ou une requête rejouée ne produisent jamais deux réponses.

CREATE OR REPLACE FUNCTION public.marketplace_answer_project_decision(
  p_decision_id UUID,
  p_selected_option_id TEXT,
  p_free_text_answer TEXT,
  p_actor_user_id UUID
) RETURNS public.marketplace_project_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.marketplace_project_decisions;
  answered public.marketplace_project_decisions;
  free_text TEXT := nullif(btrim(coalesce(p_free_text_answer, '')), '');
BEGIN
  SELECT * INTO target
  FROM public.marketplace_project_decisions
  WHERE id = p_decision_id
  FOR UPDATE;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Decision not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF target.status <> 'OPEN' THEN
    RAISE EXCEPTION 'This decision is already settled.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_selected_option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(target.options) AS option
    WHERE option ->> 'id' = p_selected_option_id
  ) THEN
    RAISE EXCEPTION 'Unknown option.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_selected_option_id IS NULL AND (NOT target.allow_free_text OR free_text IS NULL) THEN
    RAISE EXCEPTION 'An answer is required.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_project_decisions
  SET status = 'ANSWERED',
      selected_option_id = p_selected_option_id,
      free_text_answer = free_text,
      answered_at = now(),
      answered_by = p_actor_user_id
  WHERE id = p_decision_id AND status = 'OPEN'
  RETURNING * INTO answered;

  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES
    (target.case_id, p_actor_user_id, 'decision_answered', jsonb_build_object(
      'decision_id', target.id,
      'decision_type', target.decision_type,
      'with_free_text', free_text IS NOT NULL
    )),
    (target.case_id, p_actor_user_id, 'customer_action_completed', jsonb_build_object(
      'decision_id', target.id
    ));

  RETURN answered;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_answer_project_decision(UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_answer_project_decision(UUID, TEXT, TEXT, UUID)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- Emporte les échanges et les choix des clients : à n'exécuter qu'avant tout
-- usage réel.
--
-- DROP FUNCTION IF EXISTS public.marketplace_answer_project_decision(UUID, TEXT, TEXT, UUID);
-- DROP TRIGGER IF EXISTS marketplace_project_decisions_freeze ON public.marketplace_project_decisions;
-- DROP FUNCTION IF EXISTS public.marketplace_project_decisions_freeze();
-- DROP TABLE IF EXISTS public.marketplace_scope_issues;
-- DROP TABLE IF EXISTS public.marketplace_project_reads;
-- DROP TABLE IF EXISTS public.marketplace_project_files;
-- DROP TABLE IF EXISTS public.marketplace_project_decisions;
-- DROP TABLE IF EXISTS public.marketplace_project_messages;
-- DELETE FROM storage.buckets WHERE id = 'marketplace-project-files';  -- après vidage
-- (reposer marketplace_cases_status_check sans 'work_finished', après avoir
--  requalifié les dossiers qui le portent)
