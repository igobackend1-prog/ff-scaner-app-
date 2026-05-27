import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupEODAlarm } from './src/utils/eodAlarm';

export default function App() {
  useEffect(() => {
    // Schedule daily 19:30 EOD wastage alarm (non-blocking)
    setupEODAlarm().catch(console.warn);
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor="#16a34a" />
      <AppNavigator />
    </AuthProvider>
  );
}
