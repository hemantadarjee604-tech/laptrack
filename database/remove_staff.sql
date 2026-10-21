-- Run this ONCE in pgAdmin Query Tool if your database was created BEFORE the staff role was removed.
-- (If you re-run schema.sql on an empty database you do not need this file.)
BEGIN;
DELETE FROM users WHERE email = 'staff@labtrack.test';                 -- remove the demo staff account
UPDATE users SET role = 'user' WHERE role = 'staff';                   -- any other staff become requesters
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user'));
COMMIT;
