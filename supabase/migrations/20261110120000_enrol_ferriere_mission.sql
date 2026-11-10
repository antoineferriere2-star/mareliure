-- Inscription de la Mission « Présenter mon ouvrage » de l'atelier Ferrière
-- (PR #197) parmi les Missions qui alimentent Ma Reliure.
--
-- Pourquoi une migration : depuis 20261020100000_marketplace_grants_hardening,
-- service_role ne peut que lire marketplace_intake_missions. L'inscription,
-- donnée de référence qui décide quelles Missions produisent un dossier, ne
-- s'écrit donc plus depuis un script : `npm run seed:ferriere` a créé la Mission
-- le 10/11/2026 puis a été refusé (42501) sur cette ligne.
--
-- Sans elle, marketplace_ingest_dossier ignore la Mission : une demande faite
-- depuis le site de l'atelier resterait un Dossier Métré sans dossier Ma
-- Reliure, et n'arriverait jamais dans l'espace de l'atelier.
--
-- Idempotente et sans effet là où la Mission n'existe pas (environnement neuf,
-- seed pas encore passé) : la ligne n'est insérée que si la Mission existe.
-- Pas de rattrapage ici : marketplace_ingest_missing_cases() porte sur toutes
-- les Missions inscrites. La Mission n'a reçu aucune demande avant cette
-- inscription (aucune page publique ne la montrait) ; le vérifier avant de
-- l'appliquer (SELECT count(*) FROM build_dossiers WHERE mission_id = …014).

INSERT INTO public.marketplace_intake_missions (mission_id, vertical_id, brand)
SELECT m.id, 'bookbinding', 'MA_RELIURE'
FROM public.build_missions m
WHERE m.id = '00000000-0000-4000-8000-000000000014'
ON CONFLICT (mission_id) DO NOTHING;

-- Retour arrière :
-- DELETE FROM public.marketplace_intake_missions
--   WHERE mission_id = '00000000-0000-4000-8000-000000000014';
