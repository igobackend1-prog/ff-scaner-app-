import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { QRPayload, ScanResult } from '@/types';

interface Props {
  onScan: (result: ScanResult) => void;
  active?: boolean;
  hint?: string;
}

const { width } = Dimensions.get('window');
const FRAME_SIZE = width * 0.7;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

export default function ScannerCamera({ onScan, active = true, hint }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-request permission as soon as we know it's not granted
  useEffect(() => {
    if (permission !== null && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    return () => {
      if (cooldown.current) clearTimeout(cooldown.current);
    };
  }, []);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned || !active) return;
    setScanned(true);
    Vibration.vibrate(80);

    let parsed: QRPayload | null = null;
    try {
      const obj = JSON.parse(data);
      if (obj.box_id && obj.box_code) parsed = obj as QRPayload;
    } catch { /* plain barcode */ }

    onScan({ type: parsed ? 'qr' : 'barcode', data, parsed });
    cooldown.current = setTimeout(() => setScanned(false), 2000);
  };

  // Permission still loading
  if (permission === null) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={48} color="#16a34a" />
        <Text style={styles.centerText}>Requesting camera…</Text>
      </View>
    );
  }

  // Permission denied permanently
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off-outline" size={56} color="#9ca3af" />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permText}>
          FF Scanner needs camera permission to scan box labels.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera ready — full screen view
  return (
    <View style={styles.fullScreen}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={active && !scanned ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
      />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top dark band */}
        <View style={styles.bandTop} />

        {/* Middle row */}
        <View style={styles.middle}>
          <View style={styles.bandSide} />
          {/* Scan frame */}
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {scanned && (
              <View style={styles.successOverlay}>
                <Ionicons name="checkmark-circle" size={56} color="#fff" />
                <Text style={styles.successText}>Scanned!</Text>
              </View>
            )}
          </View>
          <View style={styles.bandSide} />
        </View>

        {/* Bottom dark band */}
        <View style={styles.bandBottom}>
          <Text style={styles.hint}>
            {scanned
              ? '✓  Scanned successfully!'
              : (hint ?? 'Point camera at a QR code or barcode')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 32,
    gap: 14,
  },
  centerText: {
    color: '#6b7280',
    fontSize: 15,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  permText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  permBtn: {
    marginTop: 8,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // Overlay bands
  bandTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middle: {
    flexDirection: 'row',
    height: FRAME_SIZE,
  },
  bandSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bandBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingTop: 24,
    gap: 8,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,163,74,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    gap: 8,
  },
  successText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#22c55e',
  },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  hint: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
