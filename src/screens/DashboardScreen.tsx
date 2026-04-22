import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView, RefreshControl } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TabScreenProps } from '../types/navigation';
import { getEvents, addEvent, updateEvent, deleteEvent, AppEvent } from '../db/events';
import { getDB } from '../db/database';
import { LoadingState, ErrorState, EmptyState } from '../components/UIStates';
import { generateWeeklyPlan, PlanSession } from '../services/geminiService';
import { saveApiKey, getApiKey } from '../services/secureStorage';
import { useTranslation } from 'react-i18next';
import { saveTrainingPlan, getAllTrainingPlan, updatePlanSessions } from '../db/trainingPlan';
import { saveActivity, deleteActivityByDateAndType, getActivities } from '../db/activities';
import { getSetting, setSetting } from '../db/settings';

type Props = TabScreenProps<'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [plan, setPlan] = useState<PlanSession[]>([]);
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0); // Progress for the bar
  const [isError, setIsError] = useState(false);
  
  // Modals
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
  const [isPreGenModalVisible, setIsPreGenModalVisible] = useState(false);

  // Form states
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventType, setEventType] = useState('10k');
  const [customEventType, setCustomEventType] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState('');
  const [runDays, setRunDays] = useState(4);
  const [strengthDays, setStrengthDays] = useState(2);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();

  const EVENT_OPTIONS = ['10k', 'Media Maratón', 'Maratón', 'Triatlón', 'Ciclismo', 'Trail/Montaña', 'Fuerza', 'Hyrox', 'Otro'];
  const EQUIPMENT_OPTIONS = ['Cinta de Correr', 'Rodillo / Bici Estática', 'Piscina Infinita / Estática', 'Pesas / Gimnasio', 'Pista de Atletismo'];

  const loadEvents = () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = getEvents();
      // Ordenar eventos de más próximo a más lejano
      const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(sortedData);

      // Cargar plan guardado si existe
      const savedPlan = getAllTrainingPlan();
      if (savedPlan && savedPlan.length > 0) {
        // Encontrar el lunes de la semana actual
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const day = today.getDay(); // 0 is Sunday, 1 is Monday...
        // Ajuste: Si es domingo (0), la diferencia al lunes anterior es -6 días.
        // Si es cualquier otro día, la diferencia es 1 - day.
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() + diffToMonday);
        currentMonday.setHours(0, 0, 0, 0);

        // Obtener 7 días desde el lunes de la semana actual
        const currentWeekPlan = savedPlan.filter(p => {
          const pDate = new Date(p.date!);
          return pDate.getTime() >= currentMonday.getTime();
        }).slice(0, 7);
        
        setPlan(currentWeekPlan);
      }

      // Cargar historial de actividades para ver cuáles están completadas
      const history = getActivities();
      const completed = history.map(act => {
        // Extract YYYY-MM-DD from ISO string
        return act.date.split('T')[0];
      });
      setCompletedDates(completed);

    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedPrefs = getSetting('user-preferences');
    if (savedPrefs !== null) {
      setUserPreferences(savedPrefs);
    }
    loadEvents();
  }, []);

  const handlePreferencesChange = (text: string) => {
    setUserPreferences(text);
    try {
      setSetting('user-preferences', text);
    } catch {}
  };

  // Refresh on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadEvents();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleAddOrUpdateEvent = () => {
    const finalType = eventType === 'Otro' ? customEventType.trim() : eventType;

    if (!finalType || !eventDate) {
      Alert.alert('Error', 'Todos los campos obligatorios deben estar completos');
      return;
    }
    try {
      if (editingEventId !== null) {
        updateEvent({
          id: editingEventId,
          type: finalType,
          description: eventDescription.trim(),
          priority: 'A',
          date: eventDate.toISOString().split('T')[0]
        });
      } else {
        addEvent({ 
          type: finalType, 
          description: eventDescription.trim(), 
          priority: 'A', 
          date: eventDate.toISOString().split('T')[0] 
        });
      }
      
      setIsModalVisible(false);
      resetEventForm();
      loadEvents();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el evento');
    }
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventType('10k');
    setCustomEventType('');
    setEventDescription('');
    setEventDate(new Date());
  };

  const handleEditEvent = (item: AppEvent) => {
    setEditingEventId(item.id!);
    
    // Set type or custom type
    if (EVENT_OPTIONS.includes(item.type)) {
      setEventType(item.type);
      setCustomEventType('');
    } else {
      setEventType('Otro');
      setCustomEventType(item.type);
    }
    
    setEventDescription(item.description || '');
    // Añadimos T12:00:00 para evitar que el timezone lo desplace al día anterior
    setEventDate(new Date(item.date + 'T12:00:00Z'));
    setIsModalVisible(true);
  };

  const handleDeleteEvent = (id: number) => {
    Alert.alert('Eliminar Evento', '¿Estás seguro de que deseas eliminar este evento?', [
      { text: t('modals.cancel'), style: 'cancel' },
      { 
        text: 'Eliminar', 
        style: 'destructive',
        onPress: () => {
          try {
            deleteEvent(id);
            loadEvents();
          } catch (err) {
            Alert.alert('Error', 'No se pudo eliminar el evento');
          }
        }
      }
    ]);
  };

  const onDragEnd = ({ data }: { data: PlanSession[] }) => {
    // Actualizar estado local inmediatamente para evitar saltos visuales
    setPlan(data);

    // Reasignar fechas basado en el nuevo orden (manteniendo la misma secuencia de fechas)
    // El 'plan' original antes del drag tenía unas fechas. Debemos mantener esas fechas pero intercambiar los objetos.
    const originalDates = plan.map(p => p.date!);
    
    const updates = data.map((item, index) => {
      const newDate = originalDates[index];
      return {
        ...item,
        date: newDate,
      };
    });

    try {
      updatePlanSessions(updates);
      // Volver a cargar para asegurar consistencia
      loadEvents();
    } catch (e) {
      console.error('Error reordering plan:', e);
      Alert.alert('Error', 'No se pudo guardar el nuevo orden de los entrenamientos.');
    }
  };
  const handleGeneratePlan = async () => {
    // Si no hay plan generado y las preferencias están vacías, obligar a rellenar primero.
    if (plan.length === 0 && userPreferences.trim() === '') {
      Alert.alert(t('dashboard.prefsNeeded'), t('dashboard.prefsNeededMsg'));
      setIsPreGenModalVisible(true);
      return;
    }

    const key = await getApiKey();
    if (!key) {
      setIsApiKeyModalVisible(true);
      return;
    }

    try {
      setIsGeneratingPlan(true);
      const db = getDB();
      
      // Obtener datos del usuario
      const profile = db.getFirstSync<any>('SELECT * FROM UserProfile ORDER BY id DESC LIMIT 1');
      const today = new Date().toISOString().split('T')[0];
      const checkin = db.getFirstSync<any>('SELECT * FROM DailyCheckin WHERE date = ? ORDER BY id DESC LIMIT 1', [today]);

      if (!profile) {
        Alert.alert('Error', t('dashboard.errorProfile'));
        setIsGeneratingPlan(false);
        return;
      }

      setGenerationProgress(0); // Resetear progreso

      const generatedPlan = await generateWeeklyPlan({
        age: profile.age,
        gender: profile.gender || 'Prefiero no responder',
        restingHR: profile.restingHR,
        fatigue: checkin ? checkin.fatigue : 5,
        jointPain: checkin ? checkin.jointPain : 1,
        events: events,
        runAvailability: runDays,
        strengthAvailability: strengthDays,
        equipment: equipment,
        userPreferences: userPreferences,
        onProgress: (prog) => {
          setGenerationProgress(prog);
        }
      });

      saveTrainingPlan(generatedPlan);
      const newPlan = getAllTrainingPlan();
      setPlan(newPlan);
      
      Alert.alert('¡Plan Generado!', 'Hemos diseñado un macrociclo de 52 semanas adaptado 100% a tu fisiología. ¡Revísalo en el Calendario!');
    } catch (error: any) {
      console.error('Error in handleGeneratePlan:', error);
      Alert.alert('Error', error.message || t('dashboard.errorPlan'));
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!tempApiKey.trim()) {
      Alert.alert('Error', 'Por favor ingresa una API Key válida.');
      return;
    }
    
    try {
      await saveApiKey(tempApiKey.trim());
      setIsApiKeyModalVisible(false);
      setTempApiKey('');
      Alert.alert('¡Llave IA Configurada!', 'Ahora sí, prepárate para generar el plan de entrenamiento definitivo.', [
        { text: 'Diseñar Mi Plan', onPress: handleGeneratePlan }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la API Key.');
    }
  };

  const handleToggleEquipment = (item: string) => {
    setEquipment(prev => 
      prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
    );
  };

  const handleMarkAsCompleted = (item: PlanSession) => {
    Alert.alert(
      t('dashboard.markTitle'),
      t('dashboard.markMsg', { activity: item.activityType }),
      [
        { text: t('dashboard.cancel'), style: 'cancel' },
        {
          text: t('dashboard.mark'),
          onPress: () => {
            try {
              saveActivity({
                date: new Date(item.date + 'T12:00:00Z').toISOString(),
                durationMinutes: item.durationMinutes || 0,
                distanceKm: 0,
                avgPace: '0:00',
                calories: 0,
                avgHR: 0,
                routeCoordinates: '[]',
                type: item.activityType
              });
              loadEvents(); // Recargar para actualizar el check verde
            } catch (err) {
              Alert.alert('Error', 'No se pudo guardar la actividad.');
            }
          }
        }
      ]
    );
  };

  const handleUnmarkAsCompleted = (item: PlanSession) => {
    Alert.alert(
      t('dashboard.unmarkTitle'),
      t('dashboard.unmarkMsg', { activity: item.activityType }),
      [
        { text: t('dashboard.cancel'), style: 'cancel' },
        {
          text: t('dashboard.unmark'),
          style: 'destructive',
          onPress: () => {
            try {
              deleteActivityByDateAndType(item.date!, item.activityType);
              loadEvents(); // Recargar para quitar el check verde
            } catch (err) {
              Alert.alert('Error', 'No se pudo desmarcar la actividad.');
            }
          }
        }
      ]
    );
  };

  if (isLoading) return <LoadingState message="Cargando eventos..." />;
  if (isError) return <ErrorState message="No se pudieron cargar tus eventos. Intenta de nuevo." />;
  if (isGeneratingPlan) {
    const weeksGenerated = Math.floor((generationProgress / 100) * 52);
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 dark:bg-gray-900 px-6">
        <Text className="text-xl text-gray-900 dark:text-white font-bold text-center mb-4">
          {t('dashboard.generating')}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-8">
          {t('dashboard.generatingWait')}
        </Text>

        <View className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden mb-2">
          <View 
            className="bg-indigo-600 h-full rounded-full"
            style={{ width: `${generationProgress}%` }}
          />
        </View>
        <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
          {t('dashboard.weeksGenerated', { current: weeksGenerated })}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12 px-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
      }
    >
      <View className="flex-row justify-between items-center mb-8 pl-2">
        <Text className="text-3xl text-gray-900 dark:text-white font-bold">{t('dashboard.myEvents')}</Text>
        <View className="flex-row items-center">
          <TouchableOpacity 
            className="bg-white dark:bg-gray-800 rounded-full w-10 h-10 items-center justify-center mr-3 border border-gray-200 dark:border-gray-700 shadow-sm"
            onPress={() => navigation.navigate('Profile')}
          >
            <Text className="text-gray-900 dark:text-white text-xl">👤</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="bg-indigo-600 rounded-full w-10 h-10 items-center justify-center shadow-md shadow-indigo-500/30"
            onPress={() => {
              resetEventForm();
              setIsModalVisible(true);
            }}
          >
            <Text className="text-white text-2xl font-bold">+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {events.length === 0 ? (
        <EmptyState message={t('dashboard.noEvents')} />
      ) : (
        <View className="mb-4">
          {events.map((item) => {
            // Calcular días restantes
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const eventDateObj = new Date(item.date + 'T12:00:00Z');
            const diffTime = eventDateObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let daysText = '';
            if (diffDays === 0) daysText = t('dashboard.today');
            else if (diffDays === 1) daysText = t('dashboard.tomorrow');
            else if (diffDays < 0) daysText = t('dashboard.daysAgo', { days: Math.abs(diffDays) });
            else daysText = t('dashboard.daysLeft', { days: diffDays });

            // Formatear fecha ej: 19-04-2024
            const dayNum = String(eventDateObj.getDate()).padStart(2, '0');
            const monthNum = String(eventDateObj.getMonth() + 1).padStart(2, '0');
            const yearNum = eventDateObj.getFullYear();
            const formattedDate = `${dayNum}-${monthNum}-${yearNum}`;

            return (
              <View key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl mb-4 flex-row justify-between items-center border border-gray-200 dark:border-gray-700 shadow-sm">
                <View className="flex-1 mr-4">
                  <Text className="text-gray-900 dark:text-white text-lg font-bold">{item.type}</Text>
                  {item.description ? (
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">{item.description}</Text>
                  ) : null}
                  <View className="flex-row items-center mt-1">
                    <Text className="text-indigo-500 dark:text-indigo-400 font-semibold mr-2">{formattedDate}</Text>
                    <View className={`px-2 py-0.5 rounded-md ${diffDays <= 7 && diffDays >= 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Text className={`text-xs font-bold ${diffDays <= 7 && diffDays >= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {daysText}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <TouchableOpacity onPress={() => handleEditEvent(item)} className="p-2 mr-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                    <Text className="text-indigo-500 text-lg">✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteEvent(item.id!)} className="p-2 bg-red-50 dark:bg-red-900/30 rounded-full">
                    <Text className="text-red-500 text-lg">🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* IA Plan Generator Section */}
      <View className="flex-row justify-between items-center mt-2 mb-4 pl-2">
        <TouchableOpacity 
          className="bg-indigo-600 rounded-xl py-4 items-center shadow-lg shadow-indigo-500/50 flex-1 mr-2"
          onPress={handleGeneratePlan}
        >
          <Text className="text-white font-bold text-lg">{t('dashboard.generatePlan')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-white dark:bg-gray-800 rounded-xl py-4 px-4 items-center border border-gray-200 dark:border-gray-700 shadow-sm"
          onPress={() => setIsPreGenModalVisible(true)}
        >
          <Text className="text-gray-800 dark:text-white font-bold">{t('dashboard.preferences')}</Text>
        </TouchableOpacity>
      </View>

      {/* Render AI Plan Result (Preview only 7 days) */}
      {plan.length > 0 && (
        <View className="mb-8 pl-2">
          <Text className="text-xl text-gray-900 dark:text-white font-bold mb-2">{t('dashboard.currentWeek')}</Text>
          <Text className="text-gray-500 dark:text-gray-400 mb-4 text-sm">{t('dashboard.openCalendarHint')}</Text>
          
          {plan.map((item, index) => {
            // Formatear fecha del plan ej: miércoles-19-04
            const pDate = new Date(item.date!);
            const daysArr = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const dayName = daysArr[pDate.getDay()];
            const dayNum = String(pDate.getDate()).padStart(2, '0');
            const monthNum = String(pDate.getMonth() + 1).padStart(2, '0');
            const formattedPlanDate = `${dayName}-${dayNum}-${monthNum}`;

            const isRest = item.activityType.toLowerCase() === 'rest';
            const isCompleted = completedDates.includes(item.date!);

            return (
              <TouchableOpacity 
                key={item.date!} 
                className={`bg-white dark:bg-gray-800 p-4 rounded-xl mb-4 border shadow-sm ${
                  isCompleted ? 'border-green-200 dark:border-green-900/50 opacity-60' : 
                  'border-indigo-200 dark:border-indigo-900'
                }`}
                onPress={() => {
                  if (!isRest && !isCompleted) {
                    try {
                      navigation.navigate('Tracker', {
                        activityType: item.activityType,
                        requiresGPS: item.requiresGPS,
                        durationMinutes: item.durationMinutes,
                        targetHRZone: item.targetHRZone,
                        coachNotes: item.coachNotes,
                        planDate: item.date
                      });
                    } catch (e) {
                      console.error('Navigation error in Dashboard:', e);
                    }
                  } else if (isCompleted) {
                    handleUnmarkAsCompleted(item);
                  }
                }}
                activeOpacity={isRest || isCompleted ? 1 : 0.7}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center flex-1">
                    {isCompleted && (
                      <View className="bg-green-100 dark:bg-green-900/50 rounded-full w-6 h-6 items-center justify-center mr-2">
                        <Text className="text-green-600 dark:text-green-400 text-xs">✓</Text>
                      </View>
                    )}
                    <Text className={`font-bold text-lg capitalize ${
                      isRest ? 'text-gray-400 dark:text-gray-500' : 
                      isCompleted ? 'text-green-600 dark:text-green-400 line-through' : 
                      'text-gray-900 dark:text-white'
                    }`}>
                      {formattedPlanDate} - {item.activityType}
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center">
                    {item.durationMinutes > 0 && (
                      <Text className={`font-bold ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {item.durationMinutes} min
                      </Text>
                    )}
                  </View>
                </View>
                
                {!isCompleted && item.targetHRZone && (
                  <Text className="text-indigo-500 dark:text-blue-400 font-semibold mb-2">Zona: {item.targetHRZone}</Text>
                )}
                
                {!isCompleted && (
                  <Text className="text-gray-600 dark:text-gray-400 leading-5">{item.coachNotes}</Text>
                )}
                
                {!isRest && !isCompleted && (
                  <View className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex-row justify-between items-center">
                    <TouchableOpacity
                      className="bg-indigo-600/10 dark:bg-indigo-900/30 px-3 py-2 rounded-lg"
                      onPress={() => {
                        try {
                          navigation.navigate('Tracker', {
                            activityType: item.activityType,
                            requiresGPS: item.requiresGPS,
                            durationMinutes: item.durationMinutes,
                            targetHRZone: item.targetHRZone,
                            coachNotes: item.coachNotes,
                            planDate: item.date
                          });
                        } catch (e) {
                          console.error('Navigation error in Dashboard:', e);
                        }
                      }}
                    >
                      <Text className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">{t('dashboard.startTracker')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      className="bg-green-600/10 dark:bg-green-900/30 px-3 py-2 rounded-lg flex-row items-center"
                      onPress={() => handleMarkAsCompleted(item)}
                    >
                      <Text className="text-green-600 dark:text-green-400 font-bold text-sm mr-1">{t('dashboard.manualComplete')}</Text>
                      <Text className="text-green-600 dark:text-green-400 text-sm">✓</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Modal para Añadir Evento */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end bg-black/80"
          >
            <View className="bg-gray-800 p-6 rounded-t-3xl border-t border-gray-700">
              <Text className="text-2xl text-white font-bold mb-6">
                {editingEventId ? t('modals.editEvent') : t('modals.newEvent')}
              </Text>
              
              <Text className="text-gray-400 mb-2">{t('modals.eventType')}</Text>
              <View className="flex-row flex-wrap mb-4">
                {EVENT_OPTIONS.map(type => (
                  <TouchableOpacity 
                    key={type}
                    className={`px-3 py-2 rounded-lg mr-2 mb-2 ${eventType === type ? 'bg-blue-600' : 'bg-gray-700'}`}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEventType(type);
                    }}
                  >
                    <Text className="text-white">{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {eventType === 'Otro' && (
                <View className="mb-4">
                  <Text className="text-gray-400 mb-2">{t('modals.specifyType')}</Text>
                  <TextInput
                    className="bg-gray-700 text-white rounded-lg px-4 py-3"
                    placeholderTextColor="#9ca3af"
                    value={customEventType}
                    onChangeText={setCustomEventType}
                  />
                </View>
              )}

              <Text className="text-gray-400 mb-2">{t('modals.descNotes')}</Text>
              <TextInput
                className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-4"
                placeholderTextColor="#9ca3af"
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={2}
              />

              <Text className="text-gray-400 mb-2">{t('modals.eventDate')}</Text>
              <TouchableOpacity 
                className="bg-gray-700 rounded-lg px-4 py-3 mb-8"
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                }}
              >
                <Text className="text-white">
                  {eventDate.toLocaleDateString(t('locale') || 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <View className="bg-white dark:bg-gray-700 rounded-xl mb-6 overflow-hidden">
                  <DateTimePicker
                    value={eventDate}
                    mode="date"
                    display="spinner"
                    textColor={Platform.OS === 'ios' ? 'white' : undefined}
                    themeVariant="dark"
                    minimumDate={new Date()} // No dejar poner eventos en el pasado
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                      }
                      if (selectedDate) {
                        setEventDate(selectedDate);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity 
                      className="bg-indigo-600 py-3 items-center"
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text className="text-white font-bold">{t('modals.confirmDate')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View className="flex-row justify-between">
                <TouchableOpacity 
                  className="bg-gray-700 py-4 rounded-xl flex-1 mr-2 items-center"
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text className="text-white font-bold">{t('modals.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-blue-600 py-4 rounded-xl flex-1 ml-2 items-center"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleAddOrUpdateEvent();
                  }}
                >
                  <Text className="text-white font-bold">{t('modals.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal para API Key */}
      <Modal visible={isApiKeyModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end bg-black/80"
          >
            <View className="bg-gray-800 p-6 rounded-t-3xl border-t border-gray-700">
              <Text className="text-2xl text-white font-bold mb-4">{t('modals.setupGemini')}</Text>
              <Text className="text-gray-400 mb-6">
                {t('modals.geminiDesc')}
              </Text>

              <TextInput
                className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-8"
                placeholder="API Key..."
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={tempApiKey}
                onChangeText={setTempApiKey}
              />

              <View className="flex-row justify-between">
                <TouchableOpacity 
                  className="bg-gray-700 py-4 rounded-xl flex-1 mr-2 items-center"
                  onPress={() => setIsApiKeyModalVisible(false)}
                >
                  <Text className="text-white font-bold">{t('modals.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-indigo-600 py-4 rounded-xl flex-1 ml-2 items-center"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSaveApiKey();
                  }}
                >
                  <Text className="text-white font-bold">{t('modals.saveKey')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal para Seleccionar Equipamiento y Preferencias */}
      <Modal visible={isPreGenModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => setIsPreGenModalVisible(false)}>
          <View className="flex-1 justify-end bg-black/80">
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="bg-gray-800 p-6 rounded-t-3xl border-t border-gray-700 max-h-[80%]">
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text className="text-2xl text-white font-bold mb-2">{t('modals.aiPrefs')}</Text>
                  <Text className="text-gray-400 mb-6">
                    {t('modals.aiPrefsDesc')}
                  </Text>

                  <Text className="text-white font-bold text-lg mb-2">{t('modals.addNotes')}</Text>
                  <TextInput
                    className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-6"
                    placeholderTextColor="#9ca3af"
                    value={userPreferences}
                    onChangeText={handlePreferencesChange}
                    multiline
                    numberOfLines={3}
                    style={{ textAlignVertical: 'top' }}
                  />

                  <Text className="text-white font-bold text-lg mb-2">{t('modals.runDays')}</Text>
                  <View className="flex-row justify-between mb-4 bg-gray-700 rounded-xl p-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                      <TouchableOpacity
                        key={`run-${num}`}
                        onPress={() => setRunDays(num)}
                        className={`flex-1 py-3 items-center rounded-lg ${runDays === num ? 'bg-indigo-600' : ''}`}
                      >
                        <Text className={`font-bold ${runDays === num ? 'text-white' : 'text-gray-400'}`}>{num}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-white font-bold text-lg mb-2">{t('modals.strDays')}</Text>
                  <View className="flex-row justify-between mb-6 bg-gray-700 rounded-xl p-1">
                    {[0, 1, 2, 3, 4, 5].map(num => (
                      <TouchableOpacity
                        key={`str-${num}`}
                        onPress={() => setStrengthDays(num)}
                        className={`flex-1 py-3 items-center rounded-lg ${strengthDays === num ? 'bg-indigo-600' : ''}`}
                      >
                        <Text className={`font-bold ${strengthDays === num ? 'text-white' : 'text-gray-400'}`}>{num}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-white font-bold text-lg mb-2">{t('modals.indoorEquip')}</Text>
                  <View className="mb-6">
                    {EQUIPMENT_OPTIONS.map((item) => {
                      const isSelected = equipment.includes(item);
                      return (
                        <TouchableOpacity
                          key={item}
                          onPress={() => handleToggleEquipment(item)}
                          className={`flex-row justify-between items-center p-4 mb-2 rounded-xl border ${
                            isSelected ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-700 border-gray-600'
                          }`}
                        >
                          <Text className={`font-bold ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>
                            {item}
                          </Text>
                          {isSelected && <Text className="text-indigo-400 font-bold">✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity 
                    className="bg-indigo-600 py-4 rounded-xl items-center mb-6"
                    onPress={() => setIsPreGenModalVisible(false)}
                  >
                    <Text className="text-white font-bold">{t('modals.saveClose')}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  );
}
