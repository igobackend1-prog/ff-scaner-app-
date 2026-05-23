import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';

// Auth
import LoginScreen from '@/screens/auth/LoginScreen';

// Hub Manager
import HubDashboard from '@/screens/hub/HubDashboard';
import ScanReceiveScreen from '@/screens/hub/ScanReceiveScreen';
import QCScreen from '@/screens/hub/QCScreen';
import WastageScreen from '@/screens/hub/WastageScreen';

// Driver
import DriverDashboard from '@/screens/driver/DriverDashboard';
import ScanDispatchScreen from '@/screens/driver/ScanDispatchScreen';
import DeliveryConfirmScreen from '@/screens/driver/DeliveryConfirmScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Hub Manager Tab Navigator ─────────────────────
function HubTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: 'grid-outline',
            'Scan & Receive': 'qr-code-outline',
            Wastage: 'trash-outline',
          };
          return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e5e7eb' },
        headerStyle: { backgroundColor: '#16a34a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Dashboard" component={HubDashboard} />
      <Tab.Screen name="Scan & Receive" component={ScanReceiveScreen} />
      <Tab.Screen name="Wastage" component={WastageScreen} />
    </Tab.Navigator>
  );
}

// Hub Stack (tabs + pushed screens)
function HubStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HubTabs" component={HubTabs} />
      <Stack.Screen
        name="QC"
        component={QCScreen}
        options={{ headerShown: true, title: 'QC Check', headerStyle: { backgroundColor: '#16a34a' }, headerTintColor: '#fff' }}
      />
    </Stack.Navigator>
  );
}

// ── Driver Tab Navigator ──────────────────────────
function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            'My Route': 'map-outline',
            'Scan Pack': 'barcode-outline',
            'Deliver': 'checkmark-circle-outline',
          };
          return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e5e7eb' },
        headerStyle: { backgroundColor: '#2563eb' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="My Route" component={DriverDashboard} />
      <Tab.Screen name="Scan Pack" component={ScanDispatchScreen} />
      <Tab.Screen name="Deliver" component={DeliveryConfirmScreen} />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────
export default function AppNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : profile?.role === 'driver' ? (
          <Stack.Screen name="DriverRoot" component={DriverTabs} />
        ) : (
          // hub_manager, gm, admin all get Hub view by default
          <Stack.Screen name="HubRoot" component={HubStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
