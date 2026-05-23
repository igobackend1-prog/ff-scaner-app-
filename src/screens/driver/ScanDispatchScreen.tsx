import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScannerCamera from '@/components/ScannerCamera';
import { getPackByCode, updatePackStatus, logInventoryEvent } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DeliveryPack, ScanResult } from '@/types';

type Step = 'scan' | 'confirm' | 'done';

export default function ScanDispatchScreen() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('scan');
  const [pack, setPack] = useState<DeliveryPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastPack, setLastPack] = useState('');

  const handleScan = async (result: ScanResult) => {
    setLoading(true);
    // Pack barcodes contain the pack_code directly
    const { data, error } = await getPackByCode(result.data);
    setLoading(false);

    if (error || !data) {
      Alert.alert('Pack not found', `No pack with code: ${result.data}`);
      return;
    }

    const foundPack = data as DeliveryPack;
    if (foundPack.status === 'dispatched') {
      Alert.alert('Already Dispatched', `Pack ${foundPack.pack_code} is already out for delivery.`);
      return;
    }
    if (foundPack.status === 'delivered') {
      Alert.alert('Already Delivered', `Pack ${foundPack.pack_code} has been delivered.`);
      return;
    }

    setPack(foundPack);
    setStep('confirm');
  };

  const handleDispatch = async () => {
    if (!pack || !profile) return;
    setLoading(true);

    // 1. Update pack status → dispatched
    const { error } = await updatePackStatus(pack.id, 'dispatched');
    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    // 2. Log dispatch inventory events for each box in the pack
    const items = pack.items ?? [];
    for (const item of items) {
      const box = item.box as any;
      if (box?.hub_id && box?.product_id) {
        await logInventoryEvent({
          hubId: box.hub_id,
          productId: box.product_id,
          eventType: 'dispatch',
          qtyDelta: -(box.weight_kg ?? 0),
          refId: pack.id,
          refType: 'pack',
          notes: `Dispatched in pack: ${pack.pack_code}`,
          createdBy: profile.id,
        });
      }
    }

    setLoading(false);
    setLastPack(pack.pack_code);
    setStep('done');
  };

  const reset = () => {
    setStep('scan');
    setPack(null);
  };

  if (step === 'scan') {
    return (
      <View style={{ flex: 1 }}>
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.overlayText}>Looking up pack...</Text>
          </View>
        )}
        <ScannerCamera
          onScan={handleScan}
          active={!loading}
          hint="Scan delivery pack barcode to dispatch"
        />
        {lastPack ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.successText}>Dispatched: {lastPack}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (step === 'confirm' && pack) {
    const hub = pack.hub as any;
    const items = pack.items ?? [];

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.packCard}>
          <View style={styles.packHeader}>
            <View style={styles.packIconBg}>
              <Ionicons name="cube-outline" size={28} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.packCode}>{pack.pack_code}</Text>
              <Text style={styles.packSub}>Hub: {hub?.name ?? '—'} · {items.length} boxes</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{pack.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Box list */}
          {items.length > 0 && (
            <>
              <Text style={styles.boxListTitle}>Contents ({items.length} boxes)</Text>
              {items.slice(0, 5).map((item: any) => (
                <View key={item.id} style={styles.boxRow}>
                  <Ionicons name="cube-outline" size={14} color="#9ca3af" />
                  <Text style={styles.boxRowText}>
                    {item.box?.box_code ?? item.box_id} — {item.box?.product?.name ?? 'Product'}
                  </Text>
                  <Text style={styles.boxRowWeight}>{item.box?.weight_kg ?? '?'} kg</Text>
                </View>
              ))}
              {items.length > 5 && (
                <Text style={styles.moreBoxes}>+{items.length - 5} more boxes</Text>
              )}
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.dispatchBtn, loading && { opacity: 0.6 }]}
          onPress={handleDispatch}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="rocket-outline" size={22} color="#fff" />
              <Text style={styles.dispatchBtnText}>Confirm Dispatch</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
          <Text style={styles.cancelText}>← Scan Different Pack</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Done
  return (
    <View style={[styles.container, styles.doneContainer]}>
      <View style={styles.doneIconBg}>
        <Ionicons name="rocket" size={56} color="#2563eb" />
      </View>
      <Text style={styles.doneTitle}>Pack Dispatched!</Text>
      <Text style={styles.doneSub}>{lastPack}</Text>
      <Text style={styles.doneNote}>Inventory updated · You're on the road 🚗</Text>
      <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
        <Text style={styles.scanAgainText}>Scan Next Pack</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, paddingBottom: 40 },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    gap: 12,
  },
  overlayText: { color: '#fff', fontSize: 16 },
  successBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successText: { color: '#fff', fontWeight: '600' },
  packCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  packHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  packIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  packCode: { fontSize: 16, fontWeight: '800', color: '#111827' },
  packSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statusBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '700', color: '#d97706' },
  boxListTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  boxRowText: { flex: 1, fontSize: 12, color: '#374151' },
  boxRowWeight: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  moreBoxes: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 6 },
  dispatchBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  dispatchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  doneContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  doneTitle: { fontSize: 24, fontWeight: '900', color: '#2563eb', marginBottom: 6 },
  doneSub: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  doneNote: { fontSize: 13, color: '#9ca3af', marginBottom: 28 },
  scanAgainBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  scanAgainText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
