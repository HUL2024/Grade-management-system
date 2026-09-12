-- Run this once if you already ran schema.sql before this update.
-- (If you're running schema.sql fresh, this is already included — skip it.)
create unique index if not exists idx_teachers_phone_unique on teachers(phone) where phone is not null;
