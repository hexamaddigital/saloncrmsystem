/*
  # Fix Infinite Recursion in Users Table RLS Policies

  ## Problem
  The admin RLS policies on the `users` table used subqueries like:
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')

  This causes infinite recursion: evaluating a SELECT policy on `users` triggers
  the policy again, which triggers another SELECT, and so on indefinitely.

  ## Solution
  Replace all subquery-based role checks with `auth.jwt()` lookups, which read
  the role directly from the authenticated JWT token without touching the users table.

  - Admin role check: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`
  - Operator role check: `(auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator')`

  `app_metadata` is set server-side only and cannot be modified by the user,
  making it safe for authorization decisions.

  ## Policies Rewritten
  - Admins can read all users
  - Admins can insert users
  - Admins can update any user
  - Admins can delete users
  - Users can read own data (unchanged - already safe)
  - Users can insert own record on signup (unchanged - already safe)
  - Users can update own data (unchanged - already safe)
*/

-- Drop all existing users policies
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can insert own record on signup" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- SELECT: own row OR admin
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- INSERT: own row on signup (no subquery needed)
CREATE POLICY "Users can insert own record on signup"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- INSERT: admin can insert any user row
CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- UPDATE: own row OR admin
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON users
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- DELETE: admin only
CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
