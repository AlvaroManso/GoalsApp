import 'react-native-gesture-handler';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDB } from './src/db/database';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    try {
      initDB();
      setDbReady(true);
    } catch (error) {
      console.error('Error in App DB init:', error);
    }
  }, []);

  if (!dbReady) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-900">
        <Text className="text-white">Cargando base de datos...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
