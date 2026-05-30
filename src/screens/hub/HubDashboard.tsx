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
import { supabase } from '@/lib/supabase';

interface HubStats {
  pendingReceive: number;
  qcToday: number;
  wastageToday: number;
  totalStock: number;
}

interface RecentLog {
  id: string;
  event_type: string;
  qty_delta: number;
  created_at: string;
  product?: { name: string };
}

export default function HubDashboard() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<HubStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.hub_id) return;

    const today = new Date().toISOString().split('T')[0];

    // Boxes pending receive at this hub
    const { count: pending } = await supabase
      .from('boxes')
      .select('*', { count: 'exact', head: true })
      .eq('hub_id', profile.hub_id)
      .eq('status', 'created');

    // QC actions today
    const { count: qcToday } = await supabase
      .from('boxes')
      .select('*', { count: 'exact', head: true })
      .eq('hub_id', profile.hub_id)
      .in('status', ['qc_passed', 'qc_failed'])
      .gte('updated_at', today);

    // Wastage today
    const { count: wastage } = await supabase
      .from('wastage_entries')
      .select('*', { count: 'exact', head: true })
      .eq('hub_id', profile.hub_id)
      .gte('entry_date', today);

    // Total stock at hub (sum of inventory.quantity)
    const { data: invData } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('hub_id', profile.hub_id);
    const totalStock = invData?.reduce((sum, row) => sum + (row.quantity ?? 0), 0) ?? 0;

    setStats({
      pendingReceive: pending ?? 0,
      qcToday: qcToday ?? 0,
      wastageToday: wastage ?? 0,
      totalStock,
    });

    // Recent inventory logs
    const { data: logs } = await supabase
      .from('inventory_log')
      .select('id, event_type, qty_delta, created_at, product:products(name)')
      .eq('hub_id', profile.hub_id)
      .order('created_at', { ascending: false })
      .limit(10);

    setRecentLogs((logs as RecentLog[]) ?? []);
  }, [profile?.hub_id]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const eventColor = (type: string) => {
    const colors: Record<string, string> = {
      receive: '#16a34a',
      dispatch: '#2563eb',
      wastage: '#dc2626',
      qc_reject: '#f59e0b',
      return: '#7c3aed',
      adjustment: '#6b7280',
    };
    return colors[type] ?? '#6b7280';
  };

  const eventIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      receive: 'arrow-down-circle-outline',
      dispatch: 'arrow-up-circle-outline',
      wastage: 'trash-outline',
      qc_reject: 'close-circle-outline',
      return: 'refresh-circle-outline',
      adjustment: 'create-outline',
    };
    return icons[type] ?? 'ellipse-outline';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()},</Text>
          <Text style={styles.name}>{profile?.name ?? 'Manager'}</Text>
          <Text style={styles.hubBadge}>🏭 Hub Manager</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#dc2626" />
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="cube-outline"
          label="Pending Receive"
          value={stats?.pendingReceive ?? 0}
          color="#f59e0b"
          bg="#fffbeb"
        />
        <StatCard
          icon="checkmark-done-outline"
          label="QC Today"
          value={stats?.qcToday ?? 0}
          color="#16a34a"
          bg="#f0fdf4"
        />
        <StatCard
          icon="trash-outline"
          label="Wastage Today"
          value={stats?.wastageToday ?? 0}
          color="#dc2626"
          bg="#fef2f2"
        />
        <StatCard
          icon="layers-outline"
          label="Total Stock (kg)"
          value={stats?.totalStock ?? 0}
          color="#2563eb"
          bg="#eff6ff"
        />
      </View>

      {/* Recent activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>

      {recentLogs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={32} color="#d1d5db" />
          <Text style={styles.emptyText}>No activity yet today</Text>
        </View>
      ) : (
        recentLogs.map(log => (
          <View key={log.id} style={styles.logRow}>
            <View style={[styles.logIcon, { backgroundColor: eventColor(log.event_type) + '20' }]}>
              <Ionicons name={eventIcon(log.event_type)} size={18} color={eventColor(log.event_type)} />
            </View>
            <View style={styles.logInfo}>
              <Text style={styles.logProduct}>{(log.product as any)?.name ?? 'Unknown Product'}</Text>
              <Text style={styles.logMeta}>
                {log.event_type.replace('_', ' ')} · {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[styles.logDelta, { color: log.qty_delta > 0 ? '#16a34a' : '#dc2626' }]}>
              {log.qty_delta > 0 ? '+' : ''}{log.qty_delta} kg
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color, bg }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  greeting: { fontSize: 13, color: '#6b7280' },
  name: { fontSize: 20, fontWeight: '800', color: '#111827' },
  hubBadge: { fontSize: 12, color: '#16a34a', marginTop: 2, fontWeight: '600' },
  signOutBtn: { padding: 8 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logInfo: { flex: 1 },
  logProduct: { fontSize: 14, fontWeight: '600', color: '#111827' },
  logMeta: { fontSize: 12, color: '#9ca3af', textTransform: 'capitalize', marginTop: 2 },
  logDelta: { fontSize: 14, fontWeight: '700' },
});
