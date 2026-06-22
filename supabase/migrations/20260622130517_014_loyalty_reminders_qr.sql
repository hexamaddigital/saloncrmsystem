-- ── Loyalty system ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  points_per_rupee  numeric(10,4) NOT NULL DEFAULT 1,  -- points awarded per ₹ spent
  min_bill_amount   numeric(10,2) DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_loyalty_rules" ON loyalty_rules
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "staff_read_loyalty_rules" ON loyalty_rules
  FOR SELECT TO authenticated USING (true);

-- Loyalty ledger — append-only point transaction log
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  points       integer NOT NULL,            -- positive = earn, negative = redeem
  type         text NOT NULL CHECK (type IN ('earn','redeem','adjust','expire')),
  reference_id uuid,                        -- invoice_id or transaction_id
  reference_type text,                      -- 'invoice' | 'transaction' | 'manual'
  note         text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_loyalty_ledger" ON loyalty_ledger
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "staff_read_loyalty_ledger" ON loyalty_ledger
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_client  ON loyalty_ledger(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_created ON loyalty_ledger(created_at DESC);

-- ── Reminders ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL CHECK (type IN ('birthday','appointment','membership','payment','custom')),
  client_id      uuid REFERENCES clients(id) ON DELETE CASCADE,
  client_name    text NOT NULL,
  client_phone   text NOT NULL,
  title          text NOT NULL,
  message        text,
  due_date       date NOT NULL,
  is_done        boolean NOT NULL DEFAULT false,
  done_at        timestamptz,
  done_by        uuid REFERENCES users(id),
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_reminders" ON reminders
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "staff_read_reminders" ON reminders
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_reminders_due_date  ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_client    ON reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_reminders_is_done   ON reminders(is_done);

-- ── QR Service Menu ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qr_menus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL DEFAULT 'Our Services',
  subtitle    text DEFAULT 'Premium Salon & Hair Care',
  footer_note text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qr_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_qr_menus" ON qr_menus
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "public_read_qr_menus" ON qr_menus
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE TABLE IF NOT EXISTS qr_menu_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id     uuid NOT NULL REFERENCES qr_menus(id) ON DELETE CASCADE,
  category    text NOT NULL,
  name        text NOT NULL,
  description text,
  price       numeric(10,2),
  duration_min integer,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qr_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_qr_menu_items" ON qr_menu_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "public_read_qr_menu_items" ON qr_menu_items
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Insert default loyalty rule
INSERT INTO loyalty_rules (name, description, points_per_rupee, min_bill_amount, is_active)
VALUES ('Standard Earn', 'Earn 1 point per ₹100 spent', 0.01, 0, true)
ON CONFLICT DO NOTHING;

-- Insert default QR menu
INSERT INTO qr_menus (title, subtitle, footer_note, is_active)
VALUES ('Image Skinn & Hair — Services', 'Premium Salon & Hair Care', 'Prices may vary. Book an appointment for exact quotes.', true)
ON CONFLICT DO NOTHING;
