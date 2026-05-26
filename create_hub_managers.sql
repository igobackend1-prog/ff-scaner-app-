-- ============================================================
-- FF Scanner — Create 3 Hub Manager Accounts
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: bvbfnguqpuctdvfztuda
-- ============================================================

-- ── Step 0: Add hub_id column to profiles (safe if already exists) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES public.hubs(id);


-- ── Step 1–3: Create hub manager auth accounts + profiles ────────────
DO $$
DECLARE
  hyd_id  UUID := gen_random_uuid();
  pali_id UUID := gen_random_uuid();
  vana_id UUID := gen_random_uuid();
BEGIN

  -- ── 1. Hyderabad Hub Manager ─────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    hyd_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'manager.hyd@ffactory.com',
    crypt('FF@HYD2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Hyderabad Hub Manager"}',
    false, ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), hyd_id,
    'manager.hyd@ffactory.com',
    jsonb_build_object('sub', hyd_id::text, 'email', 'manager.hyd@ffactory.com'),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (id, email, name, role, hub_id, created_at)
  VALUES (
    hyd_id,
    'manager.hyd@ffactory.com',
    'Hyderabad Hub Manager',
    'hub_manager',
    '46a6d58b-854e-4333-b840-80f45acb42d5',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    name   = EXCLUDED.name,
    role   = EXCLUDED.role,
    hub_id = EXCLUDED.hub_id;


  -- ── 2. Palikarani Hub Manager ────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    pali_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'manager.pali@ffactory.com',
    crypt('FF@PALI2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Palikarani Hub Manager"}',
    false, ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), pali_id,
    'manager.pali@ffactory.com',
    jsonb_build_object('sub', pali_id::text, 'email', 'manager.pali@ffactory.com'),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (id, email, name, role, hub_id, created_at)
  VALUES (
    pali_id,
    'manager.pali@ffactory.com',
    'Palikarani Hub Manager',
    'hub_manager',
    'b9758168-da7b-4047-ba6d-5a8b43a51b91',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    name   = EXCLUDED.name,
    role   = EXCLUDED.role,
    hub_id = EXCLUDED.hub_id;


  -- ── 3. Vanagaram Hub Manager ─────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    vana_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'manager.vana@ffactory.com',
    crypt('FF@VANA2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Vanagaram Hub Manager"}',
    false, ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), vana_id,
    'manager.vana@ffactory.com',
    jsonb_build_object('sub', vana_id::text, 'email', 'manager.vana@ffactory.com'),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (id, email, name, role, hub_id, created_at)
  VALUES (
    vana_id,
    'manager.vana@ffactory.com',
    'Vanagaram Hub Manager',
    'hub_manager',
    'ee223bb8-0daa-4bdd-a887-50bdb0ec3b47',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    name   = EXCLUDED.name,
    role   = EXCLUDED.role,
    hub_id = EXCLUDED.hub_id;


  RAISE NOTICE 'Hub manager accounts created successfully.';
END $$;


-- ============================================================
-- RLS Policies for boxes table
-- ============================================================

-- Enable RLS (idempotent)
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;

-- INSERT: hub managers can only create boxes for their own hub
DROP POLICY IF EXISTS hub_manager_insert_boxes ON public.boxes;
CREATE POLICY hub_manager_insert_boxes ON public.boxes
  FOR INSERT TO authenticated
  WITH CHECK (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
  );

-- SELECT: hub managers see only their hub's boxes; admins/gm see all
DROP POLICY IF EXISTS hub_manager_select_boxes ON public.boxes;
CREATE POLICY hub_manager_select_boxes ON public.boxes
  FOR SELECT TO authenticated
  USING (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'gm')
  );

-- UPDATE: hub managers can only update their hub's boxes
DROP POLICY IF EXISTS hub_manager_update_boxes ON public.boxes;
CREATE POLICY hub_manager_update_boxes ON public.boxes
  FOR UPDATE TO authenticated
  USING (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'gm')
  );


-- ============================================================
-- Verify — run these SELECTs to confirm everything was created
-- ============================================================
SELECT id, email, role, confirmed_at IS NOT NULL AS confirmed
FROM auth.users
WHERE email IN (
  'manager.hyd@ffactory.com',
  'manager.pali@ffactory.com',
  'manager.vana@ffactory.com'
);

SELECT p.id, p.email, p.name, p.role, h.name AS hub_name, h.code AS hub_code
FROM public.profiles p
LEFT JOIN public.hubs h ON h.id = p.hub_id
WHERE p.email IN (
  'manager.hyd@ffactory.com',
  'manager.pali@ffactory.com',
  'manager.vana@ffactory.com'
);
