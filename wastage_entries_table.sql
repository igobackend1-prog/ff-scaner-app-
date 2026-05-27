-- ============================================================
-- FF Scanner — wastage_entries table + storage bucket
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Create wastage_entries table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.wastage_entries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_id       UUID REFERENCES public.hubs(id),
  hub_name     TEXT,
  item_name    TEXT NOT NULL,
  quantity_kg  NUMERIC(10,3) NOT NULL CHECK (quantity_kg > 0),
  amount       NUMERIC(10,2),          -- estimated loss in ₹ (optional)
  reason       TEXT,
  photo_1_url  TEXT NOT NULL,
  photo_2_url  TEXT NOT NULL,
  entry_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_by UUID REFERENCES auth.users(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Index for fast queries by hub + date ──────────────────
CREATE INDEX IF NOT EXISTS idx_wastage_entries_hub_date
  ON public.wastage_entries (hub_id, entry_date);

-- ── 3. Enable RLS ────────────────────────────────────────────
ALTER TABLE public.wastage_entries ENABLE ROW LEVEL SECURITY;

-- Hub managers see only their hub's entries; admins/gm see all
DROP POLICY IF EXISTS wastage_entries_select ON public.wastage_entries;
CREATE POLICY wastage_entries_select ON public.wastage_entries
  FOR SELECT TO authenticated
  USING (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'gm')
  );

-- Hub managers can insert for their own hub
DROP POLICY IF EXISTS wastage_entries_insert ON public.wastage_entries;
CREATE POLICY wastage_entries_insert ON public.wastage_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    hub_id = (SELECT hub_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'gm')
  );

-- ── 4. Storage bucket for wastage photos ─────────────────────
-- NOTE: The bucket is created via this SQL but you must also
-- go to Supabase Storage → New Bucket → name: "wastage-photos" → Public: ON
-- if this INSERT fails (bucket already exists, that's OK).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wastage-photos',
  'wastage-photos',
  true,
  10485760,   -- 10 MB per photo
  ARRAY['image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage: authenticated users can upload wastage photos
DROP POLICY IF EXISTS "wastage photos upload" ON storage.objects;
CREATE POLICY "wastage photos upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wastage-photos');

-- Storage: anyone can view wastage photos (public bucket)
DROP POLICY IF EXISTS "wastage photos public read" ON storage.objects;
CREATE POLICY "wastage photos public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'wastage-photos');

-- ── 5. Verify ────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'wastage_entries'
  AND table_schema = 'public'
ORDER BY ordinal_position;
