-- Ma Reliure — la page /partenaires-relieurs (12-15 septembre 2026) apporte
-- son propre formulaire, plus court que /candidature-atelier
-- (prénom/nom/atelier/ville/e-mail/téléphone/site ou réseau/savoir-faire/
-- années d'expérience/message), sans type d'entreprise ni CA. Les deux
-- écrivent dans la même table : une candidature reste une candidature quel
-- que soit le formulaire d'où elle vient, et l'admin la lit au même endroit.
--
-- legal_entity_type devient donc facultatif — /partenaires-relieurs ne le
-- demande pas — sans rien retirer à /candidature-atelier, qui continue de
-- l'envoyer.

ALTER TABLE public.marketplace_binder_applications
  ALTER COLUMN legal_entity_type DROP NOT NULL;

ALTER TABLE public.marketplace_binder_applications
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.marketplace_binder_applications
  DROP CONSTRAINT IF EXISTS marketplace_binder_applications_legal_entity_check;
ALTER TABLE public.marketplace_binder_applications
  ADD CONSTRAINT marketplace_binder_applications_legal_entity_check CHECK (
    legal_entity_type IS NULL OR legal_entity_type IN (
      'auto_entrepreneur', 'ei', 'eirl', 'eurl', 'sarl', 'sas', 'autre'
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.marketplace_binder_applications
--   DROP COLUMN IF EXISTS skills,
--   DROP COLUMN IF EXISTS website_url;
-- -- Remettre NOT NULL exige d'abord de combler les lignes où il est NULL.
