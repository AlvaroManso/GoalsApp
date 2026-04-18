import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { RootStackScreenProps } from '../types/navigation';
import { getDistance, formatTime, calculatePace } from '../utils/locationHelpers';
import { healthMock, BiometricData } from '../services/healthMock';

type Props = RootStackScreenProps<'Tracker'>;

export default function TrackerScreen({ navigation }: Props) {
  const [isTracking, setIsTracking] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  // Tracking Data
  const [distanceKm, setDistanceKm] = useState(0);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [lastLocation, setLastLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [currentPace, setCurrentPace] = useState('0:00');
  
  // Biometric Data (Mock)
  const [biometrics, setBiometrics] = useState<BiometricData>({ currentHR: 0, caloriesBurned: 0 });

  // Refs for Intervals and Subscribers
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

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
    if (!locationPermission) {
      Alert.alert('Error', 'No hay permisos de ubicación.');
      return;
    }

    try {
      setIsTracking(true);
      setDistanceKm(0);
      setTimeSeconds(0);
      setLastLocation(null);
      setCurrentPace('0:00');

      // 1. Iniciar cronómetro
      timerInterval.current = setInterval(() => {
        setTimeSeconds(prev => prev + 1);
      }, 1000);

      // 2. Iniciar Mock de HealthKit (Ritmo cardíaco y calorías)
      healthMock.startTracking((data) => {
        setBiometrics(data);
      });

      // 3. Suscribirse a cambios de ubicación en primer plano
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Actualizar cada 2 segundos
          distanceInterval: 5, // o cada 5 metros
        },
        (location) => {
          const { coords } = location;
          
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
                // Calculamos el ritmo cada vez que la distancia cambia
                setCurrentPace(calculatePace(newDist, timeSeconds));
                return newDist;
              });
            }
            return coords;
          });
        }
      );
    } catch (error) {
      console.error('Error iniciando tracking:', error);
      Alert.alert('Error', 'No se pudo iniciar el rastreo GPS.');
      setIsTracking(false);
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
    <View className="flex-1 bg-gray-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <Text className="text-3xl text-white font-bold">Tracker</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-blue-400 font-bold">Cerrar</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-gray-800 rounded-3xl p-8 mb-8 items-center border border-gray-700 shadow-xl shadow-black">
        <Text className="text-gray-400 text-lg uppercase tracking-widest mb-2">Distancia</Text>
        <Text className="text-white text-6xl font-black mb-1">
          {distanceKm.toFixed(2)} <Text className="text-2xl text-gray-500">km</Text>
        </Text>
      </View>

      <View className="flex-row flex-wrap justify-between">
        {/* Tiempo */}
        <View className="bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-gray-700">
          <Text className="text-gray-400 text-sm mb-1">Tiempo</Text>
          <Text className="text-white text-2xl font-bold">{formatTime(timeSeconds)}</Text>
        </View>

        {/* Ritmo */}
        <View className="bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-gray-700">
          <Text className="text-gray-400 text-sm mb-1">Ritmo Medio</Text>
          <Text className="text-white text-2xl font-bold">{currentPace} <Text className="text-sm font-normal text-gray-500">/km</Text></Text>
        </View>

        {/* FC (Mock) */}
        <View className="bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-red-900/50">
          <Text className="text-red-400 text-sm mb-1 flex-row items-center">❤ FC Actual</Text>
          <Text className="text-white text-2xl font-bold">{biometrics.currentHR > 0 ? biometrics.currentHR : '--'} <Text className="text-sm font-normal text-gray-500">ppm</Text></Text>
        </View>

        {/* Calorías (Mock) */}
        <View className="bg-gray-800 rounded-2xl p-4 w-[48%] mb-4 border border-orange-900/50">
          <Text className="text-orange-400 text-sm mb-1">🔥 Calorías</Text>
          <Text className="text-white text-2xl font-bold">{Math.floor(biometrics.caloriesBurned)} <Text className="text-sm font-normal text-gray-500">kcal</Text></Text>
        </View>
      </View>

      <View className="flex-1 justify-end pb-8">
        <TouchableOpacity 
          className={`rounded-full py-5 items-center shadow-lg ${isTracking ? 'bg-red-600 shadow-red-500/50' : 'bg-blue-600 shadow-blue-500/50'}`}
          onPress={handleToggleTracking}
        >
          <Text className="text-white font-black text-xl uppercase tracking-widest">
            {isTracking ? 'PAUSAR / FINALIZAR' : 'INICIAR ENTRENAMIENTO'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
