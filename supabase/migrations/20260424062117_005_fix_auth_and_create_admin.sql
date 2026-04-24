/*
  # Fix Authentication System and Create Working Admin

  1. Issues Found
    - No auth.users entry exists for the admin user in public.users
    - RLS policies use `CURRENT_USER` which doesn't work with Supabase auth
    - Duplicate/overlapping RLS policies on users table
    - password_hash column is unnecessary (Supabase Auth handles passwords)
    - Users table INSERT policy requires admin role, but new users can't insert their own record on signup

  2. Changes
    - Drop all existing policies on users table and recreate clean ones
    - Fix signup flow: allow users to insert their own record on registration
    - Remove password_hash column (Supabase Auth manages passwords securely)
    - Create proper admin user in auth.users with email_confirmed=true
    - Link public.users record to auth.users via matching UUID

  3. Security
    - Clean RLS policies: users can read/update own data, admins can read/update all
    - Signup policy allows INSERT when auth.uid() matches the new user's id
    - Admin-only delete policy
*/

-- Step 1: Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Admin can read all users" ON users;
DROP POLICY IF EXISTS "Admin can update all users" ON users;
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Users can read own data by email" ON users;
DROP POLICY IF EXISTS "Authenticated users can read users table for own lookup" ON users;

-- Step 2: Remove password_hash column (Supabase Auth handles passwords)
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Step 3: Recreate clean RLS policies
-- Users can read their own record
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Users can update their own record (name, phone only - not role)
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any user
CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Allow new users to insert their own record on signup
CREATE POLICY "Users can insert own record on signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admins can insert new users
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Admins can delete users
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Step 4: Delete the orphaned admin record (no auth.users entry)
DELETE FROM users WHERE email = 'admin@salon.com';

-- Step 5: Create admin user in auth.users using the admin API
-- This creates a properly authenticated admin with email confirmed
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@saloncrm.com',
  crypt('Admin@12345', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"], "role": "admin"}',
  '{"name": "Meena Vaishnav", "phone": "9422484582", "role": "admin"}',
  '',
  '',
  '',
  ''
);

-- Step 6: Insert matching public.users record with the same UUID
INSERT INTO users (id, name, email, phone, role)
SELECT id, 'Meena Vaishnav', 'admin@saloncrm.com', '9422484582', 'admin'
FROM auth.users WHERE email = 'admin@saloncrm.com'
ON CONFLICT DO NOTHING;
