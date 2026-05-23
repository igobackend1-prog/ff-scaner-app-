import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScannerCamera from '@/components/ScannerCamera';
import { getBoxByCode, getBoxById, updateBoxStatus, logInventoryEvent } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Box, ScanResult } from '@/types';

type Mode = 'scanning' | 'confirm' | 'done';

export default function ScanReceiveScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<Mode>('scanning');
  const [box, setBox] = useState<Box | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  const handleScan = async (result: ScanResult) => {
    setLoading(true);

    let fetchResult;
    if (result.parsed?.box_id) {
      fetchResult = await getBoxById(result.parsed.box_id);
    } else {
      fetchResult = await getBoxByCode(result.data);
    }

    setLoading(false);

    if (fetchResult.error || !fetchResult.data) {
      Alert.alert('Box not found', `No box found for code: ${result.data}`);
      return;
    }

    const foundBox = fetchResult.data as Box;

    if (foundBox.status !== 'created') {
      Alert.alert(
        'Already processed',
        `This box is already marked as: ${foundBox.status.replace('_', ' ').toUpperCase()}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setBox(foundBox);
    setMode('confirm');
  };

  const handleReceive = async () => {
    if (!box || !profile) return;
    setLoading(true);

    // 1. Update box status → received
    const { error: boxErr } = await updateBoxStatus(box.id, 'received');
    if (boxErr) {
      Alert.alert('Error', 'Could not update box status.');
      setLoading(false);
      return;
    }

    // 2. Log inventory receive event (triggers auto-update of inventory table)
    if (box.product_id && box.hub_id) {
      const { error: logErr } = await logInventoryEvent({
        hubId: box.hub_id,
        productId: box.product_id,
        eventType: 'receive',
        qtyDelta: box.weight_kg ?? 0,
        refId: box.id,
        refType: 'box',
        notes: `Box received: ${box.box_code}`,
        createdBy: profile.id,
      });
      if (logErr) console.warn('Inventory log error:', logErr.message);
    }

    setLoading(false);
    setLastAction(`Received ${box.box_code}`);
    setMode('done');
  };

  const handleQC = () => {
    if (!box) return;
    navigation.navigate('QC', { box });
    setMode('scanning');
    setBox(null);
  };

  const reset = () => {
    setMode('scanning');
    setBox(null);
  };

  if (mode === 'scanning') {
    return (
      <View style={styles.container}>
        {loading && (
          <View style={styles.scanOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.scanOverlayText}>Looking up box...</Text>
          </View>
        )}
        <ScannerCamera
          onScan={handleScan}
          active={!loading}
          hint="Scan box QR code or barcode to receive"
        />
        {lastAction ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.successBannerText}>{lastAction}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (mode === 'confirm' && box) {
    const product = box.product as any;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.boxCard}>
          <View style={styles.boxHeader}>
            <View style={styles.boxIconBg}>
              <Ionicons name="cube" size={28} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.boxCode}>{box.box_code}</Text>
              <Text style={styles.boxStatus}>Status: {box.status}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Product</Text>
            <Text style={styles.detailValue}>{product?.name ?? 'Unknown'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Weight</Text>
            <Text style={styles.detailValue}>{box.weight_kg ?? '?'} kg</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hub</Text>
            <Text style={styles.detailValue}>{(box.hub as any)?.name ?? 'Unknown'}</Text>
          </View>
        </View>

        <Text style={styles.actionTitle}>What do you want to do?</Text>

        <TouchableOpacity
          style={[styles.actionBtn, styles.receiveBtn]}
          onPress={handleReceive}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="arrow-down-circle" size={22} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Received</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.qcBtn]}
          onPress={handleQC}
        >
          <Ionicons name="shield-checkmark" size={22} color="#fff" />
          <Text style={styles.actionBtnText}>Run QC Check</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
          <Text style={styles.cancelText}>← Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Done state
  return (
    <View style={[styles.container, styles.doneContainer]}>
      <View style={styles.doneIcon}>
        <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
      </View>
      <Text style={styles.doneTitle}>Received!</Text>
      <Text style={styles.doneSubtitle}>{lastAction}</Text>
      <Text style={styles.doneNote}>Inventory updated automatically</Text>
      <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
        <Ionicons name="qr-code-outline" size={20} color="#fff" />
        <Text style={styles.scanAgainText}>Scan Next Box</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  scanOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    gap: 12,
  },
  scanOverlayText: { color: '#fff', fontSize: 16 },
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
  successBannerText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  boxCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  boxIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxCode: { fontSize: 17, fontWeight: '800', color: '#111827' },
  boxStatus: { fontSize: 12, color: '#9ca3af', textTransform: 'capitalize', marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailLabel: { fontSize: 13, color: '#6b7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  receiveBtn: { backgroundColor: '#16a34a' },
  qcBtn: { backgroundColor: '#2563eb' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  doneContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  doneTitle: { fontSize: 28, fontWeight: '900', color: '#16a34a', marginBottom: 6 },
  doneSubtitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  doneNote: { fontSize: 13, color: '#9ca3af', marginBottom: 32 },
  scanAgainBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanAgainText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
