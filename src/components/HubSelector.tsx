// @ts-nocheck
/**
 * HubSelector — dropdown showing all hubs sorted by GPS distance.
 * - hub_manager: pre-locked to their assigned hub (read-only)
 * - admin / gm: can pick any hub, GPS auto-selects nearest
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ── Haversine distance in km ──────────────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

// ── Types ─────────────────────────────────────────────────────
interface HubRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  is_active: boolean;
  distKm?: number;
  isNearest?: boolean;
  isWithinRadius?: boolean;
}

interface Props {
  selectedHubId: string | null;
  onSelect: (hub: HubRow) => void;
}

// ── Component ─────────────────────────────────────────────────
export default function HubSelector({ selectedHubId, onSelect }: Props) {
  const { profile } = useAuth();
  const isLocked = profile?.role === 'hub_manager';

  const [hubs, setHubs]             = useState<HubRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [locating, setLocating]     = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [userLat, setUserLat]       = useState<number | null>(null);
  const [userLng, setUserLng]       = useState<number | null>(null);

  const selected = hubs.find(h => h.id === selectedHubId) ?? null;

  // ── Load hubs + GPS on mount ────────────────────────────────
  useEffect(() => {
    loadHubs();
    requestLocation();
  }, []);

  // Re-sort when GPS comes in
  useEffect(() => {
    if (userLat !== null && userLng !== null && hubs.length > 0) {
      sortByDistance(hubs, userLat, userLng);
    }
  }, [userLat, userLng]);

  const loadHubs = async () => {
    try {
      // Race the fetch against a 10s timeout so a dead/slow network can NEVER
      // hang the spinner forever. The bare `await` had no timeout, so on a weak
      // connection it never resolved and setLoading(false) was never reached.
      const fetchHubs = supabase.from('hubs').select('*').order('name');
      const timeout = new Promise<{ data: null; error: { message: string; code: string } }>(
        resolve => setTimeout(
          () => resolve({ data: null, error: { message: 'Request timed out', code: 'TIMEOUT' } }),
          10000,
        ),
      );
      const { data, error } = (await Promise.race([fetchHubs, timeout])) as any;

      if (error) {
        console.warn('[HubSelector] fetch error:', error.message, error.code);
      }

      // Normalise whatever rows we got — set radius_km default 5 if missing
      let rows: HubRow[] = Array.isArray(data)
        ? (data as any[]).map(h => ({
            ...h,
            radius_km: h.radius_km ?? 5,
            lat: h.lat ?? null,
            lng: h.lng ?? null,
          }))
        : [];

      // Fallback: a locked hub_manager is tied to exactly one hub. If the fetch
      // failed / timed out / returned nothing, use the hub already loaded on their
      // profile so they are NEVER stranded on "Loading hubs…".
      if (rows.length === 0 && isLocked && profile?.hub_id) {
        const ph = profile.hub;
        rows = [{
          id: profile.hub_id,
          name: ph?.name ?? 'My Hub',
          code: ph?.code ?? '',
          address: ph?.address ?? null,
          lat: ph?.lat ?? null,
          lng: ph?.lng ?? null,
          radius_km: ph?.radius_km ?? 5,
          is_active: true,
        }];
      }

      setHubs(rows);

      // Auto-select logic on first load
      if (!selectedHubId && rows.length > 0) {
        if (isLocked && profile?.hub_id) {
          const assigned = rows.find(h => h.id === profile.hub_id) ?? rows[0];
          if (assigned) onSelect(assigned);
        } else if (rows.length === 1) {
          onSelect(rows[0]);
        }
      }
    } catch (e: any) {
      console.warn('[HubSelector] loadHubs exception:', e?.message ?? e);
    } finally {
      // ALWAYS stop the spinner, no matter what happened above.
      setLoading(false);
    }
  };

  const requestLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLat(pos.coords.latitude);
      setUserLng(pos.coords.longitude);
    } catch (e) {
      console.warn('GPS error:', e);
    } finally {
      setLocating(false);
    }
  };

  const sortByDistance = (rows: HubRow[], lat: number, lng: number) => {
    const enriched = rows.map(h => {
      if (h.lat == null || h.lng == null) return { ...h, distKm: undefined };
      const distKm = haversineKm(lat, lng, h.lat, h.lng);
      return {
        ...h,
        distKm,
        isWithinRadius: distKm <= h.radius_km,
      };
    });

    // Find nearest hub
    const withDist = enriched.filter(h => h.distKm !== undefined);
    if (withDist.length > 0) {
      const nearest = withDist.reduce((a, b) =>
        (a.distKm ?? 999) < (b.distKm ?? 999) ? a : b
      );
      const final = enriched.map(h => ({
        ...h,
        isNearest: h.id === nearest.id,
      }));
      const sorted = [...final].sort(
        (a, b) => (a.distKm ?? 999) - (b.distKm ?? 999)
      );
      setHubs(sorted);

      // Auto-select nearest if admin/gm and nothing selected yet
      if (!isLocked && !selectedHubId) {
        onSelect(nearest);
      }
    } else {
      setHubs(enriched);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#ea580c" />
        <Text style={styles.loadingText}>Loading hubs…</Text>
      </View>
    );
  }

  return (
    <>
      {/* Trigger */}
      <TouchableOpacity
        style={[styles.trigger, isLocked && styles.triggerLocked]}
        onPress={() => !isLocked && setShowModal(true)}
        activeOpacity={isLocked ? 1 : 0.7}
      >
        <View style={styles.triggerLeft}>
          <Ionicons name="business-outline" size={18} color="#ea580c" />
          <View style={styles.triggerInfo}>
            {selected ? (
              <>
                <Text style={styles.triggerName}>{selected.name}</Text>
                <View style={styles.triggerMeta}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{selected.code}</Text>
                  </View>
                  {selected.isWithinRadius && (
                    <View style={styles.hereBadge}>
                      <Ionicons name="location" size={10} color="#16a34a" />
                      <Text style={styles.hereText}>You are here</Text>
                    </View>
                  )}
                  {selected.distKm !== undefined && !selected.isWithinRadius && (
                    <Text style={styles.distText}>{fmtDist(selected.distKm)}</Text>
                  )}
                  {locating && (
                    <ActivityIndicator size={10} color="#9ca3af" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.placeholderText}>Select hub…</Text>
            )}
          </View>
        </View>
        {isLocked ? (
          <Ionicons name="lock-closed-outline" size={15} color="#9ca3af" />
        ) : (
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        )}
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Hub</Text>
              {locating && (
                <Text style={styles.modalSub}>
                  <ActivityIndicator size={10} color="#ea580c" /> Getting your location…
                </Text>
              )}
              {!locating && userLat !== null && (
                <Text style={styles.modalSub}>📍 Sorted by distance from you</Text>
              )}
              {!locating && userLat === null && (
                <Text style={styles.modalSub}>Enable location for distance info</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close-circle" size={28} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={hubs}
            keyExtractor={h => h.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
                <Ionicons name="business-outline" size={40} color="#d1d5db" />
                <Text style={{ color: '#9ca3af', fontSize: 14 }}>No hubs found in database</Text>
                <Text style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                  Check that the hubs table has data and RLS allows reading
                </Text>
              </View>
            }
            renderItem={({ item: hub }) => {
              const isSelected = hub.id === selectedHubId;
              return (
                <TouchableOpacity
                  style={[styles.hubCard, isSelected && styles.hubCardSelected]}
                  onPress={() => { onSelect(hub); setShowModal(false); }}
                  activeOpacity={0.8}
                >
                  {/* Left: Icon + info */}
                  <View style={[styles.hubIcon, isSelected && styles.hubIconSelected]}>
                    <Ionicons
                      name="business"
                      size={22}
                      color={isSelected ? '#fff' : '#ea580c'}
                    />
                  </View>

                  <View style={styles.hubInfo}>
                    <View style={styles.hubNameRow}>
                      <Text style={[styles.hubName, isSelected && styles.hubNameSelected]}>
                        {hub.name}
                      </Text>
                      <View style={[styles.codeBadge, isSelected && styles.codeBadgeSelected]}>
                        <Text style={[styles.codeText, isSelected && { color: '#fff' }]}>
                          {hub.code}
                        </Text>
                      </View>
                    </View>

                    {hub.address ? (
                      <Text style={styles.hubAddress} numberOfLines={1}>
                        {hub.address}
                      </Text>
                    ) : null}

                    <View style={styles.hubTagRow}>
                      {hub.isWithinRadius && (
                        <View style={styles.hereBadge}>
                          <Ionicons name="location" size={10} color="#16a34a" />
                          <Text style={styles.hereText}>You are here</Text>
                        </View>
                      )}
                      {hub.distKm !== undefined && (
                        <Text style={[styles.distText, hub.isWithinRadius && { color: '#16a34a' }]}>
                          {fmtDist(hub.distKm)}
                        </Text>
                      )}
                      {hub.isNearest && !hub.isWithinRadius && (
                        <View style={styles.nearestBadge}>
                          <Text style={styles.nearestText}>Nearest</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Right: checkmark */}
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#ea580c" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f3f4f6', borderRadius: 10, padding: 13,
  },
  loadingText: { fontSize: 14, color: '#9ca3af' },

  // Trigger
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fdba74',
    borderRadius: 12, padding: 13,
    backgroundColor: '#fff7ed',
    justifyContent: 'space-between',
  },
  triggerLocked: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  triggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  triggerInfo: { flex: 1 },
  triggerName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  triggerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  placeholderText: { fontSize: 15, color: '#9ca3af' },

  // Badges
  codeBadge: {
    backgroundColor: '#fef3c7', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  codeBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  codeText: { fontSize: 11, fontWeight: '800', color: '#b45309' },
  hereBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#dcfce7', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  hereText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  distText: { fontSize: 11, color: '#9ca3af' },
  nearestBadge: {
    backgroundColor: '#fff7ed', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#fdba74',
  },
  nearestText: { fontSize: 10, fontWeight: '700', color: '#ea580c' },

  // Modal
  modal: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Hub cards
  hubCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 14, gap: 12,
    borderWidth: 2, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  hubCardSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  hubIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center', alignItems: 'center',
  },
  hubIconSelected: { backgroundColor: '#ea580c' },
  hubInfo: { flex: 1 },
  hubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hubName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  hubNameSelected: { color: '#9a3412' },
  hubAddress: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  hubTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
});
