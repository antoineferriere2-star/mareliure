-- READ ONLY. Stops (exception) on any drift from the reviewed baseline.
DO $$ BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 95 THEN RAISE EXCEPTION 'drift: migration count'; END IF;
  IF (SELECT max(version) FROM supabase_migrations.schema_migrations) <> '20260928180000' THEN RAISE EXCEPTION 'drift: last version'; END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('20261001150000','20261001160000')) THEN RAISE EXCEPTION 'drift: already applied'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketplace_binder_quotes' AND column_name='contract_epoch') THEN RAISE EXCEPTION 'drift: column exists'; END IF;
  IF to_regclass('public.marketplace_own_agreement_identity_completions') IS NOT NULL THEN RAISE EXCEPTION 'drift: table exists'; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='publication_maintenance_v2') OR to_regnamespace('publication_guard_v2') IS NOT NULL THEN RAISE EXCEPTION 'drift: maintenance guard'; END IF;
  IF (SELECT created_at FROM storage.buckets WHERE id='work-logistics-private') IS NULL THEN RAISE EXCEPTION 'drift: frontier marker'; END IF;
END $$;
SELECT jsonb_build_object('precheck','passed',
 'agreements',(SELECT count(*) FROM public.marketplace_own_client_agreements),
 'agreements_md5',(SELECT md5(string_agg(quote_id::text||terms::text||evidence,'|' ORDER BY quote_id)) FROM public.marketplace_own_client_agreements),
 'accepted_or_invoiced_quotes_md5',(SELECT md5(string_agg(to_jsonb(q)::text,'|' ORDER BY id)) FROM public.marketplace_binder_quotes q WHERE status IN ('accepted','invoiced')),
 'invoices_md5',(SELECT md5(string_agg(to_jsonb(i)::text,'|' ORDER BY id)) FROM public.marketplace_binder_invoices i),
 'settlements',(SELECT count(*) FROM public.marketplace_external_settlements),
 'to_reclassify',(SELECT coalesce(jsonb_agg(id ORDER BY id),'[]') FROM public.marketplace_binder_quotes WHERE created_at>=(SELECT created_at FROM storage.buckets WHERE id='work-logistics-private') AND status IN ('draft','sent','expired')));
