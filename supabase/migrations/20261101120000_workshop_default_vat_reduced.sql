-- Décision du 1er novembre 2026 : un atelier reçoit 5,5 % comme taux proposé par défaut.
-- Seuls les nouveaux profils sont concernés : aucun taux enregistré ni aucune pièce n'est modifié.
ALTER TABLE public.marketplace_binder_billing_profiles
  ALTER COLUMN default_vat_rate_bps SET DEFAULT 550;
