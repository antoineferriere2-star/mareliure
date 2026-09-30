BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.marketplace_work_logistics_photos, public.marketplace_work_logistics_events, public.marketplace_binder_works IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE cleanup_counts AS SELECT
 (SELECT count(*) FROM public.marketplace_work_logistics_photos) photos,
 (SELECT count(*) FROM public.marketplace_work_logistics_events) events,
 (SELECT count(*) FROM public.marketplace_binder_works) works;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.marketplace_binder_works WHERE id='41bd977d-405c-4196-bb13-9999e260838c' AND binder_id='d6c095c0-2cff-4ee9-9393-8891c5d8c03c' AND title='QA temporaire CPU 20260930')<>1 THEN RAISE EXCEPTION 'fixture_mismatch'; END IF;
 IF (SELECT count(*) FROM public.marketplace_work_logistics_events WHERE work_id='41bd977d-405c-4196-bb13-9999e260838c')<>1 THEN RAISE EXCEPTION 'event_drift'; END IF;
 IF (SELECT count(*) FROM public.marketplace_work_logistics_photos WHERE event_id='0222a0f8-0fe7-4a30-8845-2b9e3968be7d')<>2 THEN RAISE EXCEPTION 'photo_drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname IN ('logistics_photos_immutable','logistics_events_immutable') AND tgenabled<>'O') THEN RAISE EXCEPTION 'trigger_state_drift'; END IF;
END $$;
ALTER TABLE public.marketplace_work_logistics_photos DISABLE TRIGGER logistics_photos_immutable;
ALTER TABLE public.marketplace_work_logistics_events DISABLE TRIGGER logistics_events_immutable;
DELETE FROM public.marketplace_work_logistics_photos WHERE event_id='0222a0f8-0fe7-4a30-8845-2b9e3968be7d' AND id IN ('1542aa7d-1c57-8aad-8a53-9b68253dd0ce','4246018f-5248-859b-b811-3725075ec5b7');
DELETE FROM public.marketplace_work_logistics_events WHERE id='0222a0f8-0fe7-4a30-8845-2b9e3968be7d' AND work_id='41bd977d-405c-4196-bb13-9999e260838c';
DELETE FROM public.marketplace_binder_works WHERE id='41bd977d-405c-4196-bb13-9999e260838c';
ALTER TABLE public.marketplace_work_logistics_photos ENABLE TRIGGER logistics_photos_immutable;
ALTER TABLE public.marketplace_work_logistics_events ENABLE TRIGGER logistics_events_immutable;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.marketplace_work_logistics_photos)<>(SELECT photos-2 FROM cleanup_counts) OR (SELECT count(*) FROM public.marketplace_work_logistics_events)<>(SELECT events-1 FROM cleanup_counts) OR (SELECT count(*) FROM public.marketplace_binder_works)<>(SELECT works-1 FROM cleanup_counts) THEN RAISE EXCEPTION 'preservation_failed'; END IF;
END $$;
COMMIT;
SELECT 'temporary_fixture_cleanup_committed' AS result;
