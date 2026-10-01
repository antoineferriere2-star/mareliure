SELECT jsonb_build_object('migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'agreements_md5',(SELECT md5(string_agg(quote_id::text||terms::text||evidence,'|' ORDER BY quote_id)) FROM public.marketplace_own_client_agreements),
 'completions',(SELECT count(*) FROM public.marketplace_own_agreement_identity_completions),
 'qa_pr55_rows',(SELECT count(*) FROM public.marketplace_binder_quotes WHERE quote_number LIKE 'QA-PR55-%'),
 'profile_siret_still_empty',(SELECT nullif(btrim(siret),'') IS NULL FROM public.marketplace_binder_billing_profiles WHERE binder_id='d6c095c0-2cff-4ee9-9393-8891c5d8c03c'));
