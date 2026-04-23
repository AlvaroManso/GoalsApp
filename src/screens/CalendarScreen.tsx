import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { getAllTrainingPlan, PlanSession } from '../db/trainingPlan';
import { getEvents, AppEvent } from '../db/events';
import { getActivities } from '../db/activities';
import { TabScreenProps } from '../types/navigation';
import { exportPlanToICS } from '../utils/icsExport';
import { importPlanFromICS } from '../utils/icsImport';
import { useTranslation } from 'react-i18next';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

type Props = TabScreenProps<'Calendar'>;

export default function CalendarScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlanSession[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [completedSessionKeys, setCompletedSessionKeys] = useState<string[]>([]);

  const getSessionCompletionKey = (date: string, activityType: string) =>
    `${date}::${activityType.trim().toLowerCase()}`;

  const loadData = useCallback(() => {
    const fullPlan = getAllTrainingPlan();
    const allEvents = getEvents();
    const history = getActivities();

    setPlan(fullPlan);
    setEvents(allEvents);
    setCompletedSessionKeys(
      history
        .filter(act => Boolean(act.type))
        .map(act => getSessionCompletionKey(act.date.split('T')[0], act.type || 'Running'))
    );

    const marks: Record<string, any> = {};

    // Marcar días de entrenamiento
    fullPlan.forEach(p => {
      if (p.date) {
        marks[p.date] = {
          marked: true,
          dotColor: p.activityType === 'Rest' ? '#6b7280' : '#60a5fa'
        };
      }
    });

    // Marcar eventos con rojo y color de fondo
    allEvents.forEach(e => {
      marks[e.date] = {
        ...marks[e.date],
        selected: true,
        selectedColor: '#ef4444', // Rojo para evento
      };
    });

    setMarkedDates(marks);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    loadData();
    return unsubscribe;
  }, [navigation, loadData]);

  const getSessionsForDate = (date: string) => plan.filter(p => p.date === date);
  const getEventsForDate = (date: string) => events.filter(e => e.date === date);

  const selectedSessions = getSessionsForDate(selectedDate);
  const selectedEvents = getEventsForDate(selectedDate);

  return (
    <View className="flex-1 bg-gray-900 pt-12 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-3xl text-white font-bold">{t('calendarScreen.title')}</Text>
        <View className="flex-row space-x-2">
          <TouchableOpacity 
            onPress={() => importPlanFromICS(t, loadData)}
            className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 shadow-sm mr-2"
          >
            <Text className="text-gray-300 font-bold">{t('calendarScreen.importICS')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => exportPlanToICS(plan, t)}
            className="bg-indigo-600 px-4 py-2 rounded-lg shadow-sm"
          >
            <Text className="text-white font-bold">{t('calendarScreen.exportICS')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Calendar
        current={selectedDate}
        firstDay={1} // Lunes como primer día de la semana
        onDayPress={(day: any) => {
          setSelectedDate(day.dateString);
        }}
        markedDates={{
          ...markedDates,
          [selectedDate]: {
            ...markedDates[selectedDate],
            selected: true,
            selectedColor: markedDates[selectedDate]?.selectedColor === '#ef4444' ? '#ef4444' : '#4f46e5'
          }
        }}
        theme={{
          backgroundColor: '#111827',
          calendarBackground: '#1f2937',
          textSectionTitleColor: '#9ca3af',
          selectedDayBackgroundColor: '#4f46e5',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#60a5fa',
          dayTextColor: '#f3f4f6',
          textDisabledColor: '#4b5563',
          dotColor: '#60a5fa',
          selectedDotColor: '#ffffff',
          arrowColor: '#60a5fa',
          monthTextColor: '#ffffff',
        }}
        style={{ borderRadius: 16, paddingBottom: 10, marginBottom: 20 }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className="text-xl text-white font-bold mb-4">Detalle: {selectedDate}</Text>

        {selectedEvents.length > 0 && (
          <View className="mb-4">
            <Text className="text-red-400 font-bold mb-2">{t('calendarScreen.eventsToday')}</Text>
            {selectedEvents.map((e, idx) => (
              <View key={idx} className="bg-red-900/20 p-4 rounded-xl border border-red-800 mb-2">
                <Text className="text-white font-bold">{e.type} (Prioridad {e.priority})</Text>
                {e.description ? <Text className="text-gray-300 text-sm">{e.description}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {selectedSessions.length > 0 ? (
          <View className="mb-6">
            {selectedSessions.map((selectedSession, index) => {
              const isRest = selectedSession.activityType.toLowerCase() === 'rest';
              const isCompleted = completedSessionKeys.includes(
                getSessionCompletionKey(selectedSession.date!, selectedSession.activityType)
              );

              return (
                <View
                  key={`${selectedSession.date}-${selectedSession.activityType}-${index}`}
                  className={`p-4 rounded-xl border shadow-sm mb-4 ${
                    isCompleted ? 'bg-green-950/20 border-green-800' : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center flex-1 mr-3">
                      {isCompleted ? (
                        <View className="bg-green-900/40 rounded-full w-6 h-6 items-center justify-center mr-2">
                          <Text className="text-green-400 text-xs">✓</Text>
                        </View>
                      ) : null}
                      <Text className="text-white font-bold text-lg flex-1">{selectedSession.activityType}</Text>
                    </View>
                    <View className="items-end">
                      {selectedSession.durationMinutes > 0 && (
                        <Text className="text-indigo-400 font-bold">{selectedSession.durationMinutes} min</Text>
                      )}
                      {!isRest && (
                        <Text className="text-xs text-gray-400 mt-1">
                          {selectedSession.requiresGPS ? 'Tracker GPS' : 'Tracker sin GPS'}
                        </Text>
                      )}
                    </View>
                  </View>

                  {selectedSession.targetHRZone && (
                    <Text className="text-blue-400 font-semibold mb-2">Zona: {selectedSession.targetHRZone}</Text>
                  )}
                  <Text className="text-gray-300 leading-5 mb-4">{selectedSession.coachNotes}</Text>

                  {selectedDate === new Date().toISOString().split('T')[0] && !isRest && !isCompleted && (
                    <TouchableOpacity
                      className="bg-indigo-600 py-3 rounded-xl items-center flex-row justify-center mt-2 shadow-sm shadow-indigo-500/30"
                      onPress={() => {
                        try {
                          const parent = navigation.getParent();
                          const trackerParams = {
                            activityType: selectedSession.activityType,
                            requiresGPS: (selectedSession as PlanSession).requiresGPS,
                            durationMinutes: selectedSession.durationMinutes,
                            targetHRZone: selectedSession.targetHRZone,
                            coachNotes: selectedSession.coachNotes,
                            planDate: selectedSession.date
                          };
                          if (parent) {
                            parent.navigate('Tracker', trackerParams);
                          } else {
                            (navigation as any).navigate('Tracker', trackerParams);
                          }
                        } catch (e) {
                          console.error('Navigation error:', e);
                        }
                      }}
                    >
                      <Text className="text-white font-bold text-center text-base">{t('calendarScreen.goToTracker')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View className="bg-gray-800 p-6 rounded-xl items-center justify-center border border-gray-700 border-dashed">
            <Text className="text-gray-400">{t('calendarScreen.noTraining')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
