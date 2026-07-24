-- Storage for the "inspiration photo" intake mode: the visitor's uploaded
-- image is analyzed by the vision AI agent and stays attached to the
-- Project Brief. Private bucket — every read/write goes through the
-- service-role client from the public runtime API (session-verified) or
-- the admin API (signed URLs), never direct anon/authenticated access.
-- Same deny-all convention as the build_* table policies.
insert into storage.buckets (id, name, public)
values ('build-inspiration-photos', 'build-inspiration-photos', false)
on conflict (id) do nothing;

create policy "No direct access to build-inspiration-photos"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'build-inspiration-photos' and false)
  with check (bucket_id = 'build-inspiration-photos' and false);
