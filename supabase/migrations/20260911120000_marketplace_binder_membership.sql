-- Ma Reliure — un atelier n'est plus lié à un compte pour toujours.
--
-- `marketplace_binders.user_id UNIQUE` figeait « un atelier = un utilisateur,
-- pour toujours ». Cette migration ajoute la couche `marketplace_binder_members`
-- sans y toucher : `user_id` reste en place, en lecture seule pour le nouveau
-- code, jusqu'à ce qu'une migration ultérieure décide de le retirer une fois
-- que plus rien ne le lit. Aucune coupure des comptes existants — le backfill
-- ci-dessous transforme chaque relation actuelle en ligne OWNER équivalente.
--
-- Additive, rejouable : chaque contrainte est supprimée avant d'être reposée,
-- comme dans 20260908210000_managed_pricing_offers.sql. Rollback en pied de
-- fichier.

-- ---------------------------------------------------------------------------
-- 1. Qui appartient à quel atelier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_binder_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  -- L'état d'accès numérique de CE membre, jamais de l'atelier : un atelier
  -- peut avoir un owner actif et un member encore en invitation. Voir
  -- marketplace_binders.status plus bas pour la distinction avec la relation
  -- commerciale atelier <-> Ma Reliure, qui reste séparée.
  account_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Une personne ne tient qu'une seule fois la même casquette dans le même
  -- atelier. Rien n'empêche ici qu'un même user_id appartienne à plusieurs
  -- ateliers ; ce cas n'existe dans aucun scénario actuel et la résolution
  -- "quel atelier pour cette session" (findActiveBinderMembership) retient la
  -- plus ancienne adhésion active si jamais il s'en présentait plusieurs.
  UNIQUE (binder_id, user_id)
);

ALTER TABLE public.marketplace_binder_members
  DROP CONSTRAINT IF EXISTS marketplace_binder_members_role_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_members_account_status_check;

ALTER TABLE public.marketplace_binder_members
  ADD CONSTRAINT marketplace_binder_members_role_check
    CHECK (role IN ('OWNER', 'MEMBER')),
  ADD CONSTRAINT marketplace_binder_members_account_status_check
    CHECK (account_status IN ('invited', 'onboarding', 'active', 'disabled'));

GRANT ALL ON public.marketplace_binder_members TO service_role;
ALTER TABLE public.marketplace_binder_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_members"
  ON public.marketplace_binder_members;
CREATE POLICY "No direct access to marketplace_binder_members"
  ON public.marketplace_binder_members FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS marketplace_binder_members_binder_idx
  ON public.marketplace_binder_members(binder_id);
-- Point d'entrée de toute résolution "quel atelier pour ce compte" — la
-- requête la plus fréquente de ce fichier.
CREATE INDEX IF NOT EXISTS marketplace_binder_members_user_active_idx
  ON public.marketplace_binder_members(user_id, account_status);

DROP TRIGGER IF EXISTS marketplace_binder_members_touch ON public.marketplace_binder_members;
CREATE TRIGGER marketplace_binder_members_touch
  BEFORE UPDATE ON public.marketplace_binder_members
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- Backfill : chaque atelier déjà lié à un compte devient OWNER, avec un accès
-- déjà actif — ces personnes travaillent déjà dans /atelier aujourd'hui, leur
-- imposer un ré-onboarding serait une régression, pas une migration.
INSERT INTO public.marketplace_binder_members (binder_id, user_id, role, account_status)
SELECT id, user_id, 'OWNER', 'active'
FROM public.marketplace_binders
WHERE user_id IS NOT NULL
ON CONFLICT (binder_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Invitations — le seul chemin pour devenir membre d'un atelier
-- ---------------------------------------------------------------------------
-- Même patron que build_dossier_access_tokens : jeton haché, à usage unique,
-- expirant. Connaître l'UUID d'un atelier ne donne jamais rien ; seul le
-- jeton en clair, reçu par e-mail, le peut.
CREATE TABLE IF NOT EXISTS public.marketplace_binder_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_binder_invitations
  DROP CONSTRAINT IF EXISTS marketplace_binder_invitations_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invitations_accept_complete_check;

ALTER TABLE public.marketplace_binder_invitations
  ADD CONSTRAINT marketplace_binder_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  -- Même asymétrie que marketplace_cases_claim_complete (audit du 8
  -- septembre) : une invitation acceptée dit toujours qui et quand.
  ADD CONSTRAINT marketplace_binder_invitations_accept_complete_check CHECK (
    status <> 'accepted' OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
  );

GRANT ALL ON public.marketplace_binder_invitations TO service_role;
ALTER TABLE public.marketplace_binder_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_invitations"
  ON public.marketplace_binder_invitations;
CREATE POLICY "No direct access to marketplace_binder_invitations"
  ON public.marketplace_binder_invitations FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS marketplace_binder_invitations_binder_idx
  ON public.marketplace_binder_invitations(binder_id, status);

-- ---------------------------------------------------------------------------
-- 3. Le lien personnel d'un atelier — /a/:slug
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binders
  ADD COLUMN IF NOT EXISTS personal_referral_slug TEXT;

ALTER TABLE public.marketplace_binders
  DROP CONSTRAINT IF EXISTS marketplace_binders_referral_slug_format_check;
ALTER TABLE public.marketplace_binders
  ADD CONSTRAINT marketplace_binders_referral_slug_format_check CHECK (
    personal_referral_slug IS NULL OR personal_referral_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

-- Partiel plutôt qu'UNIQUE simple : NULL est la valeur de tous les ateliers
-- qui n'ont pas encore de lien, et NULL <> NULL en SQL ne les opposerait pas
-- de toute façon — l'index partiel le dit explicitement.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binders_referral_slug_uidx
  ON public.marketplace_binders(personal_referral_slug)
  WHERE personal_referral_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Le journal d'événements accepte des événements sans dossier
-- ---------------------------------------------------------------------------
-- Une invitation, une adhésion : ça arrive à un atelier, pas à un cas. La
-- colonne était NOT NULL parce que rien, avant ce chantier, ne journalisait
-- autre chose qu'un événement de dossier.
ALTER TABLE public.marketplace_events ALTER COLUMN case_id DROP NOT NULL;

ALTER TABLE public.marketplace_events
  DROP CONSTRAINT IF EXISTS marketplace_events_scope_check;
ALTER TABLE public.marketplace_events
  ADD CONSTRAINT marketplace_events_scope_check
    CHECK (case_id IS NOT NULL OR binder_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS marketplace_events_binder_only_idx
  ON public.marketplace_events(binder_id, created_at)
  WHERE case_id IS NULL;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.marketplace_events_binder_only_idx;
-- ALTER TABLE public.marketplace_events DROP CONSTRAINT IF EXISTS marketplace_events_scope_check;
-- ALTER TABLE public.marketplace_events ALTER COLUMN case_id SET NOT NULL;
--   -- (échouera s'il existe déjà des événements sans case_id : les supprimer
--   -- ou les migrer d'abord)
-- DROP INDEX IF EXISTS public.marketplace_binders_referral_slug_uidx;
-- ALTER TABLE public.marketplace_binders
--   DROP CONSTRAINT IF EXISTS marketplace_binders_referral_slug_format_check,
--   DROP COLUMN IF EXISTS personal_referral_slug;
-- DROP TABLE IF EXISTS public.marketplace_binder_invitations;
-- DROP TRIGGER IF EXISTS marketplace_binder_members_touch ON public.marketplace_binder_members;
-- DROP TABLE IF EXISTS public.marketplace_binder_members;
