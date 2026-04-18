import './global.css';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { initDB } from './src/db/database';

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-gray-900">
      <Text className="text-white text-xl font-bold">AI Hybrid Athlete Coach</Text>
      <StatusBar style="light" />
    </View>
  );
}
