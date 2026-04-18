import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { RootStackScreenProps } from '../types/navigation';
import { getDB } from '../db/database';
import { calculateHeartRateZones } from '../utils/physiology';

type Props = RootStackScreenProps<'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [maxHR, setMaxHR] = useState('');
  const [restingHR, setRestingHR] = useState('');
  const [gender, setGender] = useState('Prefiero no responder');

  const handleSave = () => {
    Keyboard.dismiss();
    
    if (!age || !weight || !maxHR || !restingHR) {
      Alert.alert('Error', 'Por favor, completa todos los campos.');
      return;
    }

    const numAge = parseInt(age, 10);
    const numWeight = parseFloat(weight);
    const numMaxHR = parseInt(maxHR, 10);
    const numRestingHR = parseInt(restingHR, 10);

    if (isNaN(numAge) || isNaN(numWeight) || isNaN(numMaxHR) || isNaN(numRestingHR)) {
      Alert.alert('Error', 'Por favor, ingresa valores numéricos válidos.');
      return;
    }

    try {
      const db = getDB();
      db.runSync(
        'INSERT INTO UserProfile (age, weight, maxHR, restingHR, gender) VALUES (?, ?, ?, ?, ?)',
        [numAge, numWeight, numMaxHR, numRestingHR, gender]
      );
      
      const zones = calculateHeartRateZones(numMaxHR, numRestingHR);
      console.log('Zonas calculadas:', zones);

      Alert.alert('Éxito', 'Perfil guardado correctamente.', [
        { text: 'Continuar', onPress: () => navigation.replace('CheckIn') }
      ]);
    } catch (error) {
      console.error('Error guardando el perfil:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-gray-900 px-6 py-12 justify-center"
      >
        <Text className="text-3xl text-white font-bold mb-8 text-center">Configura tu Perfil</Text>
        
        <View className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
          <Text className="text-gray-400 mb-2">Género</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {['Hombre', 'Mujer', 'Otro', 'Prefiero no responder'].map(option => (
              <TouchableOpacity
                key={option}
                onPress={() => setGender(option)}
                className={`px-3 py-2 rounded-xl border ${gender === option ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600'}`}
              >
                <Text className={gender === option ? 'text-white font-bold' : 'text-gray-400'}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-gray-400 mb-2">Edad (años)</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-4"
            placeholder="Ej: 30"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={age}
            onChangeText={setAge}
          />

          <Text className="text-gray-400 mb-2">Peso (kg)</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-4"
            placeholder="Ej: 75.5"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />

          <Text className="text-gray-400 mb-2">FC Máxima (ppm)</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-4"
            placeholder="Ej: 190"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={maxHR}
            onChangeText={setMaxHR}
          />

          <Text className="text-gray-400 mb-2">FC Reposo (ppm)</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-6"
            placeholder="Ej: 50"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={restingHR}
            onChangeText={setRestingHR}
          />

          <TouchableOpacity 
            className="bg-blue-600 rounded-xl py-4 items-center"
            onPress={handleSave}
          >
            <Text className="text-white font-bold text-lg">Guardar Perfil</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
