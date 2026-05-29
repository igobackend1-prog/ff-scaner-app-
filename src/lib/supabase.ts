import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─────────────────────────────────────────────
//  Box helpers
// ─────────────────────────────────────────────

/** Look up a box by box_code (barcode scan) or by id (QR scan) */
export async function getBoxByCode(boxCode: string) {
  const { data, error } = await supabase
    .from('boxes')
    .select('*, product:products(id, name, sku, unit, image_url), hub:hubs(id, name, code)')
    .eq('box_code', boxCode)
    .single();
  return { data, error };
}

export async function getBoxById(boxId: string) {
  const { data, error } = await supabase
    .from('boxes')
    .select('*, product:products(id, name, sku, unit, image_url), hub:hubs(id, name, code)')
    .eq('id', boxId)
    .single();
  return { data, error };
}

/** Update box status */
export async function updateBoxStatus(boxId: string, status: string) {
  const { data, error } = await supabase
    .from('boxes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single();
  return { data, error };
}

// ─────────────────────────────────────────────
//  Inventory log helpers
// ─────────────────────────────────────────────

export async function logInventoryEvent({
  hubId,
  productId,
  eventType,
  qtyDelta,
  refId,
  refType,
  notes,
  createdBy,
}: {
  hubId: string;
  productId: string;
  eventType: string;
  qtyDelta: number;
  refId?: string;
  refType?: string;
  notes?: string;
  createdBy?: string;
}) {
  const { data, error } = await supabase
    .from('inventory_log')
    .insert({
      hub_id: hubId,
      product_id: productId,
      event_type: eventType,
      qty_delta: qtyDelta,
      ref_id: refId ?? null,
      ref_type: refType ?? null,
      notes: notes ?? null,
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  return { data, error };
}

// ─────────────────────────────────────────────
//  Wastage log helpers
// ─────────────────────────────────────────────

export async function logWastage({
  boxId,
  hubId,
  productId,
  reason,
  weightKg,
  photoUrl,
  loggedBy,
}: {
  boxId: string;
  hubId: string;
  productId: string;
  reason: string;
  weightKg: number;
  photoUrl?: string;
  loggedBy?: string;
}) {
  const { data, error } = await supabase
    .from('wastage_log')
    .insert({
      box_id: boxId,
      hub_id: hubId,
      product_id: productId,
      reason,
      weight_kg: weightKg,
      photo_url: photoUrl ?? null,
      logged_by: loggedBy ?? null,
    })
    .select()
    .single();
  return { data, error };
}

// ─────────────────────────────────────────────
//  Delivery pack helpers
// ─────────────────────────────────────────────

export async function getPackByCode(packCode: string) {
  const { data, error } = await supabase
    .from('delivery_packs')
    .select('*, hub:hubs(id, name, code), items:delivery_pack_items(*, box:boxes(*, product:products(id, name, sku)))')
    .eq('pack_code', packCode)
    .single();
  return { data, error };
}

export async function getDriverPacks(driverId: string, routeDate: string) {
  const { data, error } = await supabase
    .from('delivery_packs')
    .select('*, hub:hubs(id, name, code), items:delivery_pack_items(id, box_id, order_id)')
    .eq('driver_id', driverId)
    .eq('route_date', routeDate)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function updatePackStatus(packId: string, status: string) {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'dispatched') updates.dispatched_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('delivery_packs')
    .update(updates)
    .eq('id', packId)
    .select()
    .single();
  return { data, error };
}

// ─────────────────────────────────────────────
//  Profile helpers
// ─────────────────────────────────────────────

export async function getProfile(userId: string) {
  // Attempt 1: profile + embedded hub join (requires PostgREST to know the hub_id FK)
  const joined = await supabase
    .from('profiles')
    .select('*, hub:hubs(id, name, code, address)')
    .eq('id', userId)
    .single();

  if (!joined.error) return joined;

  // The join can fail for several reasons (stale PostgREST schema cache after
  // ALTER TABLE, hub RLS, FK not detected, etc.). Rather than only retrying on
  // "schema" errors, ALWAYS fall back to a plain profile fetch so a null profile
  // never silently strands the user on a screen they can't use.
  console.warn('[getProfile] Hub-join query failed, falling back to plain profile:', joined.error.message);

  const plain = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (plain.error) {
    // This is the real problem if it happens — RLS denying/recursing on profiles.
    console.error(
      '[getProfile] Plain profile fetch ALSO failed. The user is authenticated but cannot read their own profile row. ' +
      'This is almost always an RLS issue on public.profiles (e.g. infinite recursion via a helper function that is not SECURITY DEFINER). Error:',
      plain.error.message,
      plain.error
    );
    return plain;
  }

  // Best-effort: fetch the hub separately so the UI still gets hub context.
  if (plain.data?.hub_id) {
    const { data: hub } = await supabase
      .from('hubs')
      .select('id, name, code, address')
      .eq('id', plain.data.hub_id)
      .single();
    if (hub) (plain.data as any).hub = hub;
  }

  return plain;
}

/** Fetch boxes scoped to the current manager's hub */
export async function getHubBoxes(hubId: string, status?: string) {
  let query = supabase
    .from('boxes')
    .select('*, product:products(id, name, sku, unit), hub:hubs(id, name, code)')
    .eq('hub_id', hubId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  return query;
}

/** Fetch today's inventory events for a hub */
export async function getHubInventoryToday(hubId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('inventory_log')
    .select('*')
    .eq('hub_id', hubId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);
  return { data, error };
}
