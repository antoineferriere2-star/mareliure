BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.marketplace_work_logistics_photos, public.marketplace_work_logistics_events, public.marketplace_binder_works IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE cleanup_counts AS SELECT
 (SELECT count(*) FROM public.marketplace_work_logistics_photos) photos,
 (SELECT count(*) FROM public.marketplace_work_logistics_events) events,
 (SELECT count(*) FROM public.marketplace_binder_works) works;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.marketplace_binder_works WHERE id='78255895-1e16-4846-b135-d505b2fa3900' AND binder_id='d6c095c0-2cff-4ee9-9393-8891c5d8c03c' AND title='QA temporaire CPU 20260930')<>1 THEN RAISE EXCEPTION 'fixture_mismatch'; END IF;
 IF (SELECT count(*) FROM public.marketplace_work_logistics_events WHERE work_id='78255895-1e16-4846-b135-d505b2fa3900')<>1 THEN RAISE EXCEPTION 'event_drift'; END IF;
 IF (SELECT count(*) FROM public.marketplace_work_logistics_photos WHERE event_id='20ba8ea8-0cf7-4fcc-be9b-7252ed29946c')<>2 THEN RAISE EXCEPTION 'photo_drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname IN ('logistics_photos_immutable','logistics_events_immutable') AND tgenabled<>'O') THEN RAISE EXCEPTION 'trigger_state_drift'; END IF;
END $$;
ALTER TABLE public.marketplace_work_logistics_photos DISABLE TRIGGER logistics_photos_immutable;
ALTER TABLE public.marketplace_work_logistics_events DISABLE TRIGGER logistics_events_immutable;
DELETE FROM public.marketplace_work_logistics_photos WHERE event_id='20ba8ea8-0cf7-4fcc-be9b-7252ed29946c' AND id IN ('edb5d96b-7e79-8378-80a2-c2781772e005','c21f9aa2-1e23-88dc-afc5-1f935a95340f');
DELETE FROM public.marketplace_work_logistics_events WHERE id='20ba8ea8-0cf7-4fcc-be9b-7252ed29946c' AND work_id='78255895-1e16-4846-b135-d505b2fa3900';
DELETE FROM public.marketplace_binder_works WHERE id='78255895-1e16-4846-b135-d505b2fa3900';
ALTER TABLE public.marketplace_work_logistics_photos ENABLE TRIGGER logistics_photos_immutable;
ALTER TABLE public.marketplace_work_logistics_events ENABLE TRIGGER logistics_events_immutable;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.marketplace_work_logistics_photos)<>(SELECT photos-2 FROM cleanup_counts) OR (SELECT count(*) FROM public.marketplace_work_logistics_events)<>(SELECT events-1 FROM cleanup_counts) OR (SELECT count(*) FROM public.marketplace_binder_works)<>(SELECT works-1 FROM cleanup_counts) THEN RAISE EXCEPTION 'preservation_failed'; END IF;
END $$;
COMMIT;
SELECT 'temporary_fixture_cleanup_committed' AS result;
