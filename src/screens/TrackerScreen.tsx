import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { RootStackScreenProps } from '../types/navigation';
import { getDistance, formatTime, calculatePace } from '../utils/locationHelpers';
import { healthMock, BiometricData } from '../services/healthMock';
import { calculateCalories } from '../utils/physiology';
import { getDB } from '../db/database';
import { saveActivity } from '../db/activities';
import { useTranslation } from 'react-i18next';
import { getSetting } from '../db/settings';
import { formatDistance, formatPace } from '../utils/units';

type Props = RootStackScreenProps<'Tracker'>;

export default function TrackerScreen({ route, navigation }: Props) {
  const [isTracking, setIsTracking] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  // Activity Type & Config
  const initialActivityType = route.params?.activityType || 'Running';
  const [activityType, setActivityType] = useState(initialActivityType);
  const requiresGPS = route.params?.requiresGPS ?? true; // Default to true if not passed
  const durationMinutes = route.params?.durationMinutes;
  const targetHRZone = route.params?.targetHRZone;
  const coachNotes = route.params?.coachNotes;
  const planDate = route.params?.planDate;
  
  // Tracking Data
  const [distanceKm, setDistanceKm] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);
  
  // Paces
  const [avgPace, setAvgPace] = useState('0:00');
  const [currentPace, setCurrentPace] = useState('0:00');
  
  // Biometric Data (Mock)
  const [biometrics, setBiometrics] = useState<BiometricData>({ currentHR: 0 });
  const [calories, setCalories] = useState(0);

  // User Profile
  const [userProfile, setUserProfile] = useState<{ age: number, weight: number } | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const { t } = useTranslation();

  // Refs for Intervals and Subscribers
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastLocationSample = useRef<{ coords: Location.LocationObjectCoords; timestamp: number } | null>(null);

  const isReliableLocation = (coords: Location.LocationObjectCoords) => {
    return typeof coords.accuracy !== 'number' || coords.accuracy <= 25;
  };

  // Cargar el perfil del usuario para usarlo en el cálculo de calorías
  useEffect(() => {
    try {
      const db = getDB();
      const profile = db.getFirstSync<{ age: number, weight: number }>('SELECT age, weight FROM UserProfile ORDER BY id DESC LIMIT 1');
      if (profile) setUserProfile(profile);
      const dUnit = getSetting('distanceUnit') as 'km' | 'mi';
      if (dUnit) setDistanceUnit(dUnit);
      const wUnit = getSetting('weightUnit') as 'kg' | 'lbs';
      if (wUnit) setWeightUnit(wUnit);
    } catch (e) {
      console.error('Error fetching profile for calories:', e);
    }
  }, []);

  // Efecto que calcula las calorías en tiempo real
  useEffect(() => {
    if (isTracking && userProfile) {
      const timeMins = timeSeconds / 60;
      // Asegurarse de que el peso esté en KG para la fórmula
      const weightInKg = weightUnit === 'lbs' ? userProfile.weight / 2.20462 : userProfile.weight;
      const cals = calculateCalories(userProfile.age, weightInKg, timeMins, biometrics.currentHR);
      setCalories(cals);
    }
  }, [timeSeconds, biometrics.currentHR, userProfile, isTracking, weightUnit]);

  useEffect(() => {
    if (!requiresGPS) return;
    setAvgPace(calculatePace(distanceKm, timeSeconds));
  }, [distanceKm, timeSeconds, requiresGPS]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === 'granted');
        
        if (status !== 'granted') {
          Alert.alert('Error', t('tracker.errorLoc'));
        }
      } catch (error) {
        console.error('Error solicitando permisos:', error);
      }
    })();

    // Cleanup al desmontar
    return () => {
      stopTracking();
    };
  }, []);

  const startTracking = async () => {
    if (requiresGPS && !locationPermission) {
      Alert.alert('Error', t('tracker.errorLoc'));
      return;
    }

    try {
      setIsTracking(true);
      setDistanceKm(0);
      setTimeSeconds(0);
      setRouteCoords([]);
      setAvgPace('0:00');
      setCurrentPace('0:00');
      setCalories(0);
      lastLocationSample.current = null;

      // 1. Iniciar cronómetro
      timerInterval.current = setInterval(() => {
        setTimeSeconds(prev => prev + 1);
      }, 1000);

      // 2. Iniciar Mock de HealthKit (Ritmo cardíaco)
      healthMock.startTracking((data) => {
        setBiometrics(data);
      });

      // 3. Suscribirse a cambios de ubicación en primer plano SÓLO si requiresGPS es true
      if (requiresGPS) {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000, // Actualizar cada 2 segundos
            distanceInterval: 5, // o cada 5 metros
          },
          (location) => {
            const { coords } = location;

            // Ignora lecturas con baja precisión para reducir saltos falsos de GPS.
            if (!isReliableLocation(coords)) {
              return;
            }

            const previousSample = lastLocationSample.current;
            lastLocationSample.current = {
              coords,
              timestamp: location.timestamp,
            };

            setRouteCoords(prev => [...prev, { latitude: coords.latitude, longitude: coords.longitude }]);

            if (!previousSample) {
              return;
            }

            const increment = getDistance(
              previousSample.coords.latitude,
              previousSample.coords.longitude,
              coords.latitude,
              coords.longitude
            );

            // Filtra pequeños saltos de GPS estando casi parado.
            if (increment < 0.003) {
              setCurrentPace('--:--');
              return;
            }

            setDistanceKm(prev => prev + increment);

            const elapsedSeconds = Math.max(
              1,
              Math.round((location.timestamp - previousSample.timestamp) / 1000)
            );
            setCurrentPace(calculatePace(increment, elapsedSeconds));
          }
        );
      }
    } catch (error) {
      console.error('Error iniciando tracking:', error);
      Alert.alert('Error', t('tracker.errorStart'));
      setIsTracking(false);
    }
  };

  const handleExit = () => {
    try {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs');
      }
    } catch (e) {
      console.error('Error al cerrar tracker:', e);
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
    
    // Detener Timer
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    // Detener Location
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    lastLocationSample.current = null;

    // Detener Mock de Salud
    healthMock.stopTracking();

    // Guarda la actividad si al menos ha habido 5 minutos de sesión real,
    // aunque la distancia sea baja o el usuario la termine antes de lo previsto.
    if (timeSeconds >= 5 * 60) {
      const now = new Date();
      const timePart = now.toISOString().split('T')[1];
      const savedDate = planDate ? `${planDate}T${timePart}` : now.toISOString();

      saveActivity({
        date: savedDate,
        durationMinutes: Math.round(timeSeconds / 60),
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        avgPace: avgPace,
        calories: Math.floor(calories),
        avgHR: biometrics.currentHR, // Mockeado por ahora
        routeCoordinates: JSON.stringify(routeCoords),
        type: activityType
      });
      Alert.alert(t('tracker.goodJob'), t('tracker.saved'), [
        { text: 'Ok', onPress: handleExit }
      ]);
    } else {
      Alert.alert(t('tracker.shortActivity'), t('tracker.notSaved'), [
        { text: 'Ok', onPress: handleExit }
      ]);
    }
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      Alert.alert(t('tracker.finish'), t('tracker.finishAsk'), [
        { text: t('tracker.continue'), style: 'cancel' },
        { text: t('tracker.finish'), style: 'destructive', onPress: stopTracking }
      ]);
    } else {
      startTracking();
    }
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <Text className="text-3xl text-gray-900 dark:text-white font-bold">{t('tracker.title')}</Text>
        <TouchableOpacity onPress={handleExit}>
          <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{t('tracker.close')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="bg-white dark:bg-gray-800 rounded-3xl p-8 mb-8 items-center border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-xl dark:shadow-black">
          <Text className="text-gray-500 dark:text-gray-400 text-lg uppercase tracking-widest mb-2">
            {!requiresGPS ? t('tracker.time') : t('tracker.distance')}
          </Text>
          {!requiresGPS ? (
            <Text className="text-gray-900 dark:text-white text-6xl font-black mb-1">
              {formatTime(timeSeconds)}
            </Text>
          ) : (
            <Text className="text-gray-900 dark:text-white text-6xl font-black mb-1">
              {formatDistance(distanceKm, distanceUnit)} <Text className="text-2xl text-gray-400 dark:text-gray-500">{distanceUnit}</Text>
            </Text>
          )}
        </View>

        <View className="flex-row flex-wrap justify-between">
          {/* Actividad / Tiempo (dependiendo de requiresGPS) */}
          <View className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-200 dark:border-gray-700 shadow-sm ${!requiresGPS ? 'w-full' : 'w-[48%]'}`}>
            <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">
              {!requiresGPS ? t('tracker.activity') : t('tracker.time')}
            </Text>
            <Text className="text-gray-900 dark:text-white text-2xl font-bold truncate" numberOfLines={1}>
              {!requiresGPS ? activityType : formatTime(timeSeconds)}
            </Text>
          </View>

          {/* Ritmos (solo si requiresGPS) */}
          {requiresGPS && (
            <>
              <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">{t('tracker.currentPace')}</Text>
                <Text className="text-gray-900 dark:text-white text-2xl font-bold">
                  {formatPace(currentPace, distanceUnit)} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">/{distanceUnit}</Text>
                </Text>
              </View>

              <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">{t('tracker.avgPace')}</Text>
                <Text className="text-gray-900 dark:text-white text-2xl font-bold">
                  {formatPace(avgPace, distanceUnit)} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">/{distanceUnit}</Text>
                </Text>
              </View>
            </>
          )}

          {/* Calorías */}
          <View className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-orange-100 dark:border-orange-900/50 shadow-sm ${!requiresGPS ? 'w-[48%]' : 'w-[48%]'}`}>
            <Text className="text-orange-500 dark:text-orange-400 text-sm mb-1">🔥 {t('tracker.calories')}</Text>
            <Text className="text-gray-900 dark:text-white text-2xl font-bold">{Math.floor(calories)} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">kcal</Text></Text>
          </View>

          {/* FC (Mock) */}
          <View className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-red-100 dark:border-red-900/50 shadow-sm ${!requiresGPS ? 'w-[48%]' : 'w-full'}`}>
            <Text className="text-red-500 dark:text-red-400 text-sm mb-1 flex-row items-center">❤ {t('tracker.currentHR')}</Text>
            <Text className="text-gray-900 dark:text-white text-2xl font-bold">{biometrics.currentHR > 0 ? biometrics.currentHR : '--'} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">ppm</Text></Text>
          </View>
        </View>

        {/* Resumen de la Actividad (Opcional) */}
        {(durationMinutes || targetHRZone || coachNotes) && (
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-2">📋 {t('tracker.planSummary')}</Text>
            {durationMinutes ? (
              <Text className="text-gray-600 dark:text-gray-400 mb-1">
                <Text className="font-bold text-gray-700 dark:text-gray-300">{t('tracker.goal')}</Text> {durationMinutes} min
              </Text>
            ) : null}
            {targetHRZone ? (
              <Text className="text-gray-600 dark:text-gray-400 mb-1">
                <Text className="font-bold text-gray-700 dark:text-gray-300">{t('tracker.hrZone')}</Text> {targetHRZone}
              </Text>
            ) : null}
            {coachNotes ? (
              <Text className="text-gray-600 dark:text-gray-400 leading-5 mt-1">
                <Text className="font-bold text-gray-700 dark:text-gray-300">{t('tracker.notes')}</Text> {coachNotes}
              </Text>
            ) : null}
          </View>
        )}

        <View className="pb-8 pt-4">
          <TouchableOpacity 
            className={`rounded-full py-5 items-center shadow-lg ${isTracking ? 'bg-red-500 shadow-red-500/50' : 'bg-indigo-600 shadow-indigo-500/50'}`}
            onPress={handleToggleTracking}
          >
            <Text className="text-white font-black text-xl uppercase tracking-widest">
              {isTracking ? t('tracker.pauseFinish') : t('tracker.startTraining')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
