import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from '../db/database';
import { TabScreenProps } from '../types/navigation';

export default function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const [profile, setProfile] = useState<any>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [gender, setGender] = useState('Prefiero no responder');
  const { colorScheme, setColorScheme } = useColorScheme();
  const { t, i18n } = useTranslation();

  const handleToggleTheme = () => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  };

  const changeLanguage = async (lng: string) => {
    try {
      await i18n.changeLanguage(lng);
      await AsyncStorage.setItem('user-language', lng);
    } catch (e) {
      console.error(e);
    }
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
        setGender(p.gender || 'Prefiero no responder');
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
        'UPDATE UserProfile SET weight = ?, height = ?, age = ?, fitnessLevel = ?, gender = ? WHERE id = ?',
        [parseFloat(weight), parseFloat(height), parseInt(age, 10), fitnessLevel, gender, profile.id]
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
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">{t('profile.title')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{t('profile.close')}</Text>
          </TouchableOpacity>
        </View>
        
        <View className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 mb-6 shadow-sm">
          <View className="flex-row justify-between items-center">
            <Text className="text-gray-800 dark:text-white font-bold text-lg">{t('profile.darkMode')}</Text>
            <Switch 
              value={colorScheme === 'dark'} 
              onValueChange={handleToggleTheme}
              trackColor={{ false: '#d1d5db', true: '#4f46e5' }}
            />
          </View>
        </View>

        <View className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 mb-6 shadow-sm">
          <Text className="text-gray-800 dark:text-white font-bold text-lg mb-2">{t('profile.language')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { code: 'en', label: 'English' },
              { code: 'es', label: 'Español' },
              { code: 'zh', label: '中文' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'fr', label: 'Français' }
            ].map(lang => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => changeLanguage(lang.code)}
                className={`px-4 py-3 rounded-xl border ${i18n.language === lang.code ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
              >
                <Text className={i18n.language === lang.code ? 'text-white font-bold' : 'text-gray-500 dark:text-gray-400'}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
          
          <View>
            <Text className="text-gray-500 dark:text-gray-400 mb-2">{t('profile.weight')}</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">{t('profile.height')}</Text>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">{t('profile.age')}</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">{t('profile.gender')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {['Hombre', 'Mujer', 'Otro', 'Prefiero no responder'].map(option => {
                const label = option === 'Hombre' ? t('profile.male') : 
                              option === 'Mujer' ? t('profile.female') : 
                              option === 'Otro' ? t('profile.other') : t('profile.preferNotToSay');
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setGender(option)}
                    className={`px-4 py-3 rounded-xl border ${gender === option ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                  >
                    <Text className={gender === option ? 'text-white font-bold' : 'text-gray-500 dark:text-gray-400'}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 dark:text-gray-400 mb-2">{t('profile.fitnessLevel')}</Text>
            <View className="flex-row justify-between">
              {['Beginner', 'Intermediate', 'Advanced'].map(level => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setFitnessLevel(level)}
                  className={`flex-1 p-3 rounded-xl mx-1 items-center border ${fitnessLevel === level ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                >
                  <Text className={fitnessLevel === level ? 'text-white font-bold' : 'text-gray-500 dark:text-gray-400'}>
                    {level === 'Beginner' ? t('profile.beginner') : level === 'Intermediate' ? t('profile.intermediate') : t('profile.advanced')}
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
          <Text className="text-white text-lg font-bold">{t('profile.save')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
