import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { RootStackScreenProps } from '../types/navigation';
import { getDB } from '../db/database';
import { checkDailyReadiness } from '../utils/physiology';

type Props = RootStackScreenProps<'CheckIn'>;

export default function CheckInScreen({ navigation }: Props) {
  const [fatigue, setFatigue] = useState<number>(5);
  const [jointPain, setJointPain] = useState<number>(1);

  const handleSave = () => {
    try {
      const db = getDB();
      const today = new Date().toISOString().split('T')[0];
      
      db.runSync(
        'INSERT INTO DailyCheckin (date, fatigue, jointPain) VALUES (?, ?, ?)',
        [today, fatigue, jointPain]
      );

      const readiness = checkDailyReadiness(fatigue, jointPain);
      
      Alert.alert(
        readiness.canRun ? '¡A Entrenar!' : 'Alerta de Descanso',
        `${readiness.message}\n\n${readiness.suggestion}`,
        [
          { text: 'Ir al Dashboard', onPress: () => navigation.replace('MainTabs') }
        ]
      );
    } catch (error) {
      console.error('Error guardando el check-in:', error);
      Alert.alert('Error', 'No se pudo guardar el check-in diario.');
    }
  };

  return (
    <View className="flex-1 bg-gray-900 px-6 py-12 justify-center">
      <Text className="text-3xl text-white font-bold mb-8 text-center">Check-in Diario</Text>
      
      <View className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-2">
            Nivel de Fatiga: <Text className="text-blue-400 font-bold">{fatigue}</Text>/10
          </Text>
          <Text className="text-gray-400 text-sm mb-4">1 = Muy fresco, 10 = Exhausto</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={fatigue}
            onValueChange={setFatigue}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#4b5563"
            thumbTintColor="#60a5fa"
          />
        </View>

        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-2">
            Dolor Articular: <Text className="text-red-400 font-bold">{jointPain}</Text>/10
          </Text>
          <Text className="text-gray-400 text-sm mb-4">1 = Sin dolor, 10 = Dolor severo</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={jointPain}
            onValueChange={setJointPain}
            minimumTrackTintColor="#ef4444"
            maximumTrackTintColor="#4b5563"
            thumbTintColor="#f87171"
          />
        </View>

        <TouchableOpacity 
          className="bg-blue-600 rounded-xl py-4 items-center mt-4"
          onPress={handleSave}
        >
          <Text className="text-white font-bold text-lg">Registrar y Continuar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
