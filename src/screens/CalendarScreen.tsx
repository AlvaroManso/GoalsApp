import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { getAllTrainingPlan, PlanSession } from '../db/trainingPlan';
import { getEvents, AppEvent } from '../db/events';
import { TabScreenProps } from '../types/navigation';

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
  const [plan, setPlan] = useState<PlanSession[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // Escuchar focus de React Navigation para recargar datos
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    loadData();
    return unsubscribe;
  }, [navigation]);

  const loadData = () => {
    const fullPlan = getAllTrainingPlan();
    const allEvents = getEvents();
    
    setPlan(fullPlan);
    setEvents(allEvents);

    const marks: any = {};
    
    // Marcar días de entrenamiento
    fullPlan.forEach(p => {
      if (p.date) {
        marks[p.date] = { 
          marked: true, 
          dotColor: p.activityType === 'Rest' ? '#6b7280' : '#3b82f6' 
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
  };

  const getSessionForDate = (date: string) => plan.find(p => p.date === date);
  const getEventsForDate = (date: string) => events.filter(e => e.date === date);

  const selectedSession = getSessionForDate(selectedDate);
  const selectedEvents = getEventsForDate(selectedDate);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12 px-4">
      <Text className="text-3xl text-gray-900 dark:text-white font-bold mb-6">Calendario</Text>

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
          monthTextColor: '#ffffff',
          arrowColor: '#60a5fa',
          dotColor: '#3b82f6',
          selectedDotColor: '#ffffff',
        }}
        style={{ borderRadius: 16, paddingBottom: 10, marginBottom: 20 }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className="text-xl text-gray-900 dark:text-white font-bold mb-4">Detalle: {selectedDate}</Text>

        {selectedEvents.length > 0 && (
          <View className="mb-4">
            <Text className="text-red-500 dark:text-red-400 font-bold mb-2">🏁 EVENTOS HOY:</Text>
            {selectedEvents.map((e, idx) => (
              <View key={idx} className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-2">
                <Text className="text-gray-900 dark:text-white font-bold">{e.type} (Prioridad {e.priority})</Text>
                {e.description ? <Text className="text-gray-600 dark:text-gray-300 text-sm">{e.description}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {selectedSession ? (
          <View className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-900 dark:text-white font-bold text-lg">{selectedSession.activityType}</Text>
              {selectedSession.durationMinutes > 0 && (
                <Text className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedSession.durationMinutes} min</Text>
              )}
            </View>
            {selectedSession.targetHRZone && (
              <Text className="text-blue-600 dark:text-blue-400 font-semibold mb-2">Zona: {selectedSession.targetHRZone}</Text>
            )}
            <Text className="text-gray-600 dark:text-gray-400 leading-5 mb-4">{selectedSession.coachNotes}</Text>
            
            {selectedDate === new Date().toISOString().split('T')[0] && selectedSession.activityType.toLowerCase() !== 'rest' && (
              <TouchableOpacity 
                className="bg-indigo-600 py-3 rounded-xl items-center flex-row justify-center mt-2 shadow-sm shadow-indigo-500/30"
                onPress={() => (navigation as any).navigate('Tracker', { 
                  activityType: selectedSession.activityType,
                  requiresGPS: (selectedSession as any).requiresGPS,
                  durationMinutes: selectedSession.durationMinutes,
                  targetHRZone: selectedSession.targetHRZone,
                  coachNotes: selectedSession.coachNotes
                })}
              >
                <Text className="text-white font-bold mr-2">Ir al Tracker</Text>
                <Text className="text-white">▶</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="bg-white dark:bg-gray-800 p-6 rounded-xl items-center justify-center border border-gray-300 dark:border-gray-700 border-dashed">
            <Text className="text-gray-500 dark:text-gray-400">No hay entrenamiento programado para este día.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
