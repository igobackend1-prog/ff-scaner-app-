-- ============================================================
-- FF Scanner — Fix Hub Manager Profiles (accounts already exist)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 0: Add hub_id column (safe if already exists)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES public.hubs(id);

-- Step 1: Upsert profiles using existing auth.users IDs
DO $$
DECLARE
  hyd_id  UUID;
  pali_id UUID;
  vana_id UUID;
BEGIN
  -- Get existing user IDs from auth.users
  SELECT id INTO hyd_id  FROM auth.users WHERE email = 'manager.hyd@ffactory.com'  LIMIT 1;
  SELECT id INTO pali_id FROM auth.users WHERE email = 'manager.pali@ffactory.com' LIMIT 1;
  SELECT id INTO vana_id FROM auth.users WHERE email = 'manager.vana@ffactory.com' LIMIT 1;

  -- Hyderabad
  INSERT INTO public.profiles (id, email, name, role, hub_id, created_at)
  VALUES (hyd_id, 'manager.hyd@ffactory.com', 'Hyderabad Hub Manager', 'hub_manager', '46a6d58b-854e-4333-b840-80f45acb42d5', NOW())
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    name   = EXCLUDED.name,
    role   = EXCLUDED.role,
    hub_id = EXCLUDED.hub_id;

  -- Palikarani
  INSERT INTO public.profiles (id, email, name, role, hub_id, created_at)
  VALUES (pali_id, 'manager.pali@ffactory.com', 'Palikarani Hub Manager', 'hub_manager', 'b9758168-da7b-4047-ba6d-5a8b43a51b91', NOW())
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    name   = EXCLUDED.name,
    role   = EXCLUDED.role,
    hub_id = EXCLUDED.hub_id;

  -- Vanagaram
  INSERT INTO public.profiles (id, email, name, role, hub_id, created_at)
  VALUES (vana_id, 'manager.vana@ffactory.com', 'Vanagaram Hub Manager', 'hub_manager', 'ee223bb8-0daa-4bdd-a887-50bdb0ec3b47', NOW())
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    name   = EXCLUDED.name,
    role   = EXCLUDED.role,
    hub_id = EXCLUDED.hub_id;

  RAISE NOTICE 'Profiles updated. hyd=% pali=% vana=%', hyd_id, pali_id, vana_id;
END $$;


-- ============================================================
-- RLS Policies for boxes table
-- ============================================================
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_manager_insert_boxes ON public.boxes;
CREATE POLICY hub_manager_insert_boxes ON public.boxes
  FOR INSERT TO authenticated
  WITH CHECK (hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS hub_manager_select_boxes ON public.boxes;
CREATE POLICY hub_manager_select_boxes ON public.boxes
  FOR SELECT TO authenticated
  USING (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','gm')
  );

DROP POLICY IF EXISTS hub_manager_update_boxes ON public.boxes;
CREATE POLICY hub_manager_update_boxes ON public.boxes
  FOR UPDATE TO authenticated
  USING (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','gm')
  );


-- ============================================================
-- Verify
-- ============================================================
SELECT id, email, role, confirmed_at IS NOT NULL AS confirmed
FROM auth.users
WHERE email IN ('manager.hyd@ffactory.com','manager.pali@ffactory.com','manager.vana@ffactory.com');

SELECT p.id, p.email, p.name, p.role, h.name AS hub_name, h.code AS hub_code
FROM public.profiles p
LEFT JOIN public.hubs h ON h.id = p.hub_id
WHERE p.email IN ('manager.hyd@ffactory.com','manager.pali@ffactory.com','manager.vana@ffactory.com');
