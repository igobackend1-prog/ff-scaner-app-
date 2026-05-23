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

export default function ScannerCamera({ onScan, active = true, hint }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Try parsing as QR JSON payload
    try {
      const obj = JSON.parse(data);
      if (obj.box_id && obj.box_code) {
        parsed = obj as QRPayload;
      }
    } catch {
      // Not JSON — it's a plain barcode string (box_code)
    }

    const result: ScanResult = {
      type: parsed ? 'qr' : 'barcode',
      data,
      parsed,
    };

    onScan(result);

    // Allow re-scan after 2s
    cooldown.current = setTimeout(() => setScanned(false), 2000);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color="#9ca3af" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          FF Scanner needs camera access to scan box labels.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={active ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
        }}
      />

      {/* Overlay with cutout */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          {/* Scan frame */}
          <View style={[styles.frame, scanned && styles.frameScanned]}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {scanned && (
              <View style={styles.scannedOverlay}>
                <Ionicons name="checkmark-circle" size={48} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.hintText}>
            {scanned ? '✓ Scanned!' : (hint ?? 'Point camera at QR code or barcode')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  permissionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  permBtn: {
    marginTop: 8,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayMiddle: {
    height: FRAME_SIZE,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingTop: 20,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  frameScanned: {
    // Flash green when scanned
  },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,163,74,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#22c55e',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
