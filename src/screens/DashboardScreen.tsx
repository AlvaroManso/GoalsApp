import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, Modal, TextInput } from 'react-native';
import { RootStackScreenProps } from '../types/navigation';
import { getEvents, addEvent, deleteEvent, AppEvent } from '../db/events';
import { LoadingState, ErrorState, EmptyState } from '../components/UIStates';

type Props = RootStackScreenProps<'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Form states
  const [eventType, setEventType] = useState('10k');
  const [eventPriority, setEventPriority] = useState('A');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);

  const loadEvents = () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = getEvents();
      setEvents(data);
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
    if (!eventType || !eventPriority || !eventDate) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }
    try {
      addEvent({ type: eventType, priority: eventPriority, date: eventDate });
      setIsModalVisible(false);
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

  if (isLoading) return <LoadingState message="Cargando eventos..." />;
  if (isError) return <ErrorState message="No se pudieron cargar tus eventos. Intenta de nuevo." />;

  return (
    <View className="flex-1 bg-gray-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <Text className="text-3xl text-white font-bold">Mis Eventos</Text>
        <TouchableOpacity 
          className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center"
          onPress={() => setIsModalVisible(true)}
        >
          <Text className="text-white text-2xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      {events.length === 0 ? (
        <EmptyState message="No tienes eventos programados. ¡Añade tu primer evento!" />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={({ item }) => (
            <View className="bg-gray-800 p-4 rounded-xl mb-4 flex-row justify-between items-center border border-gray-700">
              <View>
                <Text className="text-white text-lg font-bold">{item.type}</Text>
                <Text className="text-gray-400">{item.date}</Text>
              </View>
              <View className="flex-row items-center">
                <View className="bg-gray-700 px-3 py-1 rounded-full mr-4">
                  <Text className="text-blue-400 font-bold">Prioridad {item.priority}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteEvent(item.id!)}>
                  <Text className="text-red-500 text-lg">🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal para Añadir Evento */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/80">
          <View className="bg-gray-800 p-6 rounded-t-3xl border-t border-gray-700">
            <Text className="text-2xl text-white font-bold mb-6">Nuevo Evento</Text>
            
            <Text className="text-gray-400 mb-2">Tipo de Evento</Text>
            <View className="flex-row justify-between mb-4">
              {['10k', 'Maratón', 'Fuerza', 'Hyrox'].map(type => (
                <TouchableOpacity 
                  key={type}
                  className={`px-3 py-2 rounded-lg ${eventType === type ? 'bg-blue-600' : 'bg-gray-700'}`}
                  onPress={() => setEventType(type)}
                >
                  <Text className="text-white">{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-400 mb-2">Prioridad</Text>
            <View className="flex-row justify-between mb-6">
              {['A', 'B', 'C'].map(priority => (
                <TouchableOpacity 
                  key={priority}
                  className={`px-6 py-2 rounded-lg ${eventPriority === priority ? 'bg-blue-600' : 'bg-gray-700'}`}
                  onPress={() => setEventPriority(priority)}
                >
                  <Text className="text-white font-bold">{priority}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-400 mb-2">Fecha (YYYY-MM-DD)</Text>
            <TextInput
              className="bg-gray-700 text-white rounded-lg px-4 py-3 mb-8"
              placeholder="2026-10-15"
              placeholderTextColor="#9ca3af"
              value={eventDate}
              onChangeText={setEventDate}
            />

            <View className="flex-row justify-between">
              <TouchableOpacity 
                className="bg-gray-700 py-4 rounded-xl flex-1 mr-2 items-center"
                onPress={() => setIsModalVisible(false)}
              >
                <Text className="text-white font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-blue-600 py-4 rounded-xl flex-1 ml-2 items-center"
                onPress={handleAddEvent}
              >
                <Text className="text-white font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
