-- Function to safely increment coupon uses_count
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupons
  SET uses_count = uses_count + 1,
      updated_at = now()
  WHERE code = upper(coupon_code);
END;
$$;
