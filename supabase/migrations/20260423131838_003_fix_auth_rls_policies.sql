/*
  # Fix RLS Policies for Authentication

  1. Issue
    - Login query cannot access users table because RLS blocks unauthenticated lookups
    - User needs to query their own user record during login, but auth context not established yet

  2. Solution
    - Add policy allowing users to read their own data by email (for login flow)
    - Keep existing policies for security

  3. Changes
    - Add SELECT policy for users to read their record by email during login
*/

-- Allow users to read their own record by email (needed for login flow)
CREATE POLICY "Users can read own data by email"
  ON users FOR SELECT
  TO authenticated
  USING (email = CURRENT_USER);

-- Alternative: Allow reading by ID for newly authenticated users
-- This helps with the initial auth session establishment
CREATE POLICY "Authenticated users can read users table for own lookup"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));
