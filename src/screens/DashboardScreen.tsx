import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TabScreenProps } from '../types/navigation';
import { getEvents, addEvent, deleteEvent, AppEvent } from '../db/events';
import { getDB } from '../db/database';
import { LoadingState, ErrorState, EmptyState } from '../components/UIStates';
import { generateWeeklyPlan, PlanSession } from '../services/geminiService';
import { saveApiKey, getApiKey } from '../services/secureStorage';
import { saveTrainingPlan, getAllTrainingPlan } from '../db/trainingPlan';

type Props = TabScreenProps<'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [plan, setPlan] = useState<PlanSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isError, setIsError] = useState(false);
  
  // Modals
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
  const [isPreGenModalVisible, setIsPreGenModalVisible] = useState(false);

  // Form states
  const [eventType, setEventType] = useState('10k');
  const [customEventType, setCustomEventType] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventPriority, setEventPriority] = useState('A');
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState('');

  const EVENT_OPTIONS = ['10k', 'Media Maratón', 'Maratón', 'Triatlón', 'Ciclismo', 'Trail/Montaña', 'Fuerza', 'Hyrox', 'Otro'];
  const EQUIPMENT_OPTIONS = ['Cinta de Correr', 'Rodillo / Bici Estática', 'Piscina Infinita / Estática', 'Pesas / Gimnasio', 'Pista de Atletismo'];

  const loadEvents = () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = getEvents();
      setEvents(data);

      // Cargar plan guardado si existe
      const savedPlan = getAllTrainingPlan();
      if (savedPlan && savedPlan.length > 0) {
        setPlan(savedPlan);
      }
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleAddEvent = () => {
    const finalType = eventType === 'Otro' ? customEventType.trim() : eventType;

    if (!finalType || !eventPriority || !eventDate) {
      Alert.alert('Error', 'Todos los campos obligatorios deben estar completos');
      return;
    }
    try {
      addEvent({ 
        type: finalType, 
        description: eventDescription.trim(), 
        priority: eventPriority, 
        date: eventDate.toISOString().split('T')[0] 
      });
      setIsModalVisible(false);
      
      // Reset forms
      setEventType('10k');
      setCustomEventType('');
      setEventDescription('');
      setEventDate(new Date());
      
      loadEvents();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el evento');
    }
  };

  const handleDeleteEvent = (id: number) => {
    Alert.alert('Eliminar Evento', '¿Estás seguro de que deseas eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
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

  const handleGeneratePlan = async () => {
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
        Alert.alert('Error', 'No se encontró el perfil del usuario.');
        setIsGeneratingPlan(false);
        return;
      }

      const generatedPlan = await generateWeeklyPlan({
        age: profile.age,
        restingHR: profile.restingHR,
        fatigue: checkin ? checkin.fatigue : 5,
        jointPain: checkin ? checkin.jointPain : 1,
        events: events,
        runAvailability: 4, // Harcodeado temporalmente
        strengthAvailability: 2, // Harcodeado temporalmente
        equipment: equipment,
        userPreferences: userPreferences
      });

      saveTrainingPlan(generatedPlan);
      const newPlan = getAllTrainingPlan();
      setPlan(newPlan);
      
      Alert.alert('Éxito', '¡Se ha generado y guardado un macrociclo de 52 semanas! Revisa la pestaña de Calendario.');
    } catch (error: any) {
      console.error('Error in handleGeneratePlan:', error);
      Alert.alert('Error', error.message || 'No se pudo generar el plan con la IA.');
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
      Alert.alert('Éxito', 'API Key guardada correctamente. Ahora puedes generar tu plan.', [
        { text: 'Generar Plan', onPress: handleGeneratePlan }
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

  if (isLoading) return <LoadingState message="Cargando eventos..." />;
  if (isError) return <ErrorState message="No se pudieron cargar tus eventos. Intenta de nuevo." />;
  if (isGeneratingPlan) return <LoadingState message={`🧠 Generando un MACROCICLO completo de 52 SEMANAS...\n(Esto puede tardar hasta 1 minuto)`} />;

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12 px-4">
      <View className="flex-row justify-between items-center mb-8 pl-2">
        <Text className="text-3xl text-gray-900 dark:text-white font-bold">Mis Eventos</Text>
        <View className="flex-row items-center">
          <TouchableOpacity 
            className="bg-white dark:bg-gray-800 rounded-full w-10 h-10 items-center justify-center mr-3 border border-gray-200 dark:border-gray-700 shadow-sm"
            onPress={() => navigation.navigate('Profile')}
          >
            <Text className="text-gray-900 dark:text-white text-xl">👤</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="bg-indigo-600 rounded-full w-10 h-10 items-center justify-center shadow-md shadow-indigo-500/30"
            onPress={() => setIsModalVisible(true)}
          >
            <Text className="text-white text-2xl font-bold">+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {events.length === 0 ? (
        <EmptyState message="No tienes eventos programados. ¡Añade tu primer evento!" />
      ) : (
        <View className="mb-4">
          {events.map((item) => (
            <View key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl mb-4 flex-row justify-between items-center border border-gray-200 dark:border-gray-700 shadow-sm">
              <View className="flex-1 mr-4">
                <Text className="text-gray-900 dark:text-white text-lg font-bold">{item.type}</Text>
                {item.description ? (
                  <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">{item.description}</Text>
                ) : null}
                <Text className="text-indigo-500 dark:text-indigo-400 font-semibold">{item.date}</Text>
              </View>
              <View className="flex-row items-center">
                <View className="bg-indigo-50 dark:bg-gray-700 px-3 py-1 rounded-full mr-4 border border-indigo-100 dark:border-transparent">
                  <Text className="text-indigo-600 dark:text-indigo-400 font-bold">{item.priority}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteEvent(item.id!)}>
                  <Text className="text-red-500 text-lg">🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* IA Plan Generator Section */}
      <View className="flex-row justify-between items-center mt-2 mb-4 pl-2">
        <TouchableOpacity 
          className="bg-indigo-600 rounded-xl py-4 items-center shadow-lg shadow-indigo-500/50 flex-1 mr-2"
          onPress={handleGeneratePlan}
        >
          <Text className="text-white font-bold text-lg">✨ Generar Plan IA</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-white dark:bg-gray-800 rounded-xl py-4 px-4 items-center border border-gray-200 dark:border-gray-700 shadow-sm"
          onPress={() => setIsPreGenModalVisible(true)}
        >
          <Text className="text-gray-800 dark:text-white font-bold">⚙️ Preferencias</Text>
        </TouchableOpacity>
      </View>

      {/* Render AI Plan Result (Preview only 5 days) */}
      {plan.length > 0 && (
        <View className="mb-8 pl-2">
          <Text className="text-xl text-gray-900 dark:text-white font-bold mb-2">Preview Próximos Entrenos</Text>
          <Text className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Abre la pestaña Calendario para ver las 52 semanas.</Text>
          
          {plan.slice(0, 5).map((item, index) => (
            <View key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl mb-4 border border-indigo-200 dark:border-indigo-900 shadow-sm">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-900 dark:text-white font-bold text-lg">{item.date} - {item.activityType}</Text>
                {item.durationMinutes > 0 && (
                  <Text className="text-indigo-600 dark:text-indigo-400 font-bold">{item.durationMinutes} min</Text>
                )}
              </View>
              {item.targetHRZone && (
                <Text className="text-indigo-500 dark:text-blue-400 font-semibold mb-2">Zona: {item.targetHRZone}</Text>
              )}
              <Text className="text-gray-600 dark:text-gray-400">{item.coachNotes}</Text>
            </View>
          ))}
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
              <Text className="text-2xl text-white font-bold mb-6">Nuevo Evento</Text>
              
              <Text className="text-gray-400 mb-2">Tipo de Evento</Text>
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
                  <Text className="text-gray-400 mb-2">Especifica el tipo de evento</Text>
                  <TextInput
                    className="bg-gray-700 text-white rounded-lg px-4 py-3"
                    placeholder="Ej: Ultramaratón 100k"
                    placeholderTextColor="#9ca3af"
                    value={customEventType}
                    onChangeText={setCustomEventType}
                  />
                </View>
              )}

              <Text className="text-gray-400 mb-2">Descripción o notas (Opcional)</Text>
              <TextInput
                className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-4"
                placeholder="Ej: Carrera en pista de tierra, desnivel 200m..."
                placeholderTextColor="#9ca3af"
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={2}
              />

              <Text className="text-gray-400 mb-2">Prioridad</Text>
              <View className="flex-row justify-between mb-6">
                {['A', 'B', 'C'].map(priority => (
                  <TouchableOpacity 
                    key={priority}
                    className={`px-6 py-2 rounded-lg ${eventPriority === priority ? 'bg-blue-600' : 'bg-gray-700'}`}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEventPriority(priority);
                    }}
                  >
                    <Text className="text-white font-bold">{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-gray-400 mb-2">Fecha del Evento</Text>
              <TouchableOpacity 
                className="bg-gray-700 rounded-lg px-4 py-3 mb-8"
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                }}
              >
                <Text className="text-white">
                  {eventDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()} // No dejar poner eventos en el pasado
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setEventDate(selectedDate);
                    }
                  }}
                />
              )}

              <View className="flex-row justify-between">
                <TouchableOpacity 
                  className="bg-gray-700 py-4 rounded-xl flex-1 mr-2 items-center"
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text className="text-white font-bold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-blue-600 py-4 rounded-xl flex-1 ml-2 items-center"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleAddEvent();
                  }}
                >
                  <Text className="text-white font-bold">Guardar</Text>
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
              <Text className="text-2xl text-white font-bold mb-4">Configurar Gemini AI</Text>
              <Text className="text-gray-400 mb-6">
                Para generar tu plan de entrenamiento, necesitamos tu API Key de Google Gemini. 
                Esta clave se guardará de forma encriptada en tu dispositivo.
              </Text>

              <TextInput
                className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-8"
                placeholder="Pega tu API Key aquí..."
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
                  <Text className="text-white font-bold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-indigo-600 py-4 rounded-xl flex-1 ml-2 items-center"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSaveApiKey();
                  }}
                >
                  <Text className="text-white font-bold">Guardar Key</Text>
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
                  <Text className="text-2xl text-white font-bold mb-2">Preferencias IA</Text>
                  <Text className="text-gray-400 mb-6">
                    Ajusta tus preferencias antes de generar el plan.
                  </Text>

                  <Text className="text-white font-bold text-lg mb-2">Anotaciones Adicionales</Text>
                  <TextInput
                    className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-6"
                    placeholder="Ej: En Sevilla hace mucho calor en verano, o prefiero fuerza al fallo 5 repeticiones..."
                    placeholderTextColor="#9ca3af"
                    value={userPreferences}
                    onChangeText={setUserPreferences}
                    multiline
                    numberOfLines={3}
                    style={{ textAlignVertical: 'top' }}
                  />

                  <Text className="text-white font-bold text-lg mb-2">Equipamiento Indoor</Text>
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
                    <Text className="text-white font-bold">Guardar y Cerrar</Text>
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
