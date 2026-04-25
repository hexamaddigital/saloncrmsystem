/*
  # Fix Data Table RLS Policies to Eliminate users Table Subqueries

  ## Problem
  All data table policies (clients, transactions, feedback, hair_profiles,
  health_profiles) check roles via:
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ...)

  This cross-table lookup works only if the users table SELECT policy passes first.
  Under load or edge cases this can still cause latency or unexpected failures.
  Using auth.jwt() is faster (no extra DB round-trip) and avoids any dependency
  on the users table during data access.

  ## Fix
  Replace all EXISTS (SELECT FROM users ...) role checks with:
    (auth.jwt() -> 'app_metadata' ->> 'role') checks

  These read directly from the signed JWT, which cannot be tampered with by users.
*/

-- =====================
-- CLIENTS
-- =====================
DROP POLICY IF EXISTS "Authenticated users can read clients" ON clients;
DROP POLICY IF EXISTS "Operators can insert clients" ON clients;
DROP POLICY IF EXISTS "Operators can update clients" ON clients;
DROP POLICY IF EXISTS "Admin can delete clients" ON clients;

CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can update clients"
  ON clients FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Admin can delete clients"
  ON clients FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =====================
-- HEALTH PROFILES
-- =====================
DROP POLICY IF EXISTS "Authenticated users can read health profiles" ON health_profiles;
DROP POLICY IF EXISTS "Operators can insert health profiles" ON health_profiles;
DROP POLICY IF EXISTS "Operators can update health profiles" ON health_profiles;
DROP POLICY IF EXISTS "Admin can delete health profiles" ON health_profiles;

CREATE POLICY "Authenticated users can read health profiles"
  ON health_profiles FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can insert health profiles"
  ON health_profiles FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can update health profiles"
  ON health_profiles FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Admin can delete health profiles"
  ON health_profiles FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =====================
-- HAIR PROFILES
-- =====================
DROP POLICY IF EXISTS "Authenticated users can read hair profiles" ON hair_profiles;
DROP POLICY IF EXISTS "Operators can insert hair profiles" ON hair_profiles;
DROP POLICY IF EXISTS "Operators can update hair profiles" ON hair_profiles;
DROP POLICY IF EXISTS "Admin can delete hair profiles" ON hair_profiles;

CREATE POLICY "Authenticated users can read hair profiles"
  ON hair_profiles FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can insert hair profiles"
  ON hair_profiles FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can update hair profiles"
  ON hair_profiles FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Admin can delete hair profiles"
  ON hair_profiles FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =====================
-- TRANSACTIONS
-- =====================
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON transactions;
DROP POLICY IF EXISTS "Operators can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Operators can update transactions" ON transactions;
DROP POLICY IF EXISTS "Operators can delete transactions" ON transactions;

CREATE POLICY "Authenticated users can read transactions"
  ON transactions FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can insert transactions"
  ON transactions FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can update transactions"
  ON transactions FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can delete transactions"
  ON transactions FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

-- =====================
-- FEEDBACK
-- =====================
DROP POLICY IF EXISTS "Authenticated users can read feedback" ON feedback;
DROP POLICY IF EXISTS "Operators can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Operators can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can delete feedback" ON feedback;

CREATE POLICY "Authenticated users can read feedback"
  ON feedback FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can insert feedback"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Operators can update feedback"
  ON feedback FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator'));

CREATE POLICY "Admin can delete feedback"
  ON feedback FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
