-- Additional private proofs only. No purchase, tariff or historical-document mutation.
CREATE TABLE public.marketplace_work_logistics_labels (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.marketplace_work_logistics_events(id) ON DELETE RESTRICT,
  path text NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.marketplace_work_logistics_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_work_logistics_labels FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT ON public.marketplace_work_logistics_labels TO service_role;
CREATE TRIGGER logistics_labels_immutable BEFORE UPDATE OR DELETE ON public.marketplace_work_logistics_labels
FOR EACH ROW EXECUTE FUNCTION public.marketplace_logistics_immutable();
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('work-transport-labels-private','work-transport-labels-private',false,5242880,ARRAY['application/pdf']);
CREATE POLICY work_transport_labels_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id <> 'work-transport-labels-private')
WITH CHECK(bucket_id <> 'work-transport-labels-private');

CREATE FUNCTION public.marketplace_attach_work_transport_label(p_work uuid,p_binder uuid,p_actor uuid,p_event uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE e marketplace_work_logistics_events%ROWTYPE; v_path text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_binder_members WHERE binder_id=p_binder AND user_id=p_actor AND account_status='active') THEN RAISE EXCEPTION 'active_membership_required'; END IF;
  PERFORM 1 FROM marketplace_binder_works WHERE id=p_work AND binder_id=p_binder AND source IN ('mon_client','workshop_platform') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'own_work_not_found'; END IF;
  SELECT * INTO e FROM marketplace_work_logistics_events WHERE id=p_event AND work_id=p_work;
  IF NOT FOUND OR e.kind NOT IN ('outbound','return') OR e.details->>'mode' IS DISTINCT FROM 'parcel' THEN RAISE EXCEPTION 'parcel_event_required'; END IF;
  v_path := p_binder::text||'/'||p_work::text||'/'||p_event::text||'/'||p_id::text||'.pdf';
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='work-transport-labels-private' AND name=v_path) THEN RAISE EXCEPTION 'label_object_missing'; END IF;
  IF EXISTS(SELECT 1 FROM marketplace_work_logistics_labels WHERE id=p_id AND event_id=p_event AND actor_id=p_actor AND path=v_path) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM marketplace_work_logistics_labels WHERE id=p_id) THEN RAISE EXCEPTION 'label_retry_conflict'; END IF;
  IF (SELECT count(*) FROM marketplace_work_logistics_labels WHERE event_id=p_event)>=4 THEN RAISE EXCEPTION 'label_limit'; END IF;
  INSERT INTO marketplace_work_logistics_labels(id,event_id,path,actor_id) VALUES(p_id,p_event,v_path,p_actor);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_attach_work_transport_label(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_attach_work_transport_label(uuid,uuid,uuid,uuid,uuid) TO service_role;

-- New parcel declarations require explicit private addresses and dimensions. Existing rows remain untouched.
CREATE FUNCTION public.marketplace_validate_workshop_transport_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE w marketplace_binder_works%ROWTYPE; a jsonb; v_parcel jsonb;
BEGIN
  IF NEW.kind NOT IN ('outbound','return') OR NEW.details->>'mode' IS DISTINCT FROM 'parcel' THEN RETURN NEW; END IF;
  SELECT * INTO w FROM marketplace_binder_works WHERE id=NEW.work_id;
  IF w.source NOT IN ('mon_client','workshop_platform') THEN RETURN NEW; END IF;
  FOREACH a IN ARRAY ARRAY[NEW.details->'fromAddress',NEW.details->'toAddress'] LOOP
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR length(btrim(coalesce(a->>'name','')))<2 OR length(btrim(coalesce(a->>'line1','')))<3 OR nullif(btrim(a->>'city'),'') IS NULL
      OR coalesce(a->>'countryCode','') !~ '^[A-Z]{2}$' OR length(coalesce(a->>'postalCode',''))<2
      OR (a->>'countryCode'='FR' AND a->>'postalCode' !~ '^[0-9]{5}$') THEN RAISE EXCEPTION 'transport_address_required'; END IF;
  END LOOP;
  v_parcel:=NEW.details->'parcel';
  IF jsonb_typeof(v_parcel) IS DISTINCT FROM 'object' OR coalesce((v_parcel->>'weightGrams')::integer,0) NOT BETWEEN 1 AND 30000
    OR coalesce((v_parcel->>'lengthMm')::integer,0) NOT BETWEEN 1 AND 2000 OR coalesce((v_parcel->>'widthMm')::integer,0) NOT BETWEEN 1 AND 2000
    OR coalesce((v_parcel->>'heightMm')::integer,0) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'transport_parcel_required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_validate_workshop_transport_plan BEFORE INSERT ON public.marketplace_work_logistics_events
FOR EACH ROW EXECUTE FUNCTION public.marketplace_validate_workshop_transport_plan();

-- Repair only trusted workshop attribution. Never select an Oppe workshop,
-- override a declined/selected match, or grant access to a suspended workshop.
CREATE FUNCTION public.marketplace_repair_workshop_referral_matches() RETURNS integer
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO marketplace_case_matches(case_id,binder_id,state,invited_at)
  SELECT c.id,c.referred_binder_id,'invited',clock_timestamp()
  FROM marketplace_cases c JOIN marketplace_binders b ON b.id=c.referred_binder_id
  WHERE c.acquisition_origin IN ('BINDER_REFERRED','FINEBINDERY_PROFILE') AND b.status='approved'
  ON CONFLICT(case_id,binder_id) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_repair_workshop_referral_matches() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_repair_workshop_referral_matches() TO service_role;
SELECT public.marketplace_repair_workshop_referral_matches();
