-- jsonb_populate_record supplies NULL for omitted columns instead of their table
-- defaults. The contract epoch was added after this RPC: every new quote must
-- receive the current epoch from the database, including calls by older Workers.
-- Existing quotes, their agreements and their numbering are unchanged.
CREATE OR REPLACE FUNCTION public.marketplace_binder_create_quote(
  p_binder_id uuid, p_quote jsonb, p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid := gen_random_uuid(); v_number text;
BEGIN
  v_number := public.marketplace_binder_next_document_number(
    p_binder_id, 'quote', EXTRACT(YEAR FROM (p_quote->>'issue_date')::date)::integer
  );
  INSERT INTO public.marketplace_binder_quotes
  SELECT r.* FROM jsonb_populate_record(
    NULL::public.marketplace_binder_quotes,
    p_quote || jsonb_build_object(
      'id',v_id,'binder_id',p_binder_id,'quote_number',v_number,'status','draft',
      'created_at',now(),'updated_at',now(),'contract_epoch','external_v1'
    )
  ) AS r;
  INSERT INTO public.marketplace_binder_quote_items
  SELECT r.* FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item,ord),
  LATERAL jsonb_populate_record(
    NULL::public.marketplace_binder_quote_items,
    e.item || jsonb_build_object(
      'id',gen_random_uuid(),'quote_id',v_id,'binder_id',p_binder_id,'position',e.ord
    )
  ) AS r;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_binder_create_quote(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_create_quote(uuid,jsonb,jsonb) TO service_role;
