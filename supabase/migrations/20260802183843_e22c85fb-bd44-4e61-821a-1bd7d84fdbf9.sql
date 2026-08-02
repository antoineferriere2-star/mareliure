CREATE TABLE public.build_page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path text NOT NULL,
  referrer_host text,
  locale text,
  device text,
  visitor_hash text,
  session_hash text,
  is_new_session boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.build_page_views TO service_role;

ALTER TABLE public.build_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to build_page_views"
  ON public.build_page_views
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX build_page_views_created_at_idx ON public.build_page_views (created_at DESC);
CREATE INDEX build_page_views_path_idx ON public.build_page_views (path);