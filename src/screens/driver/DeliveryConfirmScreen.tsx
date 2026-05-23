import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScannerCamera from '@/components/ScannerCamera';
import { getPackByCode, updatePackStatus } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DeliveryPack, ScanResult } from '@/types';

type Step = 'scan' | 'confirm' | 'done';
type DeliveryStatus = 'delivered' | 'partial_delivered';

export default function DeliveryConfirmScreen() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('scan');
  const [pack, setPack] = useState<DeliveryPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('delivered');
  const [notes, setNotes] = useState('');
  const [lastPack, setLastPack] = useState('');

  const handleScan = async (result: ScanResult) => {
    setLoading(true);
    const { data, error } = await getPackByCode(result.data);
    setLoading(false);

    if (error || !data) {
      Alert.alert('Not found', `Pack not found: ${result.data}`);
      return;
    }

    const foundPack = data as DeliveryPack;
    if (foundPack.status === 'delivered') {
      Alert.alert('Already Delivered', `Pack ${foundPack.pack_code} is already marked delivered.`);
      return;
    }
    if (!['dispatched', 'partial_delivered'].includes(foundPack.status)) {
      Alert.alert(
        'Not Dispatched',
        `This pack is in "${foundPack.status}" status. Only dispatched packs can be delivered.`
      );
      return;
    }

    setPack(foundPack);
    setStep('confirm');
  };

  const handleConfirmDelivery = async () => {
    if (!pack || !profile) return;
    setLoading(true);

    const { error } = await updatePackStatus(pack.id, deliveryStatus);
    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    // Optionally add delivery notes to pack
    if (notes) {
      // Update notes separately — could be extended to supabase call if needed
    }

    setLoading(false);
    setLastPack(pack.pack_code);
    setStep('done');
  };

  const reset = () => {
    setStep('scan');
    setPack(null);
    setNotes('');
    setDeliveryStatus('delivered');
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
          hint="Scan delivery pack barcode to confirm delivery"
        />
        {lastPack ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.successText}>Delivered: {lastPack}</Text>
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
              <Ionicons name="location" size={28} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.packCode}>{pack.pack_code}</Text>
              <Text style={styles.packSub}>{hub?.name ?? 'Hub'} · {items.length} boxes</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={14} color="#9ca3af" />
            <Text style={styles.infoText}>
              {items.length} box{items.length !== 1 ? 'es' : ''} to deliver
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Delivery Status</Text>

        <TouchableOpacity
          style={[styles.statusBtn, deliveryStatus === 'delivered' && styles.statusBtnSelected]}
          onPress={() => setDeliveryStatus('delivered')}
        >
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={deliveryStatus === 'delivered' ? '#fff' : '#16a34a'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBtnTitle, deliveryStatus === 'delivered' && styles.statusBtnTitleSelected]}>
              Full Delivery
            </Text>
            <Text style={[styles.statusBtnSub, deliveryStatus === 'delivered' && styles.statusBtnSubSelected]}>
              All boxes delivered successfully
            </Text>
          </View>
          {deliveryStatus === 'delivered' && <Ionicons name="radio-button-on" size={18} color="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statusBtn, styles.partialBtn, deliveryStatus === 'partial_delivered' && styles.partialBtnSelected]}
          onPress={() => setDeliveryStatus('partial_delivered')}
        >
          <Ionicons
            name="alert-circle"
            size={22}
            color={deliveryStatus === 'partial_delivered' ? '#fff' : '#f97316'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBtnTitle, deliveryStatus === 'partial_delivered' && styles.statusBtnTitleSelected]}>
              Partial Delivery
            </Text>
            <Text style={[styles.statusBtnSub, deliveryStatus === 'partial_delivered' && styles.statusBtnSubSelected]}>
              Some boxes couldn't be delivered
            </Text>
          </View>
          {deliveryStatus === 'partial_delivered' && <Ionicons name="radio-button-on" size={18} color="#fff" />}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="e.g. customer not available, left with security..."
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
          onPress={handleConfirmDelivery}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
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
        <Text style={{ fontSize: 50 }}>🎉</Text>
      </View>
      <Text style={styles.doneTitle}>Delivered!</Text>
      <Text style={styles.doneSub}>{lastPack}</Text>
      <Text style={styles.doneNote}>Great job! Keep it up 💪</Text>
      <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
        <Text style={styles.scanAgainText}>Confirm Another Delivery</Text>
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
    backgroundColor: '#16a34a',
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
  packHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  packIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  packCode: { fontSize: 16, fontWeight: '800', color: '#111827' },
  packSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#6b7280' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  statusBtnSelected: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  partialBtn: { borderColor: '#e5e7eb' },
  partialBtnSelected: { backgroundColor: '#f97316', borderColor: '#f97316' },
  statusBtnTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBtnTitleSelected: { color: '#fff' },
  statusBtnSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusBtnSubSelected: { color: 'rgba(255,255,255,0.75)' },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 20,
    minHeight: 80,
  },
  confirmBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  doneContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  doneTitle: { fontSize: 26, fontWeight: '900', color: '#16a34a', marginBottom: 6 },
  doneSub: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  doneNote: { fontSize: 13, color: '#9ca3af', marginBottom: 28 },
  scanAgainBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  scanAgainText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
