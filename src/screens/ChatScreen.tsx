import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { TabScreenProps } from '../types/navigation';
import { getApiKey } from '../services/secureStorage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllTrainingPlan } from '../db/trainingPlan';

type Props = TabScreenProps<'Chat'>;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

export default function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', text: '¡Hola! Soy tu entrenador de IA. Pregúntame sobre tu plan de entrenamiento actual, nutrición, dudas sobre zonas de frecuencia cardíaca o cualquier otra cosa.', isUser: false }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const newUserMsg: Message = { id: Date.now().toString() + 'U', text: userText, isUser: true };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const apiKey = await getApiKey();
      if (!apiKey) throw new Error('API Key no configurada');

      // Preparar contexto del plan (limitado para no reventar el token limit, aunque Gemini soporta mucho)
      // Como el plan puede tener 364 items, lo pasamos al prompt de contexto.
      const plan = getAllTrainingPlan();
      // Solo tomamos un resumen o las próximas semanas para no saturar si es muy grande, 
      // pero Gemini Flash/Pro soportan > 1M tokens, así que podemos enviar todo el JSON.
      const planContext = JSON.stringify(plan.map(p => ({
        d: p.date,
        t: p.activityType,
        m: p.durationMinutes,
        z: p.targetHRZone,
        n: p.coachNotes
      })));

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Usar flash para el chat por velocidad

      const prompt = `
Eres un entrenador de atletismo de élite respondiendo a tu atleta.
Aquí tienes el plan de entrenamiento COMPLETO que le has generado previamente:
---
${planContext}
---
El atleta te pregunta lo siguiente:
"${userText}"
Responde de forma concisa, motivadora y directamente referenciando el plan si la pregunta está relacionada con sus entrenamientos futuros. Usa un tono profesional pero cercano.
`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const newAiMsg: Message = { id: Date.now().toString() + 'A', text: responseText, isUser: false };
      setMessages(prev => [...prev, newAiMsg]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = { id: Date.now().toString() + 'E', text: 'Ups, no pude procesar eso. Revisa tu conexión o tu API Key.', isUser: false };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-900 pt-12"
    >
      <View className="px-4 pb-4 border-b border-gray-800">
        <Text className="text-3xl text-white font-bold">Coach IA</Text>
        <Text className="text-indigo-400">Contexto completo de tu plan activado ✓</Text>
      </View>

      <ScrollView 
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {messages.map(msg => (
          <View 
            key={msg.id} 
            className={`mb-4 max-w-[85%] rounded-2xl p-4 ${
              msg.isUser 
                ? 'bg-blue-600 self-end rounded-tr-sm' 
                : 'bg-gray-800 border border-gray-700 self-start rounded-tl-sm'
            }`}
          >
            <Text className="text-white text-base leading-6">{msg.text}</Text>
          </View>
        ))}
        {isTyping && (
          <View className="bg-gray-800 border border-gray-700 self-start p-4 rounded-2xl rounded-tl-sm mb-4">
            <ActivityIndicator size="small" color="#818cf8" />
          </View>
        )}
      </ScrollView>

      <View className="p-4 bg-gray-800 border-t border-gray-700 flex-row items-center">
        <TextInput
          className="flex-1 bg-gray-900 text-white rounded-full px-4 py-3 mr-3 border border-gray-700"
          placeholder="Pregúntame sobre tus entrenamientos..."
          placeholderTextColor="#6b7280"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity 
          className="bg-indigo-600 w-12 h-12 rounded-full items-center justify-center"
          onPress={handleSend}
          disabled={isTyping}
        >
          <Text className="text-white font-bold text-lg">↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
