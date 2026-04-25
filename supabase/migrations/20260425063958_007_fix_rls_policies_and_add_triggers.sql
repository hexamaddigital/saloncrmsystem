/*
  # Fix RLS Policies and Add Update Triggers

  ## Issues Fixed

  1. RLS SELECT Policies - hair_profiles and health_profiles
     - Previous policies used USING (true) which allows ANY authenticated user to read ALL records
     - Replaced with proper role-based check matching the other tables

  2. Missing updated_at trigger
     - Ensures updated_at column auto-updates on row changes for clients, users tables

  ## Changes

  ### Security
  - hair_profiles SELECT: now requires authenticated user with admin or operator role
  - health_profiles SELECT: now requires authenticated user with admin or operator role

  ### Triggers
  - Added updated_at auto-update trigger for all tables that have the column
*/

-- Fix hair_profiles SELECT policy (was USING(true) - too permissive)
DROP POLICY IF EXISTS "Authenticated users can read hair profiles" ON hair_profiles;

CREATE POLICY "Authenticated users can read hair profiles"
  ON hair_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = ANY(ARRAY['admin', 'operator'])
    )
  );

-- Fix health_profiles SELECT policy (was USING(true) - too permissive)
DROP POLICY IF EXISTS "Authenticated users can read health profiles" ON health_profiles;

CREATE POLICY "Authenticated users can read health profiles"
  ON health_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = ANY(ARRAY['admin', 'operator'])
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers for tables that have the column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_clients_updated_at'
  ) THEN
    CREATE TRIGGER update_clients_updated_at
      BEFORE UPDATE ON clients
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_health_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_health_profiles_updated_at
      BEFORE UPDATE ON health_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_hair_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_hair_profiles_updated_at
      BEFORE UPDATE ON hair_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_transactions_updated_at
      BEFORE UPDATE ON transactions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
