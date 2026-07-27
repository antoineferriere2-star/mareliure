DELETE FROM public.build_workspace_ai_runs a
USING public.build_workspace_ai_runs b
WHERE a.workspace_id = b.workspace_id
  AND a.action = b.action
  AND a.request_id = b.request_id
  AND a.request_id IS NOT NULL
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS build_workspace_ai_runs_request_key
  ON public.build_workspace_ai_runs (workspace_id, action, request_id)
  WHERE request_id IS NOT NULL;