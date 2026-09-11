-- Ma Reliure — une conversation par dossier (§14-§18 du cahier des charges
-- du 11 septembre 2026).
--
-- Un seul fil, jamais trois : client, atelier retenu et Ma Reliure y
-- écrivent tous, mais le client ne voit qu'« une conversation avec votre
-- atelier ». Rien de plus n'existe ici pour le décider — c'est
-- src/marketplace/messaging/conversation.ts et permissions.ts qui filtrent,
-- comme pour un dossier.
--
-- Additive, rejouable, même patron que les migrations précédentes.

CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Capturé au moment de l'envoi, jamais recalculé : un admin qui perd son
  -- rôle plus tard ne doit pas réécrire silencieusement l'historique d'un fil.
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attachment_paths TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  -- Suppression douce : le corps reste en base (utile pour la modération),
  -- l'affichage le remplace par « message supprimé ». Ni l'édition ni la
  -- suppression n'ont d'écran en Phase B — les colonnes existent pour ne pas
  -- redemander une migration quand l'UI arrivera.
  deleted_at TIMESTAMPTZ,
  CONSTRAINT marketplace_messages_sender_role_check
    CHECK (sender_role IN ('customer', 'binder', 'admin')),
  -- Un message porte un texte ou une pièce jointe, jamais rien du tout.
  CONSTRAINT marketplace_messages_content_check CHECK (
    char_length(body) > 0 OR array_length(attachment_paths, 1) > 0
  )
);
GRANT ALL ON public.marketplace_messages TO service_role;
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_messages" ON public.marketplace_messages;
CREATE POLICY "No direct access to marketplace_messages"
  ON public.marketplace_messages FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS marketplace_messages_case_idx
  ON public.marketplace_messages(case_id, created_at);

-- ---------------------------------------------------------------------------
-- Non-lus — §17
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_conversation_reads (
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);
GRANT ALL ON public.marketplace_conversation_reads TO service_role;
ALTER TABLE public.marketplace_conversation_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_conversation_reads"
  ON public.marketplace_conversation_reads;
CREATE POLICY "No direct access to marketplace_conversation_reads"
  ON public.marketplace_conversation_reads FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Pièces jointes — JPEG/PNG/WEBP et PDF (§16), jamais publiques
-- ---------------------------------------------------------------------------
-- Même patron que build-project-photos et marketplace-binder-photos : privé,
-- lu uniquement par URL signée mintée après vérification d'accès au dossier.
-- Le PDF est accepté ici (devis, fiche technique) — les deux autres buckets
-- ne l'acceptent pas, ce n'est pas un oubli de leur part.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-message-attachments',
  'marketplace-message-attachments',
  FALSE,
  8388608, -- 8 Mo par fichier, comme les autres buckets marketplace
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "No direct access to marketplace-message-attachments" ON storage.objects;
CREATE POLICY "No direct access to marketplace-message-attachments"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'marketplace-message-attachments' AND FALSE)
  WITH CHECK (bucket_id = 'marketplace-message-attachments' AND FALSE);

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "No direct access to marketplace-message-attachments" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'marketplace-message-attachments';
-- DROP TABLE IF EXISTS public.marketplace_conversation_reads;
-- DROP TABLE IF EXISTS public.marketplace_messages;
