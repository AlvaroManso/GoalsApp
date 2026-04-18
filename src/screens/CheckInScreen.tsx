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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50 dark:bg-gray-900"
    >
      <ScrollView className="flex-1 px-6 pt-16">
        <Text className="text-3xl text-gray-900 dark:text-white font-bold mb-2">Check-in Diario</Text>
        <Text className="text-gray-500 dark:text-gray-400 mb-8 text-lg">¿Cómo te sientes hoy?</Text>

        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-900 dark:text-white font-semibold text-lg">Nivel de Fatiga</Text>
            <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{fatigue}/10</Text>
          </View>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-4">1 = Fresco como una lechuga, 10 = Destruido</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={fatigue}
            onValueChange={setFatigue}
            minimumTrackTintColor="#4f46e5"
            maximumTrackTintColor="#374151"
            thumbTintColor="#4f46e5"
          />
        </View>

        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-900 dark:text-white font-semibold text-lg">Dolor Articular</Text>
            <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{jointPain}/10</Text>
          </View>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-4">1 = Sin dolor, 10 = Lesión aguda</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={jointPain}
            onValueChange={setJointPain}
            minimumTrackTintColor="#4f46e5"
            maximumTrackTintColor="#374151"
            thumbTintColor="#4f46e5"
          />
        </View>

        <View className="mb-8">
          <Text className="text-gray-900 dark:text-white font-semibold text-lg mb-4">¿Dormiste bien?</Text>
          <View className="flex-row justify-between">
            {['Terrible', 'Regular', 'Bien', 'Excelente'].map(quality => (
              <TouchableOpacity
                key={quality}
                onPress={() => setSleepQuality(quality)}
                className={`flex-1 mx-1 p-3 rounded-xl items-center border ${
                  sleepQuality === quality 
                    ? 'bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-500/30' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm'
                }`}
              >
                <Text className={sleepQuality === quality ? 'text-white font-bold' : 'text-gray-600 dark:text-gray-400'}>
                  {quality}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          className="bg-indigo-600 py-4 rounded-xl items-center mb-10 shadow-lg shadow-indigo-500/50"
          onPress={handleSave}
        >
          <Text className="text-white font-bold text-lg">Registrar y Continuar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
