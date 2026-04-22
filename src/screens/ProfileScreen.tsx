import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getDB } from '../db/database';
import { getSetting, setSetting } from '../db/settings';
import { RootStackScreenProps } from '../types/navigation';

export default function ProfileScreen({ navigation }: RootStackScreenProps<'Profile'>) {
  const [profile, setProfile] = useState<any>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [gender, setGender] = useState('Prefiero no responder');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [weightUnit, setWeightUnit] = useState('kg');
  const { t, i18n } = useTranslation();

  const changeLanguage = async (lng: string) => {
    try {
      if (i18n && i18n.changeLanguage) {
        await i18n.changeLanguage(lng);
      }
      setSetting('language', lng);
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
        setWeight((p as any).weight?.toString() || '');
        setHeight((p as any).height?.toString() || '');
        setAge((p as any).age?.toString() || '');
        setFitnessLevel((p as any).fitnessLevel || 'Beginner');
        setGender((p as any).gender || 'Prefiero no responder');
      }
      const savedDist = getSetting('distanceUnit');
      if (savedDist) setDistanceUnit(savedDist);
      const savedWeight = getSetting('weightUnit');
      if (savedWeight) setWeightUnit(savedWeight);
    } catch (e) {
      console.error(e);
    }
  };

  const saveProfile = () => {
    if (!weight || !height || !age) {
      Alert.alert('Error', t('profile.errorFields'));
      return;
    }
    
    try {
      const db = getDB();
      db.runSync(
        'UPDATE UserProfile SET weight = ?, height = ?, age = ?, fitnessLevel = ?, gender = ? WHERE id = ?',
        [parseFloat(weight), parseFloat(height), parseInt(age, 10), fitnessLevel, gender, profile.id]
      );
      setSetting('distanceUnit', distanceUnit);
      setSetting('weightUnit', weightUnit);
      Alert.alert(t('profile.title'), t('profile.successSave'));
      loadProfile();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', t('profile.errorSave'));
    }
  };

  if (!profile) return null;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className="bg-[#111827]"
    >
      <ScrollView className="flex-1 bg-gray-900 px-6 py-10">
        <View className="flex-row justify-between items-center mb-8 mt-10">
          <Text className="text-3xl font-bold text-white">{t('profile.title')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-indigo-400 font-bold text-lg">{t('profile.close')}</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 mb-6 shadow-sm">
          <Text className="text-white font-bold text-lg mb-2">{t('profile.language')}</Text>
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
                className={`px-4 py-3 rounded-xl border ${i18n.language === lang.code ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-900 border-gray-700'}`}
              >
                <Text className={i18n.language === lang.code ? 'text-white font-bold' : 'text-gray-400'}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 mb-6 shadow-sm">
          <Text className="text-white font-bold text-lg mb-2">{t('profile.distanceUnit')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { code: 'km', label: t('profile.km') },
              { code: 'mi', label: t('profile.mi') }
            ].map(unit => (
              <TouchableOpacity
                key={unit.code}
                onPress={() => setDistanceUnit(unit.code)}
                className={`px-4 py-3 rounded-xl border ${distanceUnit === unit.code ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-900 border-gray-700'}`}
              >
                <Text className={distanceUnit === unit.code ? 'text-white font-bold' : 'text-gray-400'}>
                  {unit.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 mb-6 shadow-sm">
          <Text className="text-white font-bold text-lg mb-2">{t('profile.weightUnit')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { code: 'kg', label: t('profile.kg') },
              { code: 'lbs', label: t('profile.lbs') }
            ].map(unit => (
              <TouchableOpacity
                key={unit.code}
                onPress={() => setWeightUnit(unit.code)}
                className={`px-4 py-3 rounded-xl border ${weightUnit === unit.code ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-900 border-gray-700'}`}
              >
                <Text className={weightUnit === unit.code ? 'text-white font-bold' : 'text-gray-400'}>
                  {unit.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 shadow-sm">
          
          <View>
            <Text className="text-gray-400 mb-2">{t('profile.weight')} ({weightUnit})</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              className="bg-gray-900 text-white p-4 rounded-xl border border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View className="mt-4">
            <Text className="text-gray-400 mb-2">{t('profile.height')}</Text>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              className="bg-gray-900 text-white p-4 rounded-xl border border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 mb-2">{t('profile.age')}</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              className="bg-gray-900 text-white p-4 rounded-xl border border-gray-700"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 mb-2">{t('profile.gender')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {['Hombre', 'Mujer', 'Otro', 'Prefiero no responder'].map(option => {
                const label = option === 'Hombre' ? t('profile.male') : 
                              option === 'Mujer' ? t('profile.female') : 
                              option === 'Otro' ? t('profile.other') : t('profile.preferNotToSay');
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setGender(option)}
                    className={`px-4 py-3 rounded-xl border ${gender === option ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-900 border-gray-700'}`}
                  >
                    <Text className={gender === option ? 'text-white font-bold' : 'text-gray-400'}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 mb-2">{t('profile.fitnessLevel')}</Text>
            <View className="flex-row justify-between">
              {['Beginner', 'Intermediate', 'Advanced'].map(level => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setFitnessLevel(level)}
                  className={`flex-1 p-3 rounded-xl mx-1 items-center border ${fitnessLevel === level ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-900 border-gray-700'}`}
                >
                  <Text className={fitnessLevel === level ? 'text-white font-bold' : 'text-gray-400'}>
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
