/*
  # Fix RLS Policies for Data Tables

  1. Issues Found
    - clients SELECT policy uses USING (true) - too permissive
    - health_profiles and hair_profiles use FOR ALL instead of separate policies
    - Missing DELETE policies for feedback and transactions (operators)

  2. Changes
    - Replace clients SELECT policy to require role check
    - Replace health_profiles FOR ALL with separate INSERT/UPDATE/DELETE policies
    - Replace hair_profiles FOR ALL with separate INSERT/UPDATE/DELETE policies
    - Add transactions DELETE policy for operators
    - Add feedback DELETE policy for admin

  3. Security
    - All policies require authenticated users with valid role
    - No USING (true) policies remain
*/

-- Fix clients SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read all clients" ON clients;
CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

-- Fix health_profiles: replace FOR ALL with separate policies
DROP POLICY IF EXISTS "Operators can manage health profiles" ON health_profiles;

CREATE POLICY "Operators can insert health profiles"
  ON health_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Operators can update health profiles"
  ON health_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admin can delete health profiles"
  ON health_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Fix hair_profiles: replace FOR ALL with separate policies
DROP POLICY IF EXISTS "Operators can manage hair profiles" ON hair_profiles;

CREATE POLICY "Operators can insert hair profiles"
  ON hair_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Operators can update hair profiles"
  ON hair_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admin can delete hair profiles"
  ON hair_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Fix transactions SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON transactions;
CREATE POLICY "Authenticated users can read transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

-- Add transactions DELETE policy for operators
DROP POLICY IF EXISTS "Admin can delete transactions" ON transactions;
CREATE POLICY "Operators can delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

-- Fix feedback SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read feedback" ON feedback;
CREATE POLICY "Authenticated users can read feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'operator')
    )
  );

-- Add feedback DELETE policy for admin
CREATE POLICY "Admin can delete feedback"
  ON feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
