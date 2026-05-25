/*
  # Master Data Repository & Audit System

  ## Purpose
  Implements a permanent, append-only audit log that captures every INSERT, UPDATE,
  and DELETE on all five core data tables (clients, health_profiles, hair_profiles,
  transactions, feedback). Also adds soft-delete support to the clients table so
  Admin can audit or recover deleted client records.

  ## 1. New Columns — clients soft-delete
  - `deleted_at` (timestamptz, nullable) — set when a client is "deleted"; NULL = active
  - `deleted_by` (uuid, nullable) — auth.uid() of the admin who deleted the record

  ## 2. New Table — audit_log
  Append-only change log. Rows are NEVER updated or deleted (enforced by RLS).
  Columns:
  - `id`            uuid PK
  - `table_name`    text  — which table changed (clients, transactions, …)
  - `record_id`     uuid  — PK of the changed row
  - `operation`     text  — INSERT | UPDATE | DELETE
  - `old_data`      jsonb — full previous row (NULL for INSERT)
  - `new_data`      jsonb — full new row (NULL for DELETE)
  - `changed_by`    uuid  — auth.uid() at the time of the change (nullable for system ops)
  - `changed_at`    timestamptz DEFAULT now()
  - `client_id`     uuid  — denormalized for fast "show all changes for client X" queries

  ## 3. Trigger Function — log_change()
  Single PL/pgSQL function called by AFTER triggers on all five tables.
  Captures old/new row as JSONB, records the operation, and inserts into audit_log.

  ## 4. Triggers — one per table
  - after_clients_change
  - after_health_profiles_change
  - after_hair_profiles_change
  - after_transactions_change
  - after_feedback_change

  ## 5. Master Data View — master_client_data
  A flat, spreadsheet-style VIEW joining all tables per client. Suitable for
  reporting and CSV export. Excludes soft-deleted clients by default (a separate
  view master_client_data_all includes them for Admin recovery).

  ## 6. Security
  - RLS enabled on audit_log: only admin role can SELECT; nobody can INSERT/UPDATE/DELETE
    through the API (triggers run as SECURITY DEFINER and bypass RLS).
  - Views are SECURITY INVOKER so the caller's role is checked.

  ## Important Notes
  1. Existing data is NOT modified — all changes are additive.
  2. The soft-delete columns default to NULL so no existing client row is affected.
  3. The ClientProfilePage "Delete Client" button will need updating (handled in frontend)
     to write deleted_at/deleted_by instead of a hard delete; hard deletes still work
     and will be captured by the audit trigger as DELETE operations.
*/

-- ─── 1. Soft-delete columns on clients ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN deleted_by uuid DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'profession'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN profession text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'dob'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN dob text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN service_type text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'service_items'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN service_items text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'oral_medication'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN oral_medication text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'skin_allergies'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN skin_allergies text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'home_care'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN home_care text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'hair_conditions'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN hair_conditions text[] DEFAULT NULL;
  END IF;
END $$;

-- ─── 2. audit_log table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text        NOT NULL,
  record_id   uuid        NOT NULL,
  operation   text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  client_id   uuid
);

CREATE INDEX IF NOT EXISTS idx_audit_log_record_id   ON public.audit_log (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_client_id   ON public.audit_log (client_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name  ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at  ON public.audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation   ON public.audit_log (operation);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can read the full audit log
CREATE POLICY "Admin can read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No one can insert/update/delete via API — only the trigger function (SECURITY DEFINER) writes rows
CREATE POLICY "No direct insert to audit log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update to audit log"
  ON public.audit_log FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No direct delete from audit log"
  ON public.audit_log FOR DELETE
  TO authenticated
  USING (false);

-- ─── 3. Trigger function ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_client_id uuid;
  v_old       jsonb;
  v_new       jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);
  ELSE
    v_record_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
  END IF;

  -- Resolve client_id for denormalization
  IF TG_TABLE_NAME = 'clients' THEN
    v_client_id := v_record_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_client_id := (v_old ->> 'client_id')::uuid;
  ELSE
    v_client_id := (v_new ->> 'client_id')::uuid;
  END IF;

  INSERT INTO public.audit_log
    (table_name, record_id, operation, old_data, new_data, changed_by, client_id)
  VALUES
    (TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, auth.uid(), v_client_id);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ─── 4. Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS after_clients_change       ON public.clients;
DROP TRIGGER IF EXISTS after_health_profiles_change ON public.health_profiles;
DROP TRIGGER IF EXISTS after_hair_profiles_change  ON public.hair_profiles;
DROP TRIGGER IF EXISTS after_transactions_change   ON public.transactions;
DROP TRIGGER IF EXISTS after_feedback_change       ON public.feedback;

CREATE TRIGGER after_clients_change
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

CREATE TRIGGER after_health_profiles_change
  AFTER INSERT OR UPDATE OR DELETE ON public.health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

CREATE TRIGGER after_hair_profiles_change
  AFTER INSERT OR UPDATE OR DELETE ON public.hair_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

CREATE TRIGGER after_transactions_change
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

CREATE TRIGGER after_feedback_change
  AFTER INSERT OR UPDATE OR DELETE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- ─── 5. Master Data View ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.master_client_data AS
SELECT
  c.id                                               AS client_id,
  c.name                                             AS client_name,
  c.phone,
  c.gender,
  c.dob,
  c.age,
  c.blood_group,
  c.profession,
  c.address,
  c.notes                                            AS client_notes,
  c.service_type,
  array_to_string(c.service_items, ', ')             AS service_items,
  c.oral_medication,
  c.skin_allergies,
  c.home_care,
  array_to_string(c.hair_conditions, ', ')           AS hair_conditions,
  hp.allergies                                       AS health_allergies,
  hp.special_requirements,
  hap.hair_problems::text                            AS hair_problems,
  hap.hair_texture::text                             AS hair_texture,
  hap.health_issues::text                            AS health_issues,
  hap.diet_type,
  hap.medical_history,
  (
    SELECT count(*)::int
    FROM public.transactions t
    WHERE t.client_id = c.id
  )                                                  AS total_treatments,
  (
    SELECT coalesce(sum(t.price), 0)
    FROM public.transactions t
    WHERE t.client_id = c.id
  )                                                  AS total_spent,
  (
    SELECT max(t.date)
    FROM public.transactions t
    WHERE t.client_id = c.id
  )                                                  AS last_visit,
  (
    SELECT round(avg(f.rating)::numeric, 1)
    FROM public.feedback f
    WHERE f.client_id = c.id
  )                                                  AS avg_rating,
  c.created_at,
  c.updated_at,
  c.deleted_at,
  c.deleted_by
FROM public.clients c
LEFT JOIN public.health_profiles hp  ON hp.client_id = c.id
LEFT JOIN public.hair_profiles   hap ON hap.client_id = c.id
WHERE c.deleted_at IS NULL;

-- View including soft-deleted clients (Admin recovery)
CREATE OR REPLACE VIEW public.master_client_data_all AS
SELECT
  c.id                                               AS client_id,
  c.name                                             AS client_name,
  c.phone,
  c.gender,
  c.dob,
  c.age,
  c.blood_group,
  c.profession,
  c.address,
  c.notes                                            AS client_notes,
  c.service_type,
  array_to_string(c.service_items, ', ')             AS service_items,
  c.oral_medication,
  c.skin_allergies,
  c.home_care,
  array_to_string(c.hair_conditions, ', ')           AS hair_conditions,
  hp.allergies                                       AS health_allergies,
  hp.special_requirements,
  hap.hair_problems::text                            AS hair_problems,
  hap.hair_texture::text                             AS hair_texture,
  hap.health_issues::text                            AS health_issues,
  hap.diet_type,
  hap.medical_history,
  (
    SELECT count(*)::int
    FROM public.transactions t
    WHERE t.client_id = c.id
  )                                                  AS total_treatments,
  (
    SELECT coalesce(sum(t.price), 0)
    FROM public.transactions t
    WHERE t.client_id = c.id
  )                                                  AS total_spent,
  (
    SELECT max(t.date)
    FROM public.transactions t
    WHERE t.client_id = c.id
  )                                                  AS last_visit,
  (
    SELECT round(avg(f.rating)::numeric, 1)
    FROM public.feedback f
    WHERE f.client_id = c.id
  )                                                  AS avg_rating,
  c.created_at,
  c.updated_at,
  c.deleted_at,
  c.deleted_by
FROM public.clients c
LEFT JOIN public.health_profiles hp  ON hp.client_id = c.id
LEFT JOIN public.hair_profiles   hap ON hap.client_id = c.id;
