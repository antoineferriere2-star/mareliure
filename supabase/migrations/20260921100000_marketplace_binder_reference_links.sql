-- Ma Reliure — Référentiel métier (PR 2a) : le lien FACULTATIF entre une prestation d'atelier et une
-- opération du référentiel, le favori, et la provenance recopiée sur les lignes de devis.
--
-- Le référentiel lui-même n'est PAS en base : c'est une ressource versionnée dans le code
-- (`src/marketplace/reference/reliure-fr-v1/`). Cette migration ne crée donc AUCUNE table de
-- référentiel et n'écrit aucune donnée. Elle ajoute seulement :
--
--   * `marketplace_binder_services`  : `reference_version`, `reference_operation_key`, `is_favorite`
--   * `marketplace_binder_quote_items` : `reference_version`, `reference_operation_key`
--
-- Règles :
--   * (version, clé) sont soit TOUS DEUX présents, soit TOUS DEUX absents (CHECK). Une prestation
--     personnelle reste parfaitement possible : les deux colonnes sont alors NULL.
--   * la clé est une identité stable `OPR-0000`, jamais un slug (CHECK de format).
--   * le lien n'est PAS une clé étrangère : il pointe une ressource du code, pas une ligne de base. Une
--     mise à jour du référentiel (`reliure-fr-v2`) ne peut donc jamais modifier ni casser une prestation
--     ou un devis ; une clé disparue se lit « retirée du référentiel ».
--   * les lignes de devis gardent leurs SNAPSHOTS (libellé, unité, quantité, prix) : la provenance est
--     une information, jamais une source de vérité. Les FACTURES ne sont pas touchées (ni leur table, ni
--     leur trigger d'immutabilité, ni la fonction de conversion de la Phase 0).
--
-- Isolation inchangée : ces deux tables sont déjà RLS deny-all, accès service-role, contrôle explicite de
-- `binder_id` par le serveur. Aucune politique, aucun droit, aucune fonction n'est modifié.
--
-- Additive et rejouable. Aucune reprise de données. Rollback en pied de fichier.

-- ---------------------------------------------------------------------------
-- 1. Prestations de l'atelier
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binder_services
  ADD COLUMN IF NOT EXISTS reference_version TEXT,
  ADD COLUMN IF NOT EXISTS reference_operation_key TEXT,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.marketplace_binder_services
  DROP CONSTRAINT IF EXISTS marketplace_binder_services_reference_link_check;
ALTER TABLE public.marketplace_binder_services
  ADD CONSTRAINT marketplace_binder_services_reference_link_check
    CHECK (
      (reference_version IS NULL) = (reference_operation_key IS NULL)
      AND (reference_version IS NULL OR reference_version ~ '^[a-z0-9][a-z0-9-]{1,39}$')
      AND (reference_operation_key IS NULL OR reference_operation_key ~ '^OPR-[0-9]{4}$')
    );

-- Les favoris d'un atelier (peu nombreux : index partiel) et « quelles prestations viennent de cette opération ».
CREATE INDEX IF NOT EXISTS marketplace_binder_services_favorite_idx
  ON public.marketplace_binder_services(binder_id) WHERE is_favorite;
CREATE INDEX IF NOT EXISTS marketplace_binder_services_reference_idx
  ON public.marketplace_binder_services(binder_id, reference_operation_key) WHERE reference_operation_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Lignes de devis : la provenance, recopiée à la création de la ligne
-- ---------------------------------------------------------------------------
-- Nullables, sans défaut : une ligne libre, ou d'une prestation personnelle, n'a pas de provenance.
-- `marketplace_binder_create_quote` / `_update_quote` recopient les lignes par `jsonb_populate_record` :
-- elles prennent ces colonnes sans changement (vérifié sur un vrai Postgres).
ALTER TABLE public.marketplace_binder_quote_items
  ADD COLUMN IF NOT EXISTS reference_version TEXT,
  ADD COLUMN IF NOT EXISTS reference_operation_key TEXT;

ALTER TABLE public.marketplace_binder_quote_items
  DROP CONSTRAINT IF EXISTS marketplace_binder_quote_items_reference_link_check;
ALTER TABLE public.marketplace_binder_quote_items
  ADD CONSTRAINT marketplace_binder_quote_items_reference_link_check
    CHECK (
      (reference_version IS NULL) = (reference_operation_key IS NULL)
      AND (reference_version IS NULL OR reference_version ~ '^[a-z0-9][a-z0-9-]{1,39}$')
      AND (reference_operation_key IS NULL OR reference_operation_key ~ '^OPR-[0-9]{4}$')
    );

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- DROP INDEX IF EXISTS public.marketplace_binder_services_reference_idx;
-- DROP INDEX IF EXISTS public.marketplace_binder_services_favorite_idx;
-- ALTER TABLE public.marketplace_binder_quote_items DROP CONSTRAINT IF EXISTS marketplace_binder_quote_items_reference_link_check;
-- ALTER TABLE public.marketplace_binder_quote_items DROP COLUMN IF EXISTS reference_version, DROP COLUMN IF EXISTS reference_operation_key;
-- ALTER TABLE public.marketplace_binder_services DROP CONSTRAINT IF EXISTS marketplace_binder_services_reference_link_check;
-- ALTER TABLE public.marketplace_binder_services DROP COLUMN IF EXISTS reference_version, DROP COLUMN IF EXISTS reference_operation_key, DROP COLUMN IF EXISTS is_favorite;
-- (Ne pas exécuter si des ateliers ont déjà des favoris ou des liens : ce sont leurs données.)
-- ---------------------------------------------------------------------------
