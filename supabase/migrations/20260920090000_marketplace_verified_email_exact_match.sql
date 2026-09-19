-- Phase 0 / P1-7 — rapprochement e-mail : égalité exacte sur une adresse normalisée.
--
-- Avant : le serveur demandait `ilike("visitor_email", <adresse vérifiée>)`. ILIKE est un opérateur de
-- MOTIF : `_` remplace un caractère quelconque et `%` une suite quelconque. Un compte vérifié
-- « marie_dupont@example.com » rattachait aussi le Dossier saisi « marieXdupont@example.com ».
--
-- Après : cette fonction, appelée par le seul serveur (service_role), compare
--   lower(btrim(visitor_email)) = lower(btrim(p_email))
-- — une égalité, jamais un motif. Additive : aucune table, aucune donnée modifiée.

CREATE OR REPLACE FUNCTION public.marketplace_dossier_ids_for_verified_email(p_email text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT d.id
  FROM public.build_dossiers d
  WHERE btrim(coalesce(p_email, ''), E' \t\r\n') <> ''
    AND lower(btrim(d.visitor_email, E' \t\r\n')) = lower(btrim(p_email, E' \t\r\n'))
$$;

-- Jamais appelable depuis un navigateur : l'appartenance se décide côté serveur.
REVOKE ALL ON FUNCTION public.marketplace_dossier_ids_for_verified_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_dossier_ids_for_verified_email(text) TO service_role;

-- L'égalité passe par une expression : sans index elle parcourrait toute la table à chaque ouverture de liste.
CREATE INDEX IF NOT EXISTS build_dossiers_visitor_email_normalized_idx
  ON public.build_dossiers (lower(btrim(visitor_email, E' \t\r\n')))
  WHERE visitor_email IS NOT NULL;
