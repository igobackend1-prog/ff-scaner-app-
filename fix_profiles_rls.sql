-- ============================================================
-- FF Scanner — Fix profiles RLS so logged-in users can read
-- their OWN profile (fixes "Not logged in / Please sign in first"
-- on the Wastage submit even though login succeeds).
--
-- Root cause: the profiles SELECT policy "managers_view" calls
-- get_my_role(), which reads public.profiles. If that function is
-- NOT SECURITY DEFINER, evaluating the policy re-triggers the policy
-- => "infinite recursion detected in policy for relation profiles".
-- The profile fetch then errors, profile stays null in the app.
--
-- Run this in: Supabase Dashboard -> SQL Editor (role: postgres)
-- ============================================================

-- 1. Make get_my_role() SECURITY DEFINER so it BYPASSES RLS when it
--    reads profiles. It only ever returns the caller's own role
--    (filtered by auth.uid()), so there is no privilege escalation.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Guarantee a dead-simple, non-recursive self-read policy.
--    Every authenticated user can always read their own row.
DROP POLICY IF EXISTS view_own ON public.profiles;
CREATE POLICY view_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 3. Self-update stays scoped to the owner (recreate cleanly).
DROP POLICY IF EXISTS update_own ON public.profiles;
CREATE POLICY update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4. Managers/admins can read other profiles. get_my_role() is now
--    SECURITY DEFINER, so this no longer recurses.
DROP POLICY IF EXISTS managers_view ON public.profiles;
CREATE POLICY managers_view ON public.profiles
  FOR SELECT TO authenticated
  USING (
    get_my_role() = ANY (ARRAY['admin','ceo','gm','hub_manager'])
    OR id = auth.uid()
  );

-- 5. Refresh PostgREST schema cache (helps the hub:hubs(...) join too).
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 6. VERIFY — deterministic checks (won't error).
-- ============================================================
-- (a) get_my_role() must now be SECURITY DEFINER (is_security_definer = true)
SELECT proname, prosecdef AS is_security_definer
FROM pg_proc
WHERE proname = 'get_my_role';

-- (b) profiles must have a simple self-read policy (view_own with id = auth.uid())
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- The REAL test: refresh the app, log in as a hub manager, and submit a
-- wastage entry. It should now succeed instead of "Not logged in".
