import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const HUB_HINTS = [
  { label: 'Hyderabad Hub',  email: 'manager.hyd@ffactory.com',  code: 'HYD' },
  { label: 'Palikarani Hub', email: 'manager.pali@ffactory.com', code: 'PALI' },
  { label: 'Vanagaram Hub',  email: 'manager.vana@ffactory.com', code: 'VANA' },
];

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message);
    }
    // On success → AuthContext detects session → AppNavigator routes to hub dashboard
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>FF</Text>
          </View>
          <Text style={styles.appName}>FF Scanner</Text>
          <Text style={styles.tagline}>Farmers Factory Operations</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Hub Manager Sign In</Text>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="manager.hyd@ffactory.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            autoFocus
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Enter password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass(v => !v)}
            >
              <Ionicons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" />
                <Text style={styles.btnText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick-fill hub selector */}
        <View style={styles.hubSelect}>
          <Text style={styles.hubSelectTitle}>Select Hub Account</Text>
          {HUB_HINTS.map(h => (
            <TouchableOpacity
              key={h.code}
              style={styles.hubChip}
              onPress={() => setEmail(h.email)}
            >
              <View style={styles.hubBadge}>
                <Text style={styles.hubBadgeText}>{h.code}</Text>
              </View>
              <Text style={styles.hubChipLabel}>{h.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  appName: { fontSize: 24, fontWeight: '800', color: '#14532d', marginBottom: 4 },
  tagline: { fontSize: 13, color: '#6b7280' },

  // Form card
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 17, fontWeight: '700', color: '#111827',
    marginBottom: 20, textAlign: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  passwordRow: { position: 'relative', marginBottom: 20 },
  passwordInput: { marginBottom: 0, paddingRight: 48 },
  eyeBtn: {
    position: 'absolute', right: 14, top: 14,
  },
  btn: {
    backgroundColor: '#16a34a', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Hub quick-select
  hubSelect: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  hubSelectTitle: {
    fontSize: 12, fontWeight: '600', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 12,
  },
  hubChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  hubBadge: {
    backgroundColor: '#f0fdf4', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  hubBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  hubChipLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
});
