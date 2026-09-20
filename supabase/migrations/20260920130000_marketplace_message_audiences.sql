-- Phase 0 / P1-6 — la séparation des audiences d'un message est PERSISTÉE.
--
-- Avant : un dossier n'avait qu'un fil ; en modèle concierge (Fine Bindery) le client ne lisait pas
-- l'atelier grâce à un filtre de lecture sur le rôle de l'auteur — l'atelier, lui, lisait tout, échanges
-- privés client ↔ concierge compris, et un atelier simplement invité y avait accès. Chaque message porte
-- désormais son audience :
--
--   shared              client · atelier retenu · plateforme  (modèle DIRECT, Ma Reliure — comme avant)
--   customer_concierge  client ↔ plateforme                   (jamais lu par un atelier)
--   workshop_platform   atelier retenu ↔ plateforme           (jamais lu par le client)
--
-- Le serveur décide de l'audience d'un nouveau message et filtre la lecture dans la requête ; le contrôle
-- d'accès au fil (atelier RETENU seulement) est appliqué par le serveur. Cette migration est additive.
--
-- STRATÉGIE POUR LES MESSAGES EXISTANTS (jamais plus d'exposition qu'avant — chaque message ne peut que
-- gagner en confidentialité) :
--   * dossier Ma Reliure  → `shared`, inchangé : c'était un fil partagé et il le reste ;
--   * dossier Fine Bindery, auteur `binder`   → `workshop_platform` (le client ne le lisait déjà pas) ;
--   * dossier Fine Bindery, auteur `customer` → `customer_concierge` (échange privé avec le concierge :
--                                                l'atelier cesse de pouvoir le lire) ;
--   * dossier Fine Bindery, auteur `admin`    → `customer_concierge` (le client le lisait ; l'atelier cesse de
--                                                pouvoir le lire — le concierge le renvoie à l'atelier si besoin).
-- La reprise ne s'applique qu'aux lignes encore `shared` d'un dossier Fine Bindery : rejouable sans effet.
--
-- PENDANT LA TRANSITION : un déclencheur classe lui-même tout message Fine Bindery inséré sans audience
-- (ancien serveur, déployé avant/après la migration) selon le même tableau. Aucune ligne Fine Bindery ne
-- peut donc naître `shared`, quel que soit l'ordre de déploiement.

ALTER TABLE public.marketplace_messages
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'shared';

ALTER TABLE public.marketplace_messages
  DROP CONSTRAINT IF EXISTS marketplace_messages_audience_check;
ALTER TABLE public.marketplace_messages
  ADD CONSTRAINT marketplace_messages_audience_check
  CHECK (audience IN ('shared', 'customer_concierge', 'workshop_platform'));

UPDATE public.marketplace_messages m
SET audience = CASE m.sender_role WHEN 'binder' THEN 'workshop_platform' ELSE 'customer_concierge' END
FROM public.marketplace_cases c
WHERE c.id = m.case_id
  AND c.brand = 'FINE_BINDERY'
  AND m.audience = 'shared';

CREATE OR REPLACE FUNCTION public.marketplace_messages_route_audience()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.audience = 'shared'
     AND EXISTS (
       SELECT 1 FROM public.marketplace_cases c
       WHERE c.id = NEW.case_id AND c.brand = 'FINE_BINDERY'
     ) THEN
    NEW.audience := CASE NEW.sender_role WHEN 'binder' THEN 'workshop_platform' ELSE 'customer_concierge' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_messages_route_audience ON public.marketplace_messages;
CREATE TRIGGER marketplace_messages_route_audience
  BEFORE INSERT ON public.marketplace_messages
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_messages_route_audience();

-- ---------------------------------------------------------------------------
-- Retour arrière (la colonne est inoffensive : l'ancien serveur l'ignore)
--
-- DROP TRIGGER IF EXISTS marketplace_messages_route_audience ON public.marketplace_messages;
-- DROP FUNCTION IF EXISTS public.marketplace_messages_route_audience();
-- ALTER TABLE public.marketplace_messages DROP CONSTRAINT IF EXISTS marketplace_messages_audience_check;
-- ---------------------------------------------------------------------------
