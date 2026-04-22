import 'react-native-gesture-handler';

import './src/i18n';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDB } from './src/db/database';
import { hydrateLanguageFromDB } from './src/i18n';
import { scheduleDailyReminders } from './src/services/notificationService';

import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Force the app into the single supported theme.
        setColorScheme('dark');
        initDB();
        await hydrateLanguageFromDB();
        scheduleDailyReminders().catch(err => console.log('Error scheduling notifications:', err));
        setDbReady(true);
      } catch (error) {
        console.error('Error in App DB init:', error);
      }
    };

    bootstrap();
  }, [setColorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <NavigationContainer>
        {dbReady ? (
          <AppNavigator />
        ) : (
          <View className="flex-1 items-center justify-center bg-gray-900">
            <Text className="text-white">Cargando base de datos...</Text>
          </View>
        )}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
