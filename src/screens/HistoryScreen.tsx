import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { TabScreenProps } from '../types/navigation';
import { getActivities, Activity } from '../db/activities';
import { useTranslation } from 'react-i18next';
import { getSetting } from '../db/settings';
import { formatDistance, formatPace } from '../utils/units';

type Props = TabScreenProps<'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setActivities(getActivities());
      const unit = getSetting('distanceUnit') as 'km' | 'mi';
      if (unit) setDistanceUnit(unit);
    });
    setActivities(getActivities());
    const unit = getSetting('distanceUnit') as 'km' | 'mi';
    if (unit) setDistanceUnit(unit);
    return unsubscribe;
  }, [navigation]);

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12 px-4">
      <Text className="text-3xl text-gray-900 dark:text-white font-bold mb-6 pl-2">{t('history.title')}</Text>

      {activities.length === 0 ? (
        <View className="items-center justify-center py-20">
          <Text className="text-gray-500 dark:text-gray-400 text-center px-4">{t('history.noWorkouts')}</Text>
        </View>
      ) : (
        activities.map((activity) => {
          let coords: {latitude: number, longitude: number}[] = [];
          try {
            coords = JSON.parse(activity.routeCoordinates || '[]');
          } catch (e) {
            console.error('Error parsing coordinates for map');
          }

          const dateFormatted = new Date(activity.date).toLocaleString(i18n.language, { 
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'
          });

          return (
            <View key={activity.id} className="bg-white dark:bg-gray-800 rounded-2xl mb-6 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
              
              {/* Mapa de Strava-like */}
              <View className="h-48 w-full bg-gray-100 dark:bg-gray-700">
                {coords.length > 0 ? (
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: coords[0].latitude,
                      longitude: coords[0].longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                  >
                    <Polyline
                      coordinates={coords}
                      strokeColor="#ef4444" // Rojo Strava
                      strokeWidth={4}
                    />
                  </MapView>
                ) : (
                  <View className="flex-1 items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <Text className="text-gray-500 dark:text-gray-400">{t('history.noGps')}</Text>
                  </View>
                )}
              </View>

              {/* Detalles de la Actividad */}
              <View className="p-4">
                <Text className="text-gray-500 dark:text-gray-400 text-xs mb-1">{dateFormatted}</Text>
                <Text className="text-gray-900 dark:text-white text-lg font-bold mb-3">{t('history.workoutCompleted')} ({activity.type})</Text>
                
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-gray-500 dark:text-gray-400 text-xs">{t('history.distance')}</Text>
                    <Text className="text-gray-900 dark:text-white font-bold text-lg">{formatDistance(activity.distanceKm, distanceUnit)} {distanceUnit}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-500 dark:text-gray-400 text-xs">{t('history.pace')}</Text>
                    <Text className="text-gray-900 dark:text-white font-bold text-lg">{formatPace(activity.avgPace, distanceUnit)} /{distanceUnit}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-500 dark:text-gray-400 text-xs">{t('history.time')}</Text>
                    <Text className="text-gray-900 dark:text-white font-bold text-lg">{activity.durationMinutes} min</Text>
                  </View>
                </View>

                <View className="flex-row justify-start mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <View className="mr-8">
                    <Text className="text-red-500 dark:text-red-400 text-xs">❤ {t('history.avgHr')}</Text>
                    <Text className="text-gray-900 dark:text-white font-bold">{activity.avgHR || '--'} ppm</Text>
                  </View>
                  <View>
                    <Text className="text-orange-500 dark:text-orange-400 text-xs">🔥 {t('history.calories')}</Text>
                    <Text className="text-gray-900 dark:text-white font-bold">{activity.calories} kcal</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
