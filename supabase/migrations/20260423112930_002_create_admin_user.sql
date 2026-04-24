/*
  # Create Demo Admin User

  1. New Auth User
    - Email: admin@salon.com
    - Role: admin

  2. New User Record
    - Links to auth user
    - Sets admin role for Meena Vaishnav

  Note: This is a demo account for testing the system.
  Password needs to be set separately through Supabase Auth interface or updated manually.
*/

INSERT INTO users (id, name, email, phone, role, password_hash)
VALUES (
  gen_random_uuid(),
  'Meena Vaishnav',
  'admin@salon.com',
  '9422484582',
  'admin',
  ''
)
ON CONFLICT DO NOTHING;
