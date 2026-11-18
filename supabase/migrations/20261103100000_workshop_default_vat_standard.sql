-- Avis de l'expert-comptable du 3 novembre 2026 : le 5,5 % ne vaut que pour la reliure d'un
-- livre et ses accessoires ; une réparation autonome, un contenant vendu seul ou un album vierge
-- relèvent de 20 %. Tant que chaque opération n'est pas qualifiée, le défaut redevient 20 %.
-- Seuls les nouveaux profils sont concernés : aucun taux enregistré ni aucune pièce n'est modifié.
ALTER TABLE public.marketplace_binder_billing_profiles
  ALTER COLUMN default_vat_rate_bps SET DEFAULT 2000;
