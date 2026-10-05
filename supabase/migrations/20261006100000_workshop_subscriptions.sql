-- Activité B. Ouverture explicite après configuration Stripe et recette.
CREATE TABLE public.marketplace_workshop_offer_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  subscription_open boolean NOT NULL DEFAULT false,
  online_payment_open boolean NOT NULL DEFAULT false
);
INSERT INTO public.marketplace_workshop_offer_settings(id) VALUES (true);
CREATE TABLE public.marketplace_binder_subscriptions (
  binder_id uuid PRIMARY KEY REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  legacy_free boolean NOT NULL DEFAULT false,
  transition_accepted_at timestamptz,
  transition_accepted_by uuid REFERENCES auth.users(id),
  terms_version text,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  checkout_session_id text UNIQUE,
  checkout_expires_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_event_created bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.marketplace_binder_subscriptions(binder_id, legacy_free)
SELECT id, true FROM public.marketplace_binders;
CREATE FUNCTION public.marketplace_init_workshop_subscription() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  INSERT INTO public.marketplace_binder_subscriptions(binder_id, legacy_free)
  SELECT NEW.id, NOT subscription_open FROM public.marketplace_workshop_offer_settings WHERE id;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_init_workshop_subscription AFTER INSERT ON public.marketplace_binders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_init_workshop_subscription();

CREATE FUNCTION public.marketplace_workshop_can_create(p_binder_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_binder_subscriptions s
    CROSS JOIN public.marketplace_workshop_offer_settings o
    WHERE s.binder_id = p_binder_id AND (NOT o.subscription_open OR s.legacy_free OR
      (s.status IN ('active','trialing') AND s.current_period_end > now())))
$$;
CREATE FUNCTION public.marketplace_require_workshop_subscription() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  IF NOT public.marketplace_workshop_can_create(NEW.binder_id) THEN
    RAISE EXCEPTION 'workshop_subscription_required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workshop_quote_subscription BEFORE INSERT OR UPDATE ON public.marketplace_binder_quotes
FOR EACH ROW EXECUTE FUNCTION public.marketplace_require_workshop_subscription();
CREATE TRIGGER workshop_invoice_subscription BEFORE INSERT ON public.marketplace_binder_invoices
FOR EACH ROW EXECUTE FUNCTION public.marketplace_require_workshop_subscription();
CREATE TRIGGER workshop_issue_subscription BEFORE UPDATE ON public.marketplace_binder_invoices
FOR EACH ROW WHEN (OLD.status = 'draft') EXECUTE FUNCTION public.marketplace_require_workshop_subscription();
CREATE FUNCTION public.marketplace_require_profile_subscription() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  IF NEW.public_profile_status = 'published' AND NOT public.marketplace_workshop_can_create(NEW.id) THEN
    RAISE EXCEPTION 'workshop_subscription_required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workshop_profile_subscription BEFORE UPDATE OF public_profile_status ON public.marketplace_binders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_require_profile_subscription();
CREATE FUNCTION public.marketplace_require_portfolio_subscription() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF NEW.is_published AND NOT public.marketplace_workshop_can_create(NEW.binder_id) THEN RAISE EXCEPTION 'workshop_subscription_required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workshop_portfolio_subscription BEFORE INSERT OR UPDATE ON marketplace_binder_portfolio
FOR EACH ROW EXECUTE FUNCTION marketplace_require_portfolio_subscription();

-- Réservation sérialisée : un seul Checkout ouvert par atelier. Un abandon conserve la gratuité.
CREATE FUNCTION public.marketplace_reserve_workshop_checkout(p_binder_id uuid, p_user_id uuid, p_terms_version text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.marketplace_binder_subscriptions%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_workshop_offer_settings WHERE subscription_open) THEN
    RAISE EXCEPTION 'workshop_subscription_closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_binder_members WHERE binder_id=p_binder_id
    AND user_id=p_user_id AND role='OWNER' AND account_status='active') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO STRICT s FROM public.marketplace_binder_subscriptions WHERE binder_id=p_binder_id FOR UPDATE;
  IF s.stripe_subscription_id IS NOT NULL AND s.status NOT IN ('canceled','incomplete_expired') THEN
    RAISE EXCEPTION 'workshop_subscription_exists'; END IF;
  IF s.checkout_expires_at IS NULL OR s.checkout_expires_at <= now() THEN
    UPDATE public.marketplace_binder_subscriptions SET checkout_session_id=NULL,
      checkout_expires_at=now()+interval '1 hour', transition_accepted_at=now(),
      transition_accepted_by=p_user_id, terms_version=p_terms_version, updated_at=now()
    WHERE binder_id=p_binder_id RETURNING * INTO s;
  END IF;
  RETURN to_jsonb(s);
END $$;
CREATE FUNCTION public.marketplace_sync_workshop_subscription(p_binder_id uuid, p_snapshot jsonb, p_event_created bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.marketplace_binder_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM public.marketplace_binder_subscriptions WHERE binder_id=p_binder_id FOR UPDATE;
  IF p_event_created < s.last_event_created THEN RETURN; END IF;
  IF s.transition_accepted_at IS NULL OR s.stripe_customer_id IS DISTINCT FROM (p_snapshot->>'customer') THEN
    RAISE EXCEPTION 'workshop_subscription_mismatch'; END IF;
  IF s.stripe_subscription_id IS NOT NULL AND s.stripe_subscription_id <> p_snapshot->>'id'
     AND s.status NOT IN ('canceled','incomplete_expired') THEN RAISE EXCEPTION 'duplicate_subscription'; END IF;
  UPDATE public.marketplace_binder_subscriptions SET
    stripe_subscription_id=p_snapshot->>'id', status=p_snapshot->>'status',
    current_period_end=(p_snapshot->>'period_end')::timestamptz,
    cancel_at_period_end=(p_snapshot->>'cancel_at_period_end')::boolean,
    legacy_free=CASE WHEN p_snapshot->>'status' IN ('active','trialing') THEN false ELSE legacy_free END,
    last_event_created=p_event_created, updated_at=now() WHERE binder_id=p_binder_id;
  IF NOT public.marketplace_workshop_can_create(p_binder_id) THEN
    UPDATE public.marketplace_binders SET public_profile_status='draft', public_profile_published_at=NULL WHERE id=p_binder_id;
    UPDATE public.marketplace_binder_portfolio SET is_published=false WHERE binder_id=p_binder_id AND is_published;
  END IF;
END $$;
ALTER TABLE public.marketplace_workshop_offer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_binder_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_workshop_offer_settings, public.marketplace_binder_subscriptions FROM anon, authenticated;
GRANT ALL ON public.marketplace_workshop_offer_settings, public.marketplace_binder_subscriptions TO service_role;
REVOKE ALL ON FUNCTION public.marketplace_workshop_can_create(uuid), public.marketplace_reserve_workshop_checkout(uuid,uuid,text), public.marketplace_sync_workshop_subscription(uuid,jsonb,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_workshop_can_create(uuid), public.marketplace_reserve_workshop_checkout(uuid,uuid,text), public.marketplace_sync_workshop_subscription(uuid,jsonb,bigint) TO service_role;
-- Retour arrière : fermer subscription_open ; conserver preuves et identifiants de facturation.
