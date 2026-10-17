insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do update set public = true;

drop policy if exists screenshots_public_read on storage.objects;
create policy screenshots_public_read on storage.objects
  for select
  using (bucket_id = 'screenshots');
