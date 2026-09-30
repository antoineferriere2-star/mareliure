BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),
 'duplicate_payment_intent_groups',(SELECT count(*) FROM (SELECT metadata->>'payment_intent_id' FROM public.marketplace_events WHERE event_type='CUSTOMER_PAYMENT_SUCCEEDED' AND metadata->>'payment_intent_id' IS NOT NULL GROUP BY metadata->>'payment_intent_id' HAVING count(*)>1) d),
 'cases',(SELECT count(*) FROM public.marketplace_cases),
 'commercial_proposals',(SELECT count(*) FROM public.marketplace_commercial_proposals),
 'accepted_proposals',(SELECT count(*) FROM public.marketplace_commercial_proposals WHERE accepted_at IS NOT NULL),
 'accepted_proposals_fingerprint',(SELECT md5(coalesce(string_agg(md5(to_jsonb(p)::text),'' ORDER BY id),'')) FROM public.marketplace_commercial_proposals p WHERE accepted_at IS NOT NULL),
 'binder_quotes',(SELECT count(*) FROM public.marketplace_binder_quotes),
 'accepted_quotes',(SELECT count(*) FROM public.marketplace_binder_quotes WHERE status IN ('accepted','invoiced')),
 'accepted_quotes_fingerprint',(SELECT md5(coalesce(string_agg(md5(to_jsonb(q)::text),'' ORDER BY id),'')) FROM public.marketplace_binder_quotes q WHERE status IN ('accepted','invoiced')),
 'binder_invoices',(SELECT count(*) FROM public.marketplace_binder_invoices),
 'invoice_statuses',(SELECT jsonb_agg(x) FROM (SELECT status,payment_status,count(*) FROM public.marketplace_binder_invoices GROUP BY status,payment_status) x),
 'invoices_fingerprint',(SELECT md5(coalesce(string_agg(md5(to_jsonb(i)::text),'' ORDER BY id),'')) FROM public.marketplace_binder_invoices i),
 'new_column_collisions',(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND ((table_name='marketplace_commercial_proposals' AND column_name IN ('payment_circuit','payment_provenance')) OR (table_name IN ('marketplace_binder_quotes','marketplace_binder_invoices') AND column_name='payment_snapshot'))),
 'schema_create',has_schema_privilege(current_user,'public','CREATE'),
 'relation_privileges',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',r.relname,'owner',pg_get_userbyid(r.relowner),'owner_rights',pg_has_role(current_user,r.relowner,'USAGE'),'select',has_table_privilege(current_user,r.oid,'SELECT'),'insert',has_table_privilege(current_user,r.oid,'INSERT'),'update',has_table_privilege(current_user,r.oid,'UPDATE'),'trigger',has_table_privilege(current_user,r.oid,'TRIGGER')) ORDER BY n.nspname,r.relname)
 FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE r.relkind IN ('r','p') AND ((n.nspname='public' AND r.relname IN ('marketplace_cases','marketplace_events','marketplace_commercial_proposals','marketplace_binder_quotes','marketplace_binder_invoices','marketplace_binder_works','marketplace_binder_clients','marketplace_binder_members','marketplace_binders','marketplace_binder_credit_notes','user_roles')) OR (n.nspname='storage' AND r.relname IN ('objects','buckets')) OR (n.nspname='auth' AND r.relname='users') OR (n.nspname='supabase_migrations' AND r.relname='schema_migrations')))
) AS preflight;
ROLLBACK;
