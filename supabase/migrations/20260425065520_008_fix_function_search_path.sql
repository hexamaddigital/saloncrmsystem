/*
  # Fix Mutable Search Path on update_updated_at_column Function

  Sets a fixed search_path on the trigger function to prevent search_path
  injection attacks. Using SET search_path = '' and fully qualifying all
  object references with their schema names.
*/

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
