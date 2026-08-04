/*
# Payment Tracking Enhancements

## Purpose
Enhance the billing payment system to support multiple payments per invoice
with full tracking of Paid, Partially Paid, and Pending statuses.

## Changes

### 1. payments table — new columns
- `received_by` (text, nullable): Name of the staff member who received the payment.
  This is separate from `created_by` (which is a UUID FK to auth.users) so the
  human-readable name is always available even if the user account is later removed.

### 2. payments table — new UPDATE policy
- `staff_update_payments`: Allows admin and operator roles to update payment records.
  Previously only read, insert (admin+operator), and delete (admin only) existed.

## Security
- RLS already enabled on payments table.
- New UPDATE policy follows the same role-check pattern as existing policies
  (checks app_metadata.role is in ['admin', 'operator']).

## Notes
- The `payment_date` column already stores a full timestamp (timestamptz) which
  includes both date and time, so no separate time column is needed.
- Invoice `amount_paid` and `payment_status` are updated by the frontend after
  each payment is recorded — the frontend recalculates totals from all payments.
- No data migration needed — existing payments get NULL for received_by.
*/

-- Add received_by column to payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'received_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN received_by text;
  END IF;
END $$;

-- Add UPDATE policy for payments (admin + operator can update)
DROP POLICY IF EXISTS "staff_update_payments" ON payments;
CREATE POLICY "staff_update_payments"
ON payments FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operator')
);
