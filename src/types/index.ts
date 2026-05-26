// ─────────────────────────────────────────────
//  FF Scanner App — Shared Types
// ─────────────────────────────────────────────

export type UserRole = 'hub_manager' | 'driver' | 'admin' | 'gm';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: UserRole;
  hub_id: string | null;
  avatar_url: string | null;
  created_at: string;
  // joined via getProfile()
  hub?: Hub;
}

export interface Hub {
  id: string;
  name: string;
  code: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  pincode: string | null;
  capacity_kg: number | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  image_url: string | null;
}

export type BoxStatus =
  | 'created'
  | 'received'
  | 'qc_passed'
  | 'qc_failed'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'wasted';

export interface Box {
  id: string;
  box_code: string;
  po_item_id: string | null;
  product_id: string | null;
  hub_id: string | null;
  weight_kg: number | null;
  qr_url: string | null;
  barcode_url: string | null;
  status: BoxStatus;
  created_at: string;
  updated_at: string;
  // joined
  product?: Product;
  hub?: Hub;
}

// What's embedded in the QR code JSON
export interface QRPayload {
  box_id: string;
  box_code: string;
  product: string;
  weight_kg: number;
  hub: string;
  po_id: string;
  date: string;
}

export type InventoryEventType =
  | 'receive'
  | 'dispatch'
  | 'wastage'
  | 'qc_reject'
  | 'return'
  | 'adjustment';

export interface InventoryLog {
  id: string;
  inventory_id: string | null;
  hub_id: string;
  product_id: string;
  event_type: InventoryEventType;
  qty_delta: number;
  ref_id: string | null;
  ref_type: 'box' | 'pack' | 'order' | 'adjustment' | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type WastageReason =
  | 'damaged'
  | 'expired'
  | 'contaminated'
  | 'qc_fail'
  | 'other';

export interface WastageLog {
  id: string;
  box_id: string | null;
  hub_id: string | null;
  product_id: string | null;
  reason: WastageReason;
  weight_kg: number;
  photo_url: string | null;
  logged_by: string | null;
  logged_at: string;
}

export type DeliveryPackStatus =
  | 'packing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'partial_delivered';

export interface DeliveryPack {
  id: string;
  pack_code: string;
  hub_id: string | null;
  driver_id: string | null;
  route_date: string;
  status: DeliveryPackStatus;
  dispatched_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  hub?: Hub;
  items?: DeliveryPackItem[];
}

export interface DeliveryPackItem {
  id: string;
  pack_id: string;
  box_id: string;
  order_id: string | null;
  created_at: string;
  box?: Box;
}

// Scanner result from camera
export interface ScanResult {
  type: 'qr' | 'barcode';
  data: string;
  parsed: QRPayload | null; // null if it's just a barcode string
}
