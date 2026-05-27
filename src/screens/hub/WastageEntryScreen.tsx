// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import HubSelector from '@/components/HubSelector';
import ProductPicker from '@/components/ProductPicker';
import type { ProductItem } from '@/components/ProductPicker';

// ─── Types ───────────────────────────────────────────────────
interface SelectedHub { id: string; name: string; code: string; }

interface WastageEntry {
  id: string;
  item_name: string;
  quantity_kg: number;
  created_at: string;
}

// ─── Main Screen ─────────────────────────────────────────────
export default function WastageEntryScreen() {
  const { profile, hub: authHub } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Selected hub (may differ from profile hub for admin/gm)
  const [selectedHub, setSelectedHub] = useState<SelectedHub | null>(
    authHub ? { id: authHub.id, name: authHub.name, code: authHub.code } : null
  );

  // Form fields
  const [itemName, setItemName]                   = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantityKg, setQuantityKg]               = useState('');
  const [amount, setAmount]                       = useState('');
  const [reason, setReason]                       = useState('');
  const [photo1, setPhoto1]                       = useState<string | null>(null);
  const [photo2, setPhoto2]                       = useState<string | null>(null);
  const [notes, setNotes]                         = useState('');

  // UI state
  const [submitting, setSubmitting]         = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const [submittedEntry, setSubmittedEntry] = useState<any>(null);

  // Today's entries
  const [todayEntries, setTodayEntries]     = useState<WastageEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  // EOD banner
  const [showEODBanner, setShowEODBanner] = useState(false);

  // ── On mount ─────────────────────────────────────────────
  useEffect(() => {
    loadTodayEntries();
    checkEODBanner();
  }, [selectedHub?.id]);

  const loadTodayEntries = useCallback(async () => {
    const hubId = selectedHub?.id ?? profile?.hub_id;
    if (!hubId) return;
    setEntriesLoading(true);
    try {
      const { data } = await supabase
        .from('wastage_entries')
        .select('id, item_name, quantity_kg, created_at')
        .eq('hub_id', hubId)
        .eq('entry_date', today)
        .order('created_at', { ascending: false });
      setTodayEntries(data ?? []);
    } catch (e) {
      console.warn('loadTodayEntries:', e);
    }
    setEntriesLoading(false);
  }, [selectedHub?.id, profile?.hub_id, today]);

  const checkEODBanner = async () => {
    const hubId = selectedHub?.id ?? profile?.hub_id;
    const now = new Date();
    const pastEOD = now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30);
    if (!pastEOD || !hubId) return;
    const { count } = await supabase
      .from('wastage_entries')
      .select('*', { count: 'exact', head: true })
      .eq('hub_id', hubId)
      .eq('entry_date', today);
    setShowEODBanner((count ?? 0) === 0);
  };

  // ── Hub selected callback ─────────────────────────────────
  const handleHubSelect = (hub: any) => {
    setSelectedHub({ id: hub.id, name: hub.name, code: hub.code });
  };

  // ── Product selected callback ─────────────────────────────
  const handleProductSelect = (item: ProductItem | null, customName?: string) => {
    if (item) {
      setItemName(item.name);
      setSelectedProductId(item.id);
    } else {
      setItemName(customName ?? '');
      setSelectedProductId(null);
    }
  };

  // ── Camera ───────────────────────────────────────────────
  const takePhoto = async (num: 1 | 2) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to photograph wastage items.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.75, allowsEditing: false, exif: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      if (num === 1) setPhoto1(result.assets[0].uri);
      else setPhoto2(result.assets[0].uri);
    }
  };

  // ── Upload photo to storage ───────────────────────────────
  const uploadPhoto = async (uri: string, path: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('wastage-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('wastage-photos')
        .getPublicUrl(path);
      return publicUrl;
    } catch (e) {
      console.error('Upload error:', e);
      return null;
    }
  };

  // ── Validation ────────────────────────────────────────────
  const qty = parseFloat(quantityKg);
  const canSubmit =
    !!selectedHub &&
    itemName.trim().length > 0 &&
    quantityKg.length > 0 && qty > 0 &&
    !!photo1 && !!photo2 &&
    !submitting;

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || !profile) return;
    setSubmitting(true);
    try {
      const uuid = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const hubId = selectedHub!.id;
      const p1Path = `${hubId}/${today}/${uuid}_1.jpg`;
      const p2Path = `${hubId}/${today}/${uuid}_2.jpg`;

      const [photo1Url, photo2Url] = await Promise.all([
        uploadPhoto(photo1!, p1Path),
        uploadPhoto(photo2!, p2Path),
      ]);

      if (!photo1Url || !photo2Url) {
        Alert.alert('Upload Failed', 'Could not upload photos. Check your connection.');
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from('wastage_entries')
        .insert({
          hub_id: hubId,
          hub_name: selectedHub!.name,
          item_name: itemName.trim(),
          quantity_kg: qty,
          amount: amount ? parseFloat(amount) : null,
          reason: reason.trim() || null,
          photo_1_url: photo1Url,
          photo_2_url: photo2Url,
          entry_date: today,
          submitted_by: profile.id,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setSubmittedEntry(data);
      setSubmitted(true);
      setShowEODBanner(false);
      await loadTodayEntries();
    } catch (e: any) {
      Alert.alert('Submit Failed', e?.message ?? 'Unknown error.');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setItemName(''); setSelectedProductId(null);
    setQuantityKg(''); setAmount('');
    setReason(''); setPhoto1(null); setPhoto2(null); setNotes('');
    setSubmitted(false); setSubmittedEntry(null);
  };

  // ── Success screen ────────────────────────────────────────
  if (submitted && submittedEntry) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
        </View>
        <Text style={styles.successTitle}>Entry Submitted! ✅</Text>
        <View style={styles.successCard}>
          <Text style={styles.successItem}>{submittedEntry.item_name}</Text>
          <Text style={styles.successQty}>{submittedEntry.quantity_kg} kg</Text>
          {submittedEntry.amount
            ? <Text style={styles.successAmt}>Estimated Loss: ₹{submittedEntry.amount}</Text>
            : null}
          <Text style={styles.successHub}>📍 {selectedHub?.name}</Text>
        </View>
        <TouchableOpacity style={styles.addAnotherBtn} onPress={resetForm}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addAnotherText}>Add Another Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewEntriesBtn} onPress={() => setSubmitted(false)}>
          <Text style={styles.viewEntriesBtnText}>View Today's Entries</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main form ─────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await loadTodayEntries(); setRefreshing(false); }}
          tintColor="#ea580c" colors={['#ea580c']}
        />
      }
    >
      {/* EOD banner */}
      {showEODBanner && (
        <View style={styles.eodBanner}>
          <Ionicons name="warning" size={18} color="#fff" />
          <Text style={styles.eodBannerText}>EOD Wastage not submitted yet! Fill the form below.</Text>
        </View>
      )}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name="trash" size={26} color="#ea580c" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>EOD Wastage Entry</Text>
          <Text style={styles.pageDate}>{todayFormatted}</Text>
        </View>
      </View>

      {/* ── Form card ──────────────────────────────────────── */}
      <View style={styles.formCard}>

        {/* Hub selector */}
        <Text style={styles.label}>Hub</Text>
        <HubSelector
          selectedHubId={selectedHub?.id ?? null}
          onSelect={handleHubSelect}
        />

        {/* Item (product picker) */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Item Name <Text style={styles.req}>*</Text>
          {selectedHub?.id
            ? <Text style={styles.labelSub}> — stock at {selectedHub.code}</Text>
            : null}
        </Text>
        <ProductPicker
          hubId={selectedHub?.id ?? null}
          selectedId={selectedProductId}
          selectedName={itemName}
          onSelect={handleProductSelect}
        />

        {/* Quantity */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Quantity <Text style={styles.req}>*</Text>
        </Text>
        <View style={styles.unitRow}>
          <TextInput
            style={styles.unitInput}
            placeholder="0.0"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            value={quantityKg}
            onChangeText={setQuantityKg}
          />
          <View style={styles.unitBadge}>
            <Text style={styles.unitBadgeText}>kg</Text>
          </View>
        </View>

        {/* Amount */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Amount <Text style={styles.opt}>₹ optional</Text>
        </Text>
        <View style={styles.unitRow}>
          <View style={[styles.unitBadge, styles.unitBadgeLeft]}>
            <Text style={styles.unitBadgeText}>₹</Text>
          </View>
          <TextInput
            style={[styles.unitInput, { borderLeftWidth: 0 }]}
            placeholder="0"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {/* Reason */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Reason <Text style={styles.opt}>optional</Text>
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="Reason for wastage…"
          placeholderTextColor="#9ca3af"
          multiline numberOfLines={2}
          value={reason} onChangeText={setReason}
          textAlignVertical="top"
        />

        {/* Photo 1 */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Photo 1 <Text style={styles.req}>*</Text>
          {photo1 ? <Text style={styles.capturedOk}> ✓ Captured</Text> : null}
        </Text>
        {photo1 ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo1 }} style={styles.photoThumb} resizeMode="cover" />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => takePhoto(1)}>
              <Ionicons name="camera" size={13} color="#fff" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraBtn} onPress={() => takePhoto(1)}>
            <Ionicons name="camera-outline" size={28} color="#ea580c" />
            <Text style={styles.cameraBtnText}>Take Photo 1</Text>
            <Text style={styles.cameraBtnSub}>Required</Text>
          </TouchableOpacity>
        )}

        {/* Photo 2 */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Photo 2 <Text style={styles.req}>*</Text>
          {photo2 ? <Text style={styles.capturedOk}> ✓ Captured</Text> : null}
        </Text>
        {photo2 ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo2 }} style={styles.photoThumb} resizeMode="cover" />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => takePhoto(2)}>
              <Ionicons name="camera" size={13} color="#fff" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraBtn} onPress={() => takePhoto(2)}>
            <Ionicons name="camera-outline" size={28} color="#ea580c" />
            <Text style={styles.cameraBtnText}>Take Photo 2</Text>
            <Text style={styles.cameraBtnSub}>Required</Text>
          </TouchableOpacity>
        )}

        {/* Notes */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          Notes <Text style={styles.opt}>optional</Text>
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="Any additional notes…"
          placeholderTextColor="#9ca3af"
          multiline numberOfLines={2}
          value={notes} onChangeText={setNotes}
          textAlignVertical="top"
        />

        {/* Inline validation hints */}
        {!canSubmit && (itemName || quantityKg || photo1 || photo2) ? (
          <View style={styles.hintBox}>
            {!selectedHub              && <Text style={styles.hintText}>• Select a hub</Text>}
            {!itemName.trim()          && <Text style={styles.hintText}>• Item name required</Text>}
            {(!quantityKg || qty <= 0) && <Text style={styles.hintText}>• Quantity must be &gt; 0</Text>}
            {!photo1                   && <Text style={styles.hintText}>• Photo 1 required</Text>}
            {!photo2                   && <Text style={styles.hintText}>• Photo 2 required</Text>}
          </View>
        ) : null}
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>Submit Wastage Entry</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Today's entries list */}
      <Text style={styles.sectionTitle}>Today's Entries</Text>
      {entriesLoading ? (
        <ActivityIndicator color="#ea580c" style={{ marginVertical: 20 }} />
      ) : todayEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="clipboard-outline" size={36} color="#d1d5db" />
          <Text style={styles.emptyText}>No entries submitted today</Text>
          <Text style={styles.emptySubText}>Pull down to refresh</Text>
        </View>
      ) : (
        todayEntries.map(entry => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.entryDot}>
              <Ionicons name="trash-outline" size={15} color="#ea580c" />
            </View>
            <View style={styles.entryInfo}>
              <Text style={styles.entryName}>{entry.item_name}</Text>
              <Text style={styles.entryTime}>
                {new Date(entry.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.entryQty}>{entry.quantity_kg} kg</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff7ed' },
  content: { padding: 16, paddingBottom: 48 },

  eodBanner: {
    backgroundColor: '#dc2626', borderRadius: 10,
    padding: 12, flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12,
  },
  eodBannerText: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageHeaderIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fdba74',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ea580c', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  pageTitle: { fontSize: 20, fontWeight: '900', color: '#9a3412' },
  pageDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  formCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 7 },
  labelSub: { fontSize: 11, fontWeight: '500', color: '#9ca3af' },
  req: { color: '#dc2626' },
  opt: { fontSize: 11, fontWeight: '400', color: '#9ca3af' },
  capturedOk: { fontSize: 11, color: '#16a34a', fontWeight: '600' },

  unitRow: {
    flexDirection: 'row', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 10, overflow: 'hidden', backgroundColor: '#fafafa',
  },
  unitInput: {
    flex: 1, padding: 13, fontSize: 22, fontWeight: '800', color: '#111827',
  },
  unitBadge: {
    backgroundColor: '#fff7ed', paddingHorizontal: 14,
    justifyContent: 'center', alignItems: 'center',
    borderLeftWidth: 1.5, borderLeftColor: '#e5e7eb',
  },
  unitBadgeLeft: {
    borderLeftWidth: 0, borderRightWidth: 1.5, borderRightColor: '#e5e7eb',
  },
  unitBadgeText: { fontSize: 15, fontWeight: '700', color: '#ea580c' },

  textArea: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#111827',
    minHeight: 72, backgroundColor: '#fafafa',
  },

  cameraBtn: {
    borderWidth: 2, borderColor: '#fdba74', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 22,
    alignItems: 'center', gap: 6, backgroundColor: '#fff7ed',
  },
  cameraBtnText: { fontSize: 15, fontWeight: '700', color: '#ea580c' },
  cameraBtnSub: { fontSize: 11, color: '#fb923c' },

  photoWrap: { position: 'relative' },
  photoThumb: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#f3f4f6' },
  retakeBtn: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  retakeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  hintBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 12, gap: 3 },
  hintText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },

  submitBtn: {
    backgroundColor: '#ea580c', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 24,
    shadowColor: '#ea580c', shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  submitBtnOff: { opacity: 0.45, shadowOpacity: 0 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center', gap: 6,
  },
  emptyText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  emptySubText: { color: '#d1d5db', fontSize: 12 },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, padding: 13, marginBottom: 8, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  entryDot: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center',
  },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  entryTime: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  entryQty: { fontSize: 15, fontWeight: '800', color: '#ea580c' },

  successScreen: {
    flex: 1, backgroundColor: '#f0fdf4',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  successIconWrap: {
    width: 108, height: 108, borderRadius: 54, backgroundColor: '#dcfce7',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#16a34a', marginBottom: 18 },
  successCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 22,
    width: '100%', alignItems: 'center', marginBottom: 24, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  successItem: { fontSize: 18, fontWeight: '700', color: '#111827' },
  successQty: { fontSize: 28, fontWeight: '900', color: '#ea580c', marginTop: 4 },
  successAmt: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  successHub: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  addAnotherBtn: {
    backgroundColor: '#ea580c', borderRadius: 13,
    paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center',
    gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10,
  },
  addAnotherText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewEntriesBtn: { padding: 12, width: '100%', alignItems: 'center' },
  viewEntriesBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
});
