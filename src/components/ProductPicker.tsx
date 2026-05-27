// @ts-nocheck
/**
 * ProductPicker — searchable product selector.
 * Fetches from `products` table, joins `inventory` to show
 * current stock at the selected hub.
 * "In Stock at Hub" section appears first (green qty badge).
 * "Other Products" section below (greyed, stock unknown / zero).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, FlatList, ActivityIndicator, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────
export interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  image_url: string | null;
  stockKg: number | null;   // null = no inventory row
}

interface Props {
  hubId: string | null;
  selectedId: string | null;
  selectedName: string;
  onSelect: (item: ProductItem | null, customName?: string) => void;
}

// ── Component ─────────────────────────────────────────────────
export default function ProductPicker({ hubId, selectedId, selectedName, onSelect }: Props) {
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [inStock, setInStock]     = useState<ProductItem[]>([]);
  const [others, setOthers]       = useState<ProductItem[]>([]);

  // ── Fetch whenever hubId changes or modal opens ────────────
  useEffect(() => {
    if (open && hubId) fetchProducts(hubId);
    else if (open && !hubId) fetchProducts(null);
  }, [open, hubId]);

  const fetchProducts = useCallback(async (hid: string | null) => {
    setLoading(true);
    try {
      // Fetch all products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, unit, image_url')
        .order('name');

      if (!products) { setLoading(false); return; }

      // Fetch inventory for this hub (product_id + quantity)
      let stockMap: Record<string, number> = {};
      if (hid) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('product_id, quantity')
          .eq('hub_id', hid);

        (inv ?? []).forEach((row: any) => {
          if (row.product_id) stockMap[row.product_id] = row.quantity ?? 0;
        });
      }

      // Merge & split into two groups
      const enriched: ProductItem[] = products.map(p => ({
        ...p,
        stockKg: stockMap[p.id] !== undefined ? stockMap[p.id] : null,
      }));

      const inStockList  = enriched.filter(p => p.stockKg !== null && p.stockKg > 0)
                                   .sort((a, b) => (b.stockKg ?? 0) - (a.stockKg ?? 0));
      const othersList   = enriched.filter(p => p.stockKg === null || p.stockKg <= 0);

      setInStock(inStockList);
      setOthers(othersList);
    } catch (e) {
      console.warn('ProductPicker fetch error:', e);
    }
    setLoading(false);
  }, []);

  // ── Filtered lists ─────────────────────────────────────────
  const q = search.toLowerCase().trim();
  const filteredInStock = q ? inStock.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)) : inStock;
  const filteredOthers  = q ? others.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)) : others;

  const sections = [
    ...(filteredInStock.length > 0
      ? [{ key: 'stock', title: `In Stock at Hub  (${filteredInStock.length})`, data: filteredInStock }]
      : []),
    ...(filteredOthers.length > 0
      ? [{ key: 'other', title: 'All Products', data: filteredOthers }]
      : []),
  ];

  const handleSelect = (item: ProductItem) => {
    onSelect(item);
    setOpen(false);
    setSearch('');
  };

  const handleCustom = () => {
    onSelect(null, search.trim());
    setOpen(false);
    setSearch('');
  };

  // ── Trigger button ─────────────────────────────────────────
  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Ionicons name="leaf-outline" size={17} color={selectedName ? '#16a34a' : '#9ca3af'} />
        <Text style={[styles.triggerText, !selectedName && styles.placeholder]} numberOfLines={1}>
          {selectedName || 'Select item…'}
        </Text>
        {selectedName ? (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onSelect(null, '')}
          >
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        )}
      </TouchableOpacity>

      {/* ── Modal ──────────────────────────────────────────── */}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setOpen(false); setSearch(''); }}
      >
        <View style={styles.modal}>

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Item</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }}>
              <Ionicons name="close-circle" size={28} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or SKU…"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>

          {/* Custom entry option (only when typing) */}
          {search.trim().length > 0 && (
            <TouchableOpacity style={styles.customRow} onPress={handleCustom}>
              <View style={styles.customIcon}>
                <Ionicons name="pencil" size={16} color="#ea580c" />
              </View>
              <View style={styles.customInfo}>
                <Text style={styles.customLabel}>Use custom name</Text>
                <Text style={styles.customValue}>"{search.trim()}"</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#ea580c" />
            </TouchableOpacity>
          )}

          {/* Loading */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#ea580c" size="large" />
              <Text style={styles.loadingText}>Loading products…</Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled
              renderSectionHeader={({ section }) => (
                <View style={[
                  styles.sectionHeader,
                  section.key === 'stock' && styles.sectionHeaderStock,
                ]}>
                  {section.key === 'stock'
                    ? <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                    : <Ionicons name="layers-outline" size={14} color="#9ca3af" />
                  }
                  <Text style={[
                    styles.sectionTitle,
                    section.key === 'stock' && styles.sectionTitleStock,
                  ]}>
                    {section.title}
                  </Text>
                </View>
              )}
              renderItem={({ item, section }) => (
                <ProductRow
                  item={item}
                  isSelected={item.id === selectedId}
                  dimmed={section.key === 'other'}
                  onPress={() => handleSelect(item)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="leaf-outline" size={40} color="#d1d5db" />
                  <Text style={styles.emptyText}>
                    {search ? `No products matching "${search}"` : 'No products found in database'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

// ── Product Row ───────────────────────────────────────────────
function ProductRow({
  item, isSelected, dimmed, onPress,
}: {
  item: ProductItem;
  isSelected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, isSelected && styles.rowSelected, dimmed && styles.rowDimmed]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Icon */}
      <View style={[styles.rowIcon, isSelected && styles.rowIconSelected]}>
        <Ionicons
          name="leaf"
          size={16}
          color={isSelected ? '#fff' : dimmed ? '#9ca3af' : '#16a34a'}
        />
      </View>

      {/* Name + meta */}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, isSelected && styles.rowNameSelected, dimmed && styles.rowNameDimmed]}>
          {item.name}
        </Text>
        <View style={styles.rowMeta}>
          {item.unit ? (
            <View style={styles.unitTag}>
              <Text style={styles.unitTagText}>{item.unit}</Text>
            </View>
          ) : null}
          {item.sku ? (
            <Text style={styles.skuText}>SKU: {item.sku}</Text>
          ) : null}
        </View>
      </View>

      {/* Stock badge */}
      {item.stockKg !== null ? (
        <View style={[styles.stockBadge, item.stockKg <= 0 && styles.stockBadgeZero]}>
          <Text style={[styles.stockText, item.stockKg <= 0 && styles.stockTextZero]}>
            {item.stockKg > 0 ? `${item.stockKg} kg` : '0 kg'}
          </Text>
        </View>
      ) : null}

      {/* Checkmark */}
      {isSelected && (
        <Ionicons name="checkmark-circle" size={20} color="#ea580c" style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Trigger
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 13,
    backgroundColor: '#fafafa',
  },
  triggerText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  placeholder: { color: '#9ca3af', fontWeight: '400' },

  // Modal
  modal: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  // Custom entry
  customRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, marginBottom: 6,
    backgroundColor: '#fff7ed',
    borderRadius: 10, padding: 12,
    borderWidth: 1.5, borderColor: '#fdba74',
  },
  customIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#ffedd5',
    justifyContent: 'center', alignItems: 'center',
  },
  customInfo: { flex: 1 },
  customLabel: { fontSize: 11, color: '#9a3412', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  customValue: { fontSize: 14, color: '#ea580c', fontWeight: '700', marginTop: 1 },

  // Loading
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
  loadingText: { color: '#9ca3af', fontSize: 14 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#f3f4f6',
  },
  sectionHeaderStock: { backgroundColor: '#f0fdf4' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700',
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionTitleStock: { color: '#16a34a' },

  // Product rows
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingVertical: 13,
    paddingHorizontal: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
    minHeight: 56,
  },
  rowSelected: { backgroundColor: '#fff7ed' },
  rowDimmed: { opacity: 0.6 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center', alignItems: 'center',
  },
  rowIconSelected: { backgroundColor: '#ea580c' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowNameSelected: { color: '#9a3412' },
  rowNameDimmed: { color: '#6b7280' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  unitTag: {
    backgroundColor: '#eff6ff', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  unitTagText: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
  skuText: { fontSize: 10, color: '#9ca3af' },

  // Stock badge
  stockBadge: {
    backgroundColor: '#dcfce7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  stockBadgeZero: { backgroundColor: '#f3f4f6' },
  stockText: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  stockTextZero: { color: '#9ca3af' },

  // Empty
  emptyWrap: {
    alignItems: 'center', gap: 10,
    paddingVertical: 48, paddingHorizontal: 24,
  },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
