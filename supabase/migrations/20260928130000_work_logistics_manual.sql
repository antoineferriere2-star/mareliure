-- Manual declarations only. No payment, transport purchase or insurance promise.
CREATE TABLE public.marketplace_work_logistics_events (
  id uuid PRIMARY KEY,
  work_id uuid NOT NULL REFERENCES public.marketplace_binder_works(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  kind text NOT NULL CHECK(kind IN ('outbound','carrier_delivered','received','return','completed','incident','note')),
  details jsonb NOT NULL,
  UNIQUE(work_id,sequence)
);
CREATE TABLE public.marketplace_work_logistics_photos (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.marketplace_work_logistics_events(id) ON DELETE RESTRICT,
  path text NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.marketplace_work_logistics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_work_logistics_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_work_logistics_events,public.marketplace_work_logistics_photos FROM anon,authenticated;
GRANT SELECT,INSERT ON public.marketplace_work_logistics_events,public.marketplace_work_logistics_photos TO service_role;
CREATE FUNCTION public.marketplace_logistics_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'logistics_history_immutable'; END $$;
CREATE TRIGGER logistics_events_immutable BEFORE UPDATE OR DELETE ON public.marketplace_work_logistics_events
FOR EACH ROW EXECUTE FUNCTION public.marketplace_logistics_immutable();
CREATE TRIGGER logistics_photos_immutable BEFORE UPDATE OR DELETE ON public.marketplace_work_logistics_photos
FOR EACH ROW EXECUTE FUNCTION public.marketplace_logistics_immutable();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('work-logistics-private','work-logistics-private',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
-- No browser Storage policy: upload/read only through authenticated server functions.
-- Restrictive also defeats an unrelated broad permissive policy on storage.objects.
CREATE POLICY logistics_private_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id <> 'work-logistics-private')
WITH CHECK(bucket_id <> 'work-logistics-private');

CREATE FUNCTION public.marketplace_work_logistics(p_work uuid,p_binder uuid,p_actor uuid,p_action text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_seq integer; v_kind text; v_state text; v_id uuid; v_event marketplace_work_logistics_events%ROWTYPE;
  v_details jsonb; v_path text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_binder_members WHERE binder_id=p_binder AND user_id=p_actor AND account_status='active') THEN
    RAISE EXCEPTION 'active_membership_required';
  END IF;
  -- Serializes transitions, retries and photo attachment for this work, not all ateliers.
  PERFORM 1 FROM marketplace_binder_works WHERE id=p_work AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'work_not_found'; END IF;
  SELECT coalesce(max(sequence),0) INTO v_seq FROM marketplace_work_logistics_events WHERE work_id=p_work;
  SELECT kind INTO v_state FROM marketplace_work_logistics_events WHERE work_id=p_work
    AND kind NOT IN ('note','incident','carrier_delivered') ORDER BY sequence DESC LIMIT 1;
  IF p_action='append' THEN
    v_id := (p_data->>'id')::uuid; v_kind := p_data->>'kind'; v_details := p_data->'details';
    SELECT * INTO v_event FROM marketplace_work_logistics_events WHERE id=v_id;
    IF FOUND THEN
      IF v_event.work_id<>p_work OR v_event.actor_id<>p_actor OR v_event.kind IS DISTINCT FROM v_kind
        OR v_event.details IS DISTINCT FROM v_details THEN RAISE EXCEPTION 'retry_conflict'; END IF;
    ELSE
      IF (p_data->>'version')::integer IS DISTINCT FROM v_seq THEN RAISE EXCEPTION 'logistics_changed_reload'; END IF;
      IF jsonb_typeof(v_details) IS DISTINCT FROM 'object' OR length(v_details::text)>6000 THEN RAISE EXCEPTION 'invalid_details'; END IF;
      IF v_kind IN ('outbound','return') THEN
        IF (v_kind='outbound' AND v_state IS NOT NULL) OR (v_kind='return' AND v_state IS DISTINCT FROM 'received') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
        IF v_details->>'mode' IS NULL OR v_details->>'mode' NOT IN ('parcel','hand') THEN RAISE EXCEPTION 'mode_required'; END IF;
        IF v_details->>'mode'='parcel' AND (length(btrim(coalesce(v_details->>'carrier','')))<1 OR length(btrim(coalesce(v_details->>'tracking','')))<1) THEN RAISE EXCEPTION 'tracking_required'; END IF;
      ELSIF v_kind='carrier_delivered' THEN
        IF v_state IS DISTINCT FROM 'outbound' AND v_state IS DISTINCT FROM 'return' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
        IF NOT EXISTS(SELECT 1 FROM marketplace_work_logistics_events WHERE work_id=p_work AND kind=v_state AND details->>'mode'='parcel') THEN RAISE EXCEPTION 'parcel_required'; END IF;
        IF length(btrim(coalesce(v_details->>'proof','')))<8 THEN RAISE EXCEPTION 'proof_required'; END IF;
      ELSIF v_kind='received' THEN
        IF v_state IS DISTINCT FROM 'outbound' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
        IF v_details->>'condition' IS NULL OR v_details->>'condition' NOT IN ('consistent','difference') THEN RAISE EXCEPTION 'condition_required'; END IF;
        IF v_details->>'condition'='difference' AND length(btrim(coalesce(v_details->>'description','')))<8 THEN RAISE EXCEPTION 'description_required'; END IF;
      ELSIF v_kind='completed' THEN
        IF v_state IS DISTINCT FROM 'return' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
        IF length(btrim(coalesce(v_details->>'proof','')))<8 THEN RAISE EXCEPTION 'proof_required'; END IF;
      ELSIF v_kind IN ('incident','note') THEN
        IF length(btrim(coalesce(v_details->>'description','')))<8 THEN RAISE EXCEPTION 'description_required'; END IF;
      ELSE RAISE EXCEPTION 'invalid_kind'; END IF;
      INSERT INTO marketplace_work_logistics_events(id,work_id,sequence,actor_id,kind,details)
      VALUES(v_id,p_work,v_seq+1,p_actor,v_kind,v_details);
    END IF;
  ELSIF p_action='photo' THEN
    SELECT * INTO v_event FROM marketplace_work_logistics_events WHERE id=(p_data->>'event')::uuid AND work_id=p_work;
    IF NOT FOUND OR v_event.kind NOT IN ('received','incident') THEN RAISE EXCEPTION 'photo_event_required'; END IF;
    v_id := (p_data->>'id')::uuid; v_path := p_binder::text||'/'||p_work::text||'/'||v_event.id::text||'/'||v_id::text;
    IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='work-logistics-private' AND name=v_path) THEN RAISE EXCEPTION 'photo_missing'; END IF;
    IF NOT EXISTS(SELECT 1 FROM marketplace_work_logistics_photos WHERE id=v_id AND event_id=v_event.id AND path=v_path AND actor_id=p_actor) THEN
      IF (SELECT count(*) FROM marketplace_work_logistics_photos WHERE event_id=v_event.id)>=8 THEN RAISE EXCEPTION 'photo_limit'; END IF;
      INSERT INTO marketplace_work_logistics_photos(id,event_id,path,actor_id) VALUES(v_id,v_event.id,v_path,p_actor);
    END IF;
  ELSIF p_action IS DISTINCT FROM 'read' THEN RAISE EXCEPTION 'invalid_action'; END IF;
  RETURN (SELECT jsonb_build_object('events',coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('photos',
    (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at),'[]'::jsonb) FROM marketplace_work_logistics_photos p WHERE p.event_id=e.id)) ORDER BY e.sequence),'[]'::jsonb))
    FROM marketplace_work_logistics_events e WHERE e.work_id=p_work);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_work_logistics(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_work_logistics(uuid,uuid,uuid,text,jsonb) TO service_role;
