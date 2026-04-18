import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { RootStackScreenProps } from '../types/navigation';
import { getDistance, formatTime, calculatePace } from '../utils/locationHelpers';
import { healthMock, BiometricData } from '../services/healthMock';
import { calculateCalories } from '../utils/physiology';
import { getDB } from '../db/database';
import { saveActivity } from '../db/activities';

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
  
  // Tracking Data
  const [distanceKm, setDistanceKm] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [lastLocation, setLastLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);
  
  // Paces
  const [avgPace, setAvgPace] = useState('0:00');
  const [currentPace, setCurrentPace] = useState('0:00');
  
  // Biometric Data (Mock)
  const [biometrics, setBiometrics] = useState<BiometricData>({ currentHR: 0 });
  const [calories, setCalories] = useState(0);

  // User Profile
  const [userProfile, setUserProfile] = useState<{ age: number, weight: number } | null>(null);

  // Refs for Intervals and Subscribers
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Cargar el perfil del usuario para usarlo en el cálculo de calorías
  useEffect(() => {
    try {
      const db = getDB();
      const profile = db.getFirstSync<{ age: number, weight: number }>('SELECT age, weight FROM UserProfile ORDER BY id DESC LIMIT 1');
      if (profile) setUserProfile(profile);
    } catch (e) {
      console.error('Error fetching profile for calories:', e);
    }
  }, []);

  // Efecto que calcula las calorías en tiempo real
  useEffect(() => {
    if (isTracking && userProfile) {
      const timeMins = timeSeconds / 60;
      const cals = calculateCalories(userProfile.age, userProfile.weight, timeMins, biometrics.currentHR);
      setCalories(cals);
    }
  }, [timeSeconds, biometrics.currentHR, userProfile, isTracking]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === 'granted');
        
        if (status !== 'granted') {
          Alert.alert('Permiso Denegado', 'Necesitamos acceso a tu ubicación para rastrear tu entrenamiento.');
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
      Alert.alert('Error', 'No hay permisos de ubicación para esta actividad.');
      return;
    }

    try {
      setIsTracking(true);
      setDistanceKm(0);
      setTimeSeconds(0);
      setLastLocation(null);
      setRouteCoords([]);
      setAvgPace('0:00');
      setCurrentPace('0:00');
      setCalories(0);

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
            
            setRouteCoords(prev => [...prev, { latitude: coords.latitude, longitude: coords.longitude }]);

            setLastLocation(prevLocation => {
              if (prevLocation) {
                const increment = getDistance(
                  prevLocation.latitude,
                  prevLocation.longitude,
                  coords.latitude,
                  coords.longitude
                );
                
                setDistanceKm(prev => {
                  const newDist = prev + increment;
                  // Ritmo Medio
                  setAvgPace(calculatePace(newDist, timeSeconds));
                  return newDist;
                });

                // Ritmo Actual (Aprox usando solo el último incremento de tiempo que son ~2 seg)
                setCurrentPace(calculatePace(increment, 2));
              }
              return coords;
            });
          }
        );
      }
    } catch (error) {
      console.error('Error iniciando tracking:', error);
      Alert.alert('Error', 'No se pudo iniciar la actividad.');
      setIsTracking(false);
    }
  };

  const handleExit = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
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

    // Detener Mock de Salud
    healthMock.stopTracking();

      // Guardar actividad en BD
    if (distanceKm > 0.01 || timeSeconds > 30) {
      saveActivity({
        date: new Date().toISOString(),
        durationMinutes: Math.round(timeSeconds / 60),
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        avgPace: avgPace,
        calories: Math.floor(calories),
        avgHR: biometrics.currentHR, // Mockeado por ahora
        routeCoordinates: JSON.stringify(routeCoords),
        type: activityType
      });
      Alert.alert('¡Buen Trabajo!', 'Tu entrenamiento ha sido guardado en el historial.', [
        { text: 'Ok', onPress: handleExit }
      ]);
    } else {
      Alert.alert('Actividad Corta', 'El entrenamiento fue muy corto y no se guardó.', [
        { text: 'Ok', onPress: handleExit }
      ]);
    }
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      Alert.alert('Finalizar', '¿Deseas finalizar este entrenamiento?', [
        { text: 'Continuar Entrenando', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: stopTracking }
      ]);
    } else {
      startTracking();
    }
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <Text className="text-3xl text-gray-900 dark:text-white font-bold">Tracker</Text>
        <TouchableOpacity onPress={handleExit}>
          <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">Cerrar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="bg-white dark:bg-gray-800 rounded-3xl p-8 mb-8 items-center border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-xl dark:shadow-black">
          <Text className="text-gray-500 dark:text-gray-400 text-lg uppercase tracking-widest mb-2">
            {!requiresGPS ? 'Tiempo' : 'Distancia'}
          </Text>
          {!requiresGPS ? (
            <Text className="text-gray-900 dark:text-white text-6xl font-black mb-1">
              {formatTime(timeSeconds)}
            </Text>
          ) : (
            <Text className="text-gray-900 dark:text-white text-6xl font-black mb-1">
              {distanceKm.toFixed(2)} <Text className="text-2xl text-gray-400 dark:text-gray-500">km</Text>
            </Text>
          )}
        </View>

        <View className="flex-row flex-wrap justify-between">
          {/* Actividad / Tiempo (dependiendo de requiresGPS) */}
          <View className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-200 dark:border-gray-700 shadow-sm ${!requiresGPS ? 'w-full' : 'w-[48%]'}`}>
            <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">
              {!requiresGPS ? 'Actividad' : 'Tiempo'}
            </Text>
            <Text className="text-gray-900 dark:text-white text-2xl font-bold truncate" numberOfLines={1}>
              {!requiresGPS ? activityType : formatTime(timeSeconds)}
            </Text>
          </View>

          {/* Ritmos (solo si requiresGPS) */}
          {requiresGPS && (
            <>
              <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">Ritmo Actual</Text>
                <Text className="text-gray-900 dark:text-white text-2xl font-bold">
                  {currentPace} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">/km</Text>
                </Text>
              </View>

              <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">Ritmo Medio</Text>
                <Text className="text-gray-900 dark:text-white text-2xl font-bold">
                  {avgPace} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">/km</Text>
                </Text>
              </View>
            </>
          )}

          {/* Calorías */}
          <View className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-orange-100 dark:border-orange-900/50 shadow-sm ${!requiresGPS ? 'w-[48%]' : 'w-[48%]'}`}>
            <Text className="text-orange-500 dark:text-orange-400 text-sm mb-1">🔥 Calorías</Text>
            <Text className="text-gray-900 dark:text-white text-2xl font-bold">{Math.floor(calories)} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">kcal</Text></Text>
          </View>

          {/* FC (Mock) */}
          <View className={`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-red-100 dark:border-red-900/50 shadow-sm ${!requiresGPS ? 'w-[48%]' : 'w-full'}`}>
            <Text className="text-red-500 dark:text-red-400 text-sm mb-1 flex-row items-center">❤ FC Actual</Text>
            <Text className="text-gray-900 dark:text-white text-2xl font-bold">{biometrics.currentHR > 0 ? biometrics.currentHR : '--'} <Text className="text-sm font-normal text-gray-400 dark:text-gray-500">ppm</Text></Text>
          </View>
        </View>

        {/* Resumen de la Actividad (Opcional) */}
        {(durationMinutes || targetHRZone || coachNotes) && (
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-2">📋 Resumen del Plan</Text>
            {durationMinutes ? (
              <Text className="text-gray-600 dark:text-gray-400 mb-1">
                <Text className="font-bold text-gray-700 dark:text-gray-300">Objetivo:</Text> {durationMinutes} min
              </Text>
            ) : null}
            {targetHRZone ? (
              <Text className="text-gray-600 dark:text-gray-400 mb-1">
                <Text className="font-bold text-gray-700 dark:text-gray-300">Zona FC:</Text> {targetHRZone}
              </Text>
            ) : null}
            {coachNotes ? (
              <Text className="text-gray-600 dark:text-gray-400 leading-5 mt-1">
                <Text className="font-bold text-gray-700 dark:text-gray-300">Notas:</Text> {coachNotes}
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
              {isTracking ? 'PAUSAR / FINALIZAR' : 'INICIAR ENTRENAMIENTO'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
