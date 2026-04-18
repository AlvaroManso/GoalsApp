import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getDB } from '../db/database';
import { TabScreenProps } from '../types/navigation';

export default function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const [profile, setProfile] = useState<any>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const { colorScheme, setColorScheme } = useColorScheme();

  const handleToggleTheme = () => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    try {
      const db = getDB();
      const p = db.getFirstSync('SELECT * FROM UserProfile LIMIT 1');
      if (p) {
        setProfile(p);
        setWeight(p.weight?.toString() || '');
        setHeight(p.height?.toString() || '');
        setAge(p.age?.toString() || '');
        setFitnessLevel(p.fitnessLevel || 'Beginner');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveProfile = () => {
    if (!weight || !height || !age) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    
    try {
      const db = getDB();
      db.runSync(
        'UPDATE UserProfile SET weight = ?, height = ?, age = ?, fitnessLevel = ? WHERE id = ?',
        [parseFloat(weight), parseFloat(height), parseInt(age, 10), fitnessLevel, profile.id]
      );
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      loadProfile();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    }
  };

  if (!profile) return null;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className="bg-gray-50 dark:bg-[#111827]"
    >
      <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900 px-6 py-10">
        <View className="flex-row justify-between items-center mb-8 mt-10">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">Mi Perfil</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">Cerrar</Text>
          </TouchableOpacity>
        </View>
        
        <View className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 mb-6 shadow-sm">
          <View className="flex-row justify-between items-center">
            <Text className="text-gray-800 dark:text-white font-bold text-lg">Modo Oscuro</Text>
            <Switch 
              value={colorScheme === 'dark'} 
              onValueChange={handleToggleTheme}
              trackColor={{ false: '#d1d5db', true: '#4f46e5' }}
            />
          </View>
        </View>

        <View className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
          
          <View>
            <Text className="text-gray-500 dark:text-gray-400 mb-2">Peso (kg)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">Altura (cm)</Text>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">Edad</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">Nivel de Condición</Text>
            <View className="flex-row justify-between">
              {['Beginner', 'Intermediate', 'Advanced'].map(level => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setFitnessLevel(level)}
                  className={`flex-1 p-3 rounded-xl mx-1 items-center border ${fitnessLevel === level ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                >
                  <Text className={fitnessLevel === level ? 'text-white font-bold' : 'text-gray-500 dark:text-gray-400'}>
                    {level === 'Beginner' ? 'Principiante' : level === 'Intermediate' ? 'Medio' : 'Avanzado'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>

        <TouchableOpacity 
          onPress={saveProfile}
          className="bg-indigo-600 p-4 rounded-xl mt-8 mb-12 flex-row justify-center items-center shadow-lg shadow-indigo-500/30"
        >
          <Ionicons name="save" size={24} color="#fff" style={{ marginRight: 8 }} />
          <Text className="text-white text-lg font-bold">Guardar Cambios</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
