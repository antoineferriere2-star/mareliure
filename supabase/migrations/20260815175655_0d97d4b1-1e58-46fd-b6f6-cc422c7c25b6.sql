-- Pre-check: expect exactly one row, workspace_type = 'client', role = 'owner'
SELECT w.id, w.name, w.workspace_type, w.provisioned_for_user_id IS NOT NULL AS self_service, w.max_active_missions, w.monthly_brief_quota, m.role
FROM public.build_workspaces w
JOIN public.build_workspace_members m ON m.workspace_id = w.id
WHERE lower(m.email) = 'contact@metre-pro.com';

-- Convert the workspace
UPDATE public.build_workspaces w
SET workspace_type      = 'internal_sales',
    name                = 'Métré Sales / Demos',
    max_active_missions = 50,
    monthly_brief_quota = 500
FROM public.build_workspace_members m
WHERE m.workspace_id = w.id
  AND lower(m.email) = 'contact@metre-pro.com'
  AND w.workspace_type = 'client'
RETURNING w.id, w.name, w.workspace_type, w.max_active_missions, w.monthly_brief_quota;

-- Post-check: expect internal_sales = 1, client = 6
SELECT workspace_type, count(*) FROM public.build_workspaces GROUP BY workspace_type;