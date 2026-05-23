import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { updateBoxStatus, logInventoryEvent, logWastage } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Box, WastageReason } from '@/types';

const WASTAGE_REASONS: { value: WastageReason; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'damaged', label: 'Damaged', icon: 'warning-outline' },
  { value: 'expired', label: 'Expired', icon: 'time-outline' },
  { value: 'contaminated', label: 'Contaminated', icon: 'skull-outline' },
  { value: 'qc_fail', label: 'QC Fail', icon: 'close-circle-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

type QCStep = 'decide' | 'wastage_reason' | 'done';
type QCResult = 'pass' | 'fail';

export default function QCScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const box: Box = route.params?.box;

  const [step, setStep] = useState<QCStep>('decide');
  const [result, setResult] = useState<QCResult | null>(null);
  const [wastageReason, setWastageReason] = useState<WastageReason | null>(null);
  const [wastageNotes, setWastageNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!box) {
    return (
      <View style={styles.center}>
        <Text>No box data. Go back and scan again.</Text>
      </View>
    );
  }

  const product = box.product as any;
  const hub = box.hub as any;

  const handlePass = async () => {
    if (!profile) return;
    setLoading(true);

    // 1. Update box → qc_passed
    const { error: boxErr } = await updateBoxStatus(box.id, 'qc_passed');
    if (boxErr) {
      Alert.alert('Error', boxErr.message);
      setLoading(false);
      return;
    }

    // 2. Log inventory receive (weight enters stock after QC pass)
    if (box.hub_id && box.product_id) {
      await logInventoryEvent({
        hubId: box.hub_id,
        productId: box.product_id,
        eventType: 'receive',
        qtyDelta: box.weight_kg ?? 0,
        refId: box.id,
        refType: 'box',
        notes: `QC passed: ${box.box_code}`,
        createdBy: profile.id,
      });
    }

    setLoading(false);
    setResult('pass');
    setStep('done');
  };

  const handleFail = () => {
    setResult('fail');
    setStep('wastage_reason');
  };

  const submitWastage = async () => {
    if (!wastageReason || !profile) return;
    setLoading(true);

    // 1. Update box → qc_failed
    await updateBoxStatus(box.id, 'qc_failed');

    // 2. Log wastage
    if (box.hub_id && box.product_id) {
      await logWastage({
        boxId: box.id,
        hubId: box.hub_id,
        productId: box.product_id,
        reason: wastageReason,
        weightKg: box.weight_kg ?? 0,
        loggedBy: profile.id,
      });

      // 3. Log negative inventory event
      await logInventoryEvent({
        hubId: box.hub_id,
        productId: box.product_id,
        eventType: 'qc_reject',
        qtyDelta: -(box.weight_kg ?? 0),
        refId: box.id,
        refType: 'box',
        notes: `QC failed (${wastageReason}): ${box.box_code}. ${wastageNotes}`,
        createdBy: profile.id,
      });
    }

    setLoading(false);
    setStep('done');
  };

  // ── Decide step ──
  if (step === 'decide') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.boxCard}>
          <View style={styles.boxHeader}>
            <View style={styles.boxIconBg}>
              <Ionicons name="shield-checkmark-outline" size={28} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.boxCode}>{box.box_code}</Text>
              <Text style={styles.boxSub}>{product?.name} · {box.weight_kg} kg</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hub</Text>
            <Text style={styles.detailValue}>{hub?.name ?? '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Status</Text>
            <Text style={styles.detailValue}>{box.status}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>QC Result</Text>
        <Text style={styles.sectionSub}>Inspect the box physically and decide:</Text>

        <TouchableOpacity
          style={[styles.qcBtn, styles.passBtn]}
          onPress={handlePass}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={26} color="#fff" />
              <View>
                <Text style={styles.qcBtnTitle}>✅ QC PASS</Text>
                <Text style={styles.qcBtnSub}>Good quality — add to stock</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.qcBtn, styles.failBtn]}
          onPress={handleFail}
        >
          <Ionicons name="close-circle" size={26} color="#fff" />
          <View>
            <Text style={styles.qcBtnTitle}>❌ QC FAIL</Text>
            <Text style={styles.qcBtnSub}>Damaged / bad — log wastage</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Wastage reason step ──
  if (step === 'wastage_reason') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.failBanner}>
          <Ionicons name="close-circle" size={22} color="#fff" />
          <Text style={styles.failBannerText}>QC Failed — {box.box_code}</Text>
        </View>

        <Text style={styles.sectionTitle}>Reason for Wastage</Text>
        <Text style={styles.sectionSub}>Select what's wrong with this box:</Text>

        {WASTAGE_REASONS.map(r => (
          <TouchableOpacity
            key={r.value}
            style={[styles.reasonBtn, wastageReason === r.value && styles.reasonBtnSelected]}
            onPress={() => setWastageReason(r.value)}
          >
            <Ionicons
              name={r.icon}
              size={20}
              color={wastageReason === r.value ? '#fff' : '#374151'}
            />
            <Text style={[styles.reasonText, wastageReason === r.value && styles.reasonTextSelected]}>
              {r.label}
            </Text>
            {wastageReason === r.value && (
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Additional details..."
          multiline
          numberOfLines={3}
          value={wastageNotes}
          onChangeText={setWastageNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, !wastageReason && styles.submitBtnDisabled]}
          onPress={submitWastage}
          disabled={!wastageReason || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.submitBtnText}>Log Wastage & Close Box</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Done step ──
  const isPass = result === 'pass';
  return (
    <View style={[styles.container, styles.doneContainer]}>
      <View style={[styles.doneIcon, { backgroundColor: isPass ? '#f0fdf4' : '#fef2f2' }]}>
        <Ionicons
          name={isPass ? 'checkmark-circle' : 'close-circle'}
          size={64}
          color={isPass ? '#16a34a' : '#dc2626'}
        />
      </View>
      <Text style={[styles.doneTitle, { color: isPass ? '#16a34a' : '#dc2626' }]}>
        {isPass ? 'QC Passed!' : 'Wastage Logged'}
      </Text>
      <Text style={styles.doneBox}>{box.box_code}</Text>
      <Text style={styles.doneNote}>
        {isPass ? 'Stock updated · Box added to inventory' : 'Box marked QC failed · Wastage recorded'}
      </Text>
      <TouchableOpacity style={styles.doneBackBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.doneBackText}>← Back to Scanner</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  boxCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  boxIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxCode: { fontSize: 17, fontWeight: '800', color: '#111827' },
  boxSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailLabel: { fontSize: 13, color: '#6b7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#6b7280', marginBottom: 14 },
  qcBtn: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  passBtn: { backgroundColor: '#16a34a' },
  failBtn: { backgroundColor: '#dc2626' },
  qcBtnTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  qcBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  backBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  backText: { color: '#6b7280', fontWeight: '600' },
  failBanner: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  failBannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonBtnSelected: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  reasonText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  reasonTextSelected: { color: '#fff' },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: { backgroundColor: '#dc2626', borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  doneContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  doneTitle: { fontSize: 26, fontWeight: '900', marginBottom: 6 },
  doneBox: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 8 },
  doneNote: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 32 },
  doneBackBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  doneBackText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
