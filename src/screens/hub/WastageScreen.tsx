import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScannerCamera from '@/components/ScannerCamera';
import { getBoxByCode, getBoxById, updateBoxStatus, logInventoryEvent, logWastage } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Box, ScanResult, WastageReason } from '@/types';

const REASONS: { value: WastageReason; label: string; emoji: string }[] = [
  { value: 'damaged', label: 'Damaged', emoji: '🔨' },
  { value: 'expired', label: 'Expired', emoji: '⏰' },
  { value: 'contaminated', label: 'Contaminated', emoji: '☣️' },
  { value: 'qc_fail', label: 'QC Fail', emoji: '❌' },
  { value: 'other', label: 'Other', emoji: '📝' },
];

type Step = 'scan' | 'form' | 'done';

export default function WastageScreen() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('scan');
  const [box, setBox] = useState<Box | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [reason, setReason] = useState<WastageReason | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastCode, setLastCode] = useState('');

  const handleScan = async (result: ScanResult) => {
    setLookingUp(true);
    let res;
    if (result.parsed?.box_id) {
      res = await getBoxById(result.parsed.box_id);
    } else {
      res = await getBoxByCode(result.data);
    }
    setLookingUp(false);

    if (res.error || !res.data) {
      Alert.alert('Not found', `No box: ${result.data}`);
      return;
    }
    setBox(res.data as Box);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!box || !reason || !profile) return;
    setSaving(true);

    // Update box status to wasted
    await updateBoxStatus(box.id, 'wasted');

    // Log wastage record
    if (box.hub_id && box.product_id) {
      await logWastage({
        boxId: box.id,
        hubId: box.hub_id,
        productId: box.product_id,
        reason,
        weightKg: box.weight_kg ?? 0,
        loggedBy: profile.id,
      });

      // Log negative inventory event
      await logInventoryEvent({
        hubId: box.hub_id,
        productId: box.product_id,
        eventType: 'wastage',
        qtyDelta: -(box.weight_kg ?? 0),
        refId: box.id,
        refType: 'box',
        notes: `Wastage (${reason}): ${box.box_code}. ${notes}`,
        createdBy: profile.id,
      });
    }

    setSaving(false);
    setLastCode(box.box_code);
    setStep('done');
  };

  const reset = () => {
    setStep('scan');
    setBox(null);
    setReason(null);
    setNotes('');
  };

  if (step === 'scan') {
    return (
      <View style={{ flex: 1 }}>
        {lookingUp && (
          <View style={styles.lookupOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={{ color: '#fff', marginTop: 8 }}>Looking up box...</Text>
          </View>
        )}
        <ScannerCamera
          onScan={handleScan}
          active={!lookingUp}
          hint="Scan box to log wastage"
        />
        {lastCode ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.successBannerText}>Wastage logged: {lastCode}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (step === 'form' && box) {
    const product = box.product as any;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Box info */}
        <View style={styles.boxCard}>
          <Text style={styles.boxCode}>{box.box_code}</Text>
          <Text style={styles.boxSub}>{product?.name} · {box.weight_kg} kg</Text>
        </View>

        <Text style={styles.label}>Reason for Wastage *</Text>
        {REASONS.map(r => (
          <TouchableOpacity
            key={r.value}
            style={[styles.reasonBtn, reason === r.value && styles.reasonSelected]}
            onPress={() => setReason(r.value)}
          >
            <Text style={styles.reasonEmoji}>{r.emoji}</Text>
            <Text style={[styles.reasonLabel, reason === r.value && styles.reasonLabelSelected]}>
              {r.label}
            </Text>
            {reason === r.value && (
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>
        ))}

        <Text style={[styles.label, { marginTop: 16 }]}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="e.g. dropped during unloading, packaging torn..."
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, (!reason || saving) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!reason || saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.submitBtnText}>Log Wastage</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
          <Text style={styles.cancelText}>← Scan Different Box</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.doneContainer]}>
      <View style={styles.doneIconBg}>
        <Ionicons name="checkmark-circle" size={56} color="#dc2626" />
      </View>
      <Text style={styles.doneTitle}>Wastage Logged</Text>
      <Text style={styles.doneSub}>{lastCode}</Text>
      <Text style={styles.doneNote}>Stock deducted from inventory</Text>
      <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
        <Text style={styles.scanAgainText}>Log Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  lookupOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  successBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successBannerText: { color: '#fff', fontWeight: '600' },
  boxCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  boxCode: { fontSize: 16, fontWeight: '800', color: '#111827' },
  boxSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 13,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  reasonSelected: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  reasonEmoji: { fontSize: 18 },
  reasonLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  reasonLabelSelected: { color: '#fff' },
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
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  doneContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  doneTitle: { fontSize: 24, fontWeight: '900', color: '#dc2626', marginBottom: 6 },
  doneSub: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  doneNote: { fontSize: 13, color: '#9ca3af', marginBottom: 28 },
  scanAgainBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  scanAgainText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
