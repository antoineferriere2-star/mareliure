-- Préférences tarifaires des ateliers sur les 45 prestations commerciales.
-- Un montant NULL signifie explicitement « suivre le tarif Ma Reliure ».

CREATE TABLE IF NOT EXISTS public.marketplace_binder_price_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  pricing_key TEXT NOT NULL REFERENCES public.marketplace_work_items(key),
  custom_unit_price_cents INTEGER,
  custom_pricing_mode TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (binder_id, pricing_key),
  CONSTRAINT marketplace_binder_price_preferences_key_check
    CHECK (pricing_key ~ '^[a-z0-9_]{2,80}$'),
  CONSTRAINT marketplace_binder_price_preferences_price_check
    CHECK (custom_unit_price_cents IS NULL OR custom_unit_price_cents >= 0),
  CONSTRAINT marketplace_binder_price_preferences_mode_check
    CHECK (custom_pricing_mode IS NULL OR custom_pricing_mode IN ('fixed', 'unit', 'starting_from')),
  CONSTRAINT marketplace_binder_price_preferences_override_check
    CHECK ((custom_unit_price_cents IS NULL) = (custom_pricing_mode IS NULL))
);

CREATE INDEX IF NOT EXISTS marketplace_binder_price_preferences_binder_idx
  ON public.marketplace_binder_price_preferences(binder_id, pricing_key);

DROP TRIGGER IF EXISTS marketplace_binder_price_preferences_touch ON public.marketplace_binder_price_preferences;
CREATE TRIGGER marketplace_binder_price_preferences_touch
  BEFORE UPDATE ON public.marketplace_binder_price_preferences
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

ALTER TABLE public.marketplace_binder_price_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_binder_price_preferences"
  ON public.marketplace_binder_price_preferences
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
GRANT ALL ON public.marketplace_binder_price_preferences TO service_role;
