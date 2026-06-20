-- ═══════════════════════════════════════════════════════════════════════════
--  013_billing_enhancements.sql
--  Adds payments table for partial-payment tracking.
--  All changes are additive — no existing data is modified.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. payments table ────────────────────────────────────────────────────────
-- Stores every individual payment event against an invoice.
-- Enables full partial-payment history and outstanding balance calculation.
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL,
  payment_method   text NOT NULL DEFAULT 'cash',
  payment_date     timestamptz NOT NULL DEFAULT now(),
  notes            text,
  created_by       uuid,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_payments"   ON public.payments FOR SELECT
  TO authenticated USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "staff_insert_payments" ON public.payments FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin','operator'));
CREATE POLICY "admin_delete_payments" ON public.payments FOR DELETE
  TO authenticated USING ((auth.jwt()->'app_metadata'->>'role')='admin');

-- ── 2. client_id column on invoices (nullable, already may exist) ────────────
-- Already exists from migration 012. This is a no-op guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'coupon_code'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN coupon_code text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'coupon_discount'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN coupon_discount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- ── 3. Wire audit trigger onto payments ──────────────────────────────────────
DROP TRIGGER IF EXISTS after_payments_change ON public.payments;
CREATE TRIGGER after_payments_change
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_change();
