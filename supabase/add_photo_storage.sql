-- Run this once if you already ran schema.sql before this update.
-- (If you're running schema.sql fresh, this is already included — skip it.)
-- Safe to run more than once.

alter table teachers add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "public_read_photos" on storage.objects;
create policy "public_read_photos" on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "staff_upload_photos" on storage.objects;
create policy "staff_upload_photos" on storage.objects for insert
  with check (bucket_id = 'photos' and public.current_user_role() in ('administrator','principal','academic_officer'));

drop policy if exists "staff_update_photos" on storage.objects;
create policy "staff_update_photos" on storage.objects for update
  using (bucket_id = 'photos' and public.current_user_role() in ('administrator','principal','academic_officer'));

drop policy if exists "staff_delete_photos" on storage.objects;
create policy "staff_delete_photos" on storage.objects for delete
  using (bucket_id = 'photos' and public.current_user_role() in ('administrator','principal','academic_officer'));
