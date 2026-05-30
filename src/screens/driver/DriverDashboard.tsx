import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getDriverPacks } from '@/lib/supabase';
import { DeliveryPack } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  packing: '#f59e0b',
  ready: '#2563eb',
  dispatched: '#7c3aed',
  delivered: '#16a34a',
  partial_delivered: '#f97316',
};

const STATUS_LABEL: Record<string, string> = {
  packing: 'Packing',
  ready: 'Ready',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  partial_delivered: 'Partial',
};

export default function DriverDashboard() {
  const { profile, signOut } = useAuth();
  const [packs, setPacks] = useState<DeliveryPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await getDriverPacks(profile.id, today);
    setPacks((data as DeliveryPack[]) ?? []);
  }, [profile?.id, today]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const delivered = packs.filter(p => p.status === 'delivered').length;
  const dispatched = packs.filter(p => p.status === 'dispatched').length;
  const pending = packs.filter(p => ['packing', 'ready'].includes(p.status)).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Today's Route</Text>
          <Text style={styles.name}>{profile?.name ?? 'Driver'}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#dc2626" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {packs.length > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Delivery Progress</Text>
            <Text style={styles.progressPct}>
              {packs.length > 0 ? Math.round((delivered / packs.length) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(delivered / packs.length) * 100}%` }]} />
          </View>
          <View style={styles.progressLegend}>
            <LegendDot color="#16a34a" label={`${delivered} Delivered`} />
            <LegendDot color="#7c3aed" label={`${dispatched} Out`} />
            <LegendDot color="#d1d5db" label={`${pending} Pending`} />
          </View>
        </View>
      )}

      {/* Pack list */}
      <Text style={styles.sectionTitle}>
        {packs.length === 0 ? 'No packs assigned today' : `${packs.length} Pack${packs.length > 1 ? 's' : ''} Assigned`}
      </Text>

      {packs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Deliveries Today</Text>
          <Text style={styles.emptyText}>Your packs will appear here once assigned by the hub manager.</Text>
        </View>
      ) : (
        packs.map(pack => {
          const itemCount = (pack.items as any[])?.length ?? 0;
          const color = STATUS_COLOR[pack.status] ?? '#6b7280';
          return (
            <View key={pack.id} style={styles.packCard}>
              <View style={styles.packHeader}>
                <View style={[styles.packStatusDot, { backgroundColor: color }]} />
                <Text style={styles.packCode}>{pack.pack_code}</Text>
                <View style={[styles.packStatusBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.packStatusText, { color }]}>
                    {STATUS_LABEL[pack.status]}
                  </Text>
                </View>
              </View>
              <View style={styles.packMeta}>
                <View style={styles.packMetaItem}>
                  <Ionicons name="cube-outline" size={14} color="#9ca3af" />
                  <Text style={styles.packMetaText}>{itemCount} boxes</Text>
                </View>
                <View style={styles.packMetaItem}>
                  <Ionicons name="location-outline" size={14} color="#9ca3af" />
                  <Text style={styles.packMetaText}>{(pack.hub as any)?.name ?? 'Hub'}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  greeting: { fontSize: 12, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },
  date: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  signOutBtn: { padding: 8 },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  progressPct: { fontSize: 14, fontWeight: '800', color: '#2563eb' },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  progressLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#6b7280' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  packCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  packHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  packStatusDot: { width: 8, height: 8, borderRadius: 4 },
  packCode: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  packStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  packStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  packMeta: { flexDirection: 'row', gap: 16 },
  packMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  packMetaText: { fontSize: 12, color: '#9ca3af' },
});
