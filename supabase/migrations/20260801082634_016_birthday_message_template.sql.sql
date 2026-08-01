/*
# Birthday Message Template Table

1. Purpose
   - Stores the admin-defined default birthday message template and birthday offer.
   - Admin can create, edit, and delete the template.
   - Operators can read the template (to pre-fill messages) but cannot modify it.

2. New Table: reminder_templates
   - id (uuid PK)
   - type (text, e.g. 'birthday') — identifies which reminder type this template is for
   - title (text) — short label shown in the UI
   - body (text) — the message body with {{client_name}} and {{offer}} placeholders
   - offer (text) — the admin-defined offer text (e.g. "20% off on all services")
   - is_active (boolean, default true)
   - updated_by (uuid, references users)
   - created_at / updated_at (timestamptz)

3. Seed Data
   - Inserts one default 'birthday' template so the system works out of the box.

4. Security (RLS)
   - Enable RLS on reminder_templates.
   - Admin-only full CRUD (select/insert/update/delete).
   - Operators (any authenticated user) can SELECT so they can read the template
     to pre-fill birthday messages, but cannot insert/update/delete.
*/

CREATE TABLE IF NOT EXISTS public.reminder_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL DEFAULT 'birthday',
  title       text NOT NULL,
  body        text NOT NULL,
  offer       text,
  is_active   boolean NOT NULL DEFAULT true,
  updated_by  uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD
DROP POLICY IF EXISTS "admin_select_reminder_templates" ON public.reminder_templates;
CREATE POLICY "admin_select_reminder_templates"
  ON public.reminder_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_insert_reminder_templates" ON public.reminder_templates;
CREATE POLICY "admin_insert_reminder_templates"
  ON public.reminder_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_update_reminder_templates" ON public.reminder_templates;
CREATE POLICY "admin_update_reminder_templates"
  ON public.reminder_templates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_reminder_templates" ON public.reminder_templates;
CREATE POLICY "admin_delete_reminder_templates"
  ON public.reminder_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Operators: read-only (so they can pre-fill birthday messages)
DROP POLICY IF EXISTS "operator_read_reminder_templates" ON public.reminder_templates;
CREATE POLICY "operator_read_reminder_templates"
  ON public.reminder_templates FOR SELECT TO authenticated
  USING (is_active = true);

-- Seed a default birthday template
INSERT INTO public.reminder_templates (type, title, body, offer, is_active)
VALUES (
  'birthday',
  'Birthday Wishes',
  'Happy Birthday, {{client_name}}! 🎂\n\nWishing you a wonderful day filled with joy and beauty!\n\nSpecial Birthday Offer: {{offer}}\n\nVisit us soon to redeem your gift.\n— Image Skinn & Hair',
  'Flat 20% off on all services (valid for 7 days)',
  true
)
ON CONFLICT DO NOTHING;
