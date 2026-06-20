-- ═══════════════════════════════════════════════════════════════════════════
--  012_platform_expansion.sql
--  Adds: appointments, invoices, service_catalog, packages, inventory,
--        memberships, inquiries, coupons, loyalty_points, golden flag
--  All additive – zero destructive operations on existing tables/data
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Golden / loyalty columns on clients ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='is_golden') THEN
    ALTER TABLE public.clients ADD COLUMN is_golden boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='loyalty_points') THEN
    ALTER TABLE public.clients ADD COLUMN loyalty_points integer NOT NULL DEFAULT 0;
  END IF;
  -- staff_name on transactions (for "who did the service")
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='staff_name') THEN
    ALTER TABLE public.transactions ADD COLUMN staff_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='service_category') THEN
    ALTER TABLE public.transactions ADD COLUMN service_category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='payment_method') THEN
    ALTER TABLE public.transactions ADD COLUMN payment_method text DEFAULT 'cash';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='payment_status') THEN
    ALTER TABLE public.transactions ADD COLUMN payment_status text DEFAULT 'paid' CHECK (payment_status IN ('paid','pending','partial'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='discount') THEN
    ALTER TABLE public.transactions ADD COLUMN discount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- ── 2. service_catalog ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL DEFAULT 'hair',
  price       numeric(10,2) NOT NULL DEFAULT 0,
  duration_min integer DEFAULT 30,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_service_catalog"  ON public.service_catalog FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_insert_service_catalog" ON public.service_catalog FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_update_service_catalog" ON public.service_catalog FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_delete_service_catalog" ON public.service_catalog FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');

-- ── 3. packages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.packages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL DEFAULT 0,
  validity_days integer DEFAULT 90,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.package_services (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  quantity   integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS public.client_packages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id    uuid NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  package_name  text NOT NULL,
  purchased_at  timestamptz DEFAULT now(),
  expires_at    timestamptz,
  sessions_total   integer NOT NULL DEFAULT 0,
  sessions_used    integer NOT NULL DEFAULT 0,
  amount_paid   numeric(10,2) DEFAULT 0,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','completed','cancelled')),
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_packages"   ON public.packages FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_write_packages"  ON public.packages FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_upd_packages"    ON public.packages FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_del_packages"    ON public.packages FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "staff_read_pkg_svc"    ON public.package_services FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_write_pkg_svc"   ON public.package_services FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_upd_pkg_svc"     ON public.package_services FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_del_pkg_svc"     ON public.package_services FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "staff_read_client_pkg"  ON public.client_packages FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_client_pkg" ON public.client_packages FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_upd_client_pkg"    ON public.client_packages FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator')) WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_del_client_pkg"    ON public.client_packages FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');

-- ── 4. appointments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name  text NOT NULL,
  client_phone text NOT NULL,
  service_name text NOT NULL,
  staff_name   text,
  scheduled_at timestamptz NOT NULL,
  duration_min integer DEFAULT 60,
  status       text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
  notes        text,
  created_by   uuid,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id    ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status       ON public.appointments(status);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_appointments"   ON public.appointments FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_update_appointments" ON public.appointments FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator')) WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_delete_appointments" ON public.appointments FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. invoices ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text UNIQUE NOT NULL,
  client_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name     text NOT NULL,
  client_phone    text NOT NULL,
  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  discount        numeric(10,2) NOT NULL DEFAULT 0,
  tax             numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(10,2) NOT NULL DEFAULT 0,
  payment_method  text DEFAULT 'cash',
  payment_status  text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid','pending','partial')),
  amount_paid     numeric(10,2) DEFAULT 0,
  notes           text,
  invoice_date    timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL,
  discount    numeric(10,2) DEFAULT 0,
  total       numeric(10,2) NOT NULL,
  staff_name  text
);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id    ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_invoices"    ON public.invoices FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_invoices"  ON public.invoices FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_update_invoices"  ON public.invoices FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator')) WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_delete_invoices"  ON public.invoices FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "staff_read_inv_items"   ON public.invoice_items FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_inv_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_update_inv_items" ON public.invoice_items FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator')) WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_delete_inv_items" ON public.invoice_items FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice number sequence
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1001;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT 'INV-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(nextval('invoice_seq')::text, 4, '0');
$$;

-- ── 6. inventory ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  category      text DEFAULT 'product',
  brand         text,
  unit          text DEFAULT 'piece',
  current_stock numeric(10,2) NOT NULL DEFAULT 0,
  min_stock     numeric(10,2) NOT NULL DEFAULT 5,
  cost_price    numeric(10,2) DEFAULT 0,
  sale_price    numeric(10,2) DEFAULT 0,
  is_retail     boolean DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  operation   text NOT NULL CHECK (operation IN ('purchase','usage','sale','adjustment','return')),
  quantity    numeric(10,2) NOT NULL,
  notes       text,
  client_id   uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_id  uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_item_id ON public.inventory_logs(item_id);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_inventory"   ON public.inventory_items FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_insert_inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_update_inventory" ON public.inventory_items FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_delete_inventory" ON public.inventory_items FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "staff_read_inv_logs"    ON public.inventory_logs FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_inv_logs"  ON public.inventory_logs FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_del_inv_logs"     ON public.inventory_logs FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. memberships ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  price           numeric(10,2) NOT NULL DEFAULT 0,
  validity_days   integer NOT NULL DEFAULT 365,
  discount_pct    numeric(5,2) DEFAULT 0,
  benefits        text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.client_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  membership_id   uuid NOT NULL REFERENCES public.memberships(id) ON DELETE RESTRICT,
  membership_name text NOT NULL,
  started_at      timestamptz DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  amount_paid     numeric(10,2) DEFAULT 0,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_memberships"   ON public.memberships FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_write_memberships"  ON public.memberships FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_upd_memberships"    ON public.memberships FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_del_memberships"    ON public.memberships FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "staff_read_client_mem"    ON public.client_memberships FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_client_mem"  ON public.client_memberships FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_upd_client_mem"     ON public.client_memberships FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator')) WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_del_client_mem"     ON public.client_memberships FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');

-- ── 8. inquiries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inquiries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  phone          text NOT NULL,
  service_interest text,
  source         text DEFAULT 'walk_in',
  status         text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','follow_up','converted','lost')),
  notes          text,
  follow_up_date date,
  assigned_to    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by     uuid,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status        ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_follow_up_date ON public.inquiries(follow_up_date);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_inquiries"   ON public.inquiries FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_inquiries" ON public.inquiries FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_update_inquiries" ON public.inquiries FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator')) WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_delete_inquiries" ON public.inquiries FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE TRIGGER update_inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 9. coupons ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  description     text,
  discount_type   text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value  numeric(10,2) NOT NULL,
  min_amount      numeric(10,2) DEFAULT 0,
  max_uses        integer,
  uses_count      integer NOT NULL DEFAULT 0,
  valid_from      date,
  valid_until     date,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_coupons"   ON public.coupons FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_write_coupons"  ON public.coupons FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_upd_coupons"    ON public.coupons FOR UPDATE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'role')='admin');
CREATE POLICY "admin_del_coupons"    ON public.coupons FOR DELETE TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');

-- ── 10. Update audit triggers for new tables ─────────────────────────────────
DROP TRIGGER IF EXISTS after_appointments_change ON public.appointments;
DROP TRIGGER IF EXISTS after_invoices_change     ON public.invoices;
DROP TRIGGER IF EXISTS after_inquiries_change    ON public.inquiries;

CREATE TRIGGER after_appointments_change AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER after_invoices_change     AFTER INSERT OR UPDATE OR DELETE ON public.invoices     FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER after_inquiries_change    AFTER INSERT OR UPDATE OR DELETE ON public.inquiries    FOR EACH ROW EXECUTE FUNCTION public.log_change();
