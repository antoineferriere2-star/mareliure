-- Essai gratuit de 15 jours à l'inscription d'un atelier, sans carte bancaire
-- (pivot du 22 novembre 2026).
--
-- Rien ne bloque tant que l'abonnement payant n'est pas ouvert : marketplace_workshop_can_create
-- reste vrai quand NOT subscription_open. L'essai ne produit donc aucun effet de blocage
-- aujourd'hui ; il fixe la date de fin que l'on affichera, et la fin d'essai (lecture seule :
-- plus de création de devis, de facture ni de publication de vitrine) s'applique le jour où
-- subscription_open est ouvert. Consultation et téléchargement restent toujours possibles.

ALTER TABLE public.marketplace_binder_subscriptions ADD COLUMN trial_ends_at timestamptz;

-- Les ateliers déjà inscrits (premier cercle d'ateliers, Ferrière comprise) restent gratuits :
-- aucun essai ne leur est appliqué et ils ne seront pas limités à l'ouverture de l'abonnement.
-- Seules les lignes sans abonnement Stripe sont touchées ; un atelier qui a déjà souscrit
-- conserve son état.
UPDATE public.marketplace_binder_subscriptions
SET legacy_free = true, updated_at = now()
WHERE legacy_free = false AND stripe_subscription_id IS NULL AND trial_ends_at IS NULL;

-- Tout nouvel atelier démarre avec 15 jours d'essai.
CREATE OR REPLACE FUNCTION public.marketplace_init_workshop_subscription() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  INSERT INTO public.marketplace_binder_subscriptions(binder_id, legacy_free, trial_ends_at)
  VALUES (NEW.id, false, now() + interval '15 days');
  RETURN NEW;
END $$;

-- Un essai en cours autorise la création au même titre qu'un abonnement actif.
CREATE OR REPLACE FUNCTION public.marketplace_workshop_can_create(p_binder_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_binder_subscriptions s
    CROSS JOIN public.marketplace_workshop_offer_settings o
    WHERE s.binder_id = p_binder_id AND (NOT o.subscription_open OR s.legacy_free
      OR s.trial_ends_at > now()
      OR (s.status IN ('active','trialing') AND s.current_period_end > now())))
$$;
