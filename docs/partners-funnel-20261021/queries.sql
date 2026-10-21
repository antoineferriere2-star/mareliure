\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='45s';
WITH params AS (SELECT now() as_of),
binders AS (SELECT b.*, coalesce(b.is_demo,false) OR EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=b.user_id AND r.role='admin') OR coalesce(u.email,'') ~* '(^|[+._-])(test|qa|e2e|recette|playwright|codex)([+._0-9-]|@)|@(example\.(com|org|net)|example|test|invalid)(\.|$)' excluded_test FROM public.marketplace_binders b LEFT JOIN auth.users u ON u.id=b.user_id),
apps AS (SELECT a.*, coalesce(b.excluded_test,false) OR a.email ~* '(^|[+._-])(test|qa|e2e|recette|playwright|codex)([+._0-9-]|@)|@(example\.(com|org|net)|example|test|invalid)(\.|$)' test_address FROM public.marketplace_binder_applications a LEFT JOIN binders b ON b.id=a.converted_binder_id),
windows AS (SELECT d, as_of-make_interval(days=>d) since,as_of FROM params CROSS JOIN (VALUES(30),(60)) v(d)),
views AS (SELECT v.*,split_part(v.path,'?',1) clean_path,coalesce(v.referrer_host,'') ~* 'localhost|127\.0\.0\.1|playwright|lighthouse' test_referrer FROM public.build_page_views v)
SELECT jsonb_build_object('at',(SELECT as_of FROM params),'read_only',current_setting('transaction_read_only'),'windows',(SELECT jsonb_agg(jsonb_build_object('days',d,'since',since,'until',as_of,
 'page_views',(SELECT jsonb_build_object('raw',count(*),'visitors',count(DISTINCT visitor_hash),'sessions',count(DISTINCT session_hash),'test_referrer',count(*) FILTER(WHERE test_referrer),'stored_bot',count(*) FILTER(WHERE device='bot'),'after_explicit_exclusions',count(*) FILTER(WHERE NOT test_referrer AND device<>'bot'),'visitors_after_explicit_exclusions',count(DISTINCT visitor_hash) FILTER(WHERE NOT test_referrer AND device<>'bot')) FROM views WHERE clean_path IN ('/partenaires-relieurs','/partenaires-relieurs/') AND created_at>=since AND created_at<as_of),
 'applications',(SELECT jsonb_build_object('raw',count(*),'test_addresses',count(*) FILTER(WHERE test_address),'remaining',count(*) FILTER(WHERE NOT test_address),'pending_remaining',count(*) FILTER(WHERE NOT test_address AND status='new'),'converted_remaining',count(*) FILTER(WHERE NOT test_address AND converted_binder_id IS NOT NULL)) FROM apps WHERE created_at>=since AND created_at<as_of),
 'spaces',(SELECT jsonb_build_object('raw',count(*),'demo_or_test',count(*) FILTER(WHERE excluded_test),'remaining',count(*) FILTER(WHERE NOT excluded_test)) FROM binders WHERE created_at>=since AND created_at<as_of),
 'top_paths',(SELECT jsonb_agg(x) FROM (SELECT clean_path path,count(*) views,count(DISTINCT visitor_hash) visitors FROM views WHERE created_at>=since AND created_at<as_of GROUP BY clean_path ORDER BY count(*) DESC LIMIT 12) x)
) ORDER BY d) FROM windows),
'partner_devices_60d',(SELECT jsonb_agg(x) FROM (SELECT device,count(*) views,count(DISTINCT visitor_hash) visitors FROM views,params WHERE clean_path IN ('/partenaires-relieurs','/partenaires-relieurs/') AND created_at>=as_of-interval '60 days' GROUP BY device ORDER BY count(*) DESC) x),
'partner_referrers_60d',(SELECT jsonb_agg(x) FROM (SELECT coalesce(nullif(referrer_host,''),'(absent)') host,count(*) views FROM views,params WHERE clean_path IN ('/partenaires-relieurs','/partenaires-relieurs/') AND created_at>=as_of-interval '60 days' GROUP BY referrer_host ORDER BY count(*) DESC LIMIT 12) x),
'partner_weeks_60d',(SELECT jsonb_agg(x) FROM (SELECT date_trunc('week',created_at AT TIME ZONE 'Europe/Paris') week,count(*) views,count(DISTINCT visitor_hash) visitors FROM views,params WHERE clean_path IN ('/partenaires-relieurs','/partenaires-relieurs/') AND created_at>=as_of-interval '60 days' GROUP BY 1 ORDER BY 1) x),
'application_statuses_60d',(SELECT jsonb_agg(x) FROM (SELECT status,count(*) raw,count(*) FILTER(WHERE NOT test_address) remaining FROM apps,params WHERE created_at>=as_of-interval '60 days' GROUP BY status) x),
'space_statuses_60d',(SELECT jsonb_agg(x) FROM (SELECT status,count(*) raw,count(*) FILTER(WHERE NOT excluded_test) remaining FROM binders,params WHERE created_at>=as_of-interval '60 days' GROUP BY status) x));
COMMIT;

