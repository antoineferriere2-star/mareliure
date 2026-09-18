-- Décision fiscale temporaire validée par l'utilisateur (18 septembre
-- 2026) : la TVA française standard (20 %) s'applique automatiquement à
-- tout dossier facturé en France (particulier ou professionnel), pour
-- débloquer les ventes Ma Reliure sans attendre une politique fiscale
-- internationale — qui, elle, reste `MANUAL_TAX_REVIEW` (aucun changement
-- pour l'UE hors France, ni pour hors UE).
--
-- Additif : élargit seulement `tax_validation_source` à une nouvelle
-- valeur, et assouplit la contrainte de cohérence pour cette seule
-- source. `MANUAL_TAX_REVIEW` reste, comme avant, la seule valeur
-- possible sans une des deux formes de validation tracée.
--
-- `tax_validated_by` reste NULL pour une validation automatique — ce
-- n'est délibérément pas un admin qui valide (§4 du brief : "tax_validated_by
-- = SYSTEM_POLICY ou équivalent auditable"). Un UUID inventé violerait la
-- contrainte de clé étrangère vers auth.users ; `tax_validation_source =
-- 'FR_STANDARD_VAT_20'` porte déjà cette information de façon auditable et
-- sans ambiguïté (jamais confondue avec une validation humaine, dont la
-- source reste 'manual_admin_review').

ALTER TABLE public.marketplace_commercial_proposals
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_source_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_consistency_check;

ALTER TABLE public.marketplace_commercial_proposals
  ADD CONSTRAINT marketplace_commercial_proposals_tax_validation_source_check
    CHECK (tax_validation_source IS NULL OR tax_validation_source IN (
      'manual_admin_review', 'FR_STANDARD_VAT_20'
    )),
  ADD CONSTRAINT marketplace_commercial_proposals_tax_validation_consistency_check
    CHECK (
      (tax_validated_at IS NULL AND tax_validated_by IS NULL AND tax_validation_source IS NULL)
      OR (tax_validation_source = 'FR_STANDARD_VAT_20' AND tax_validated_at IS NOT NULL AND tax_validated_by IS NULL)
      OR (
        tax_validation_source = 'manual_admin_review'
        AND tax_validated_at IS NOT NULL
        AND tax_validated_by IS NOT NULL
      )
    );

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- À n'exécuter que si aucune proposition n'a encore été validée avec
-- tax_validation_source = 'FR_STANDARD_VAT_20'.
--
-- ALTER TABLE public.marketplace_commercial_proposals
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_consistency_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_source_check,
--   ADD CONSTRAINT marketplace_commercial_proposals_tax_validation_source_check
--     CHECK (tax_validation_source IS NULL OR tax_validation_source IN ('manual_admin_review')),
--   ADD CONSTRAINT marketplace_commercial_proposals_tax_validation_consistency_check
--     CHECK (
--       (tax_validated_at IS NULL AND tax_validated_by IS NULL AND tax_validation_source IS NULL)
--       OR (tax_validated_at IS NOT NULL AND tax_validated_by IS NOT NULL AND tax_validation_source IS NOT NULL)
--     );
-- ---------------------------------------------------------------------------
