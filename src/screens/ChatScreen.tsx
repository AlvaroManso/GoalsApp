import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { TabScreenProps } from '../types/navigation';
import { getApiKey } from '../services/secureStorage';
import { getAllTrainingPlan, updatePlanSessions } from '../db/trainingPlan';
import { parseAIResponse } from '../utils/sanitizer';

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

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const newUserMsg: Message = { id: Date.now().toString() + 'U', text: userText, isUser: true };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setTimeout(() => {
      inputRef.current?.clear(); // Force clear on the native component safely
    }, 10);
    setIsTyping(true);

    try {
      const apiKey = await getApiKey();
      if (!apiKey) throw new Error('API Key no configurada');

      const plan = getAllTrainingPlan();
      // Extract the next 60 days to avoid huge payload, but sufficient for short-term edits
      const todayDate = new Date().toISOString().split('T')[0];
      const futurePlan = plan.filter(p => p.date && p.date >= todayDate).slice(0, 60);

      const planContext = JSON.stringify(futurePlan.map(p => ({
        date: p.date,
        activityType: p.activityType,
        durationMinutes: p.durationMinutes,
        targetHRZone: p.targetHRZone,
        coachNotes: p.coachNotes,
        requiresGPS: p.requiresGPS
      })));

      const listModels = async (): Promise<string[]> => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error('No se pudo listar modelos de Gemini.');
        }
        const models: any[] = Array.isArray(json?.models) ? json.models : [];
        return models
          .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m) => (typeof m.name === 'string' ? m.name : ''))
          .filter(Boolean)
          .map((name) => name.replace(/^models\//, ''));
      };

      const available = await listModels();
      const preferredOrder = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
      ];
      const candidates = preferredOrder.filter((m) => available.includes(m));
      const modelToUse = candidates.length > 0 ? candidates[0] : (available[0] || 'gemini-1.5-flash');

      const generateWithModel = async (modelId: string, promptText: string): Promise<string> => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const systemInstructionText = `Eres un entrenador de atletismo de élite respondiendo a tu atleta.
Aquí tienes los próximos 60 días de su plan de entrenamiento actual:
---
${planContext}
---
IMPORTANTE:
Si el usuario SOLO hace una pregunta, respóndele de forma concisa y motivadora referenciando su plan.
PERO si el usuario PIDE MODIFICAR el plan (ej: "haz que los entrenos de fuerza sean de 5 repeticiones", "reduce la duración del running en agosto"), DEBES DEVOLVER ESTRICTAMENTE un JSON (sin texto adicional ni markdown) con la siguiente estructura:
{
  "type": "PLAN_UPDATE",
  "message": "He modificado tus entrenamientos de fuerza para enfocarnos en 5 repeticiones máximas...",
  "updates": [
    { "date": "2024-07-15", "activityType": "Strength", "durationMinutes": 60, "targetHRZone": "Z4", "coachNotes": "Fuerza 5x5 al fallo", "requiresGPS": false }
  ]
}
Recuerda añadir siempre "requiresGPS": false para entrenamientos que no requieran medir distancia con GPS al aire libre (ej. Fuerza, Descanso, Piscina, Rodillo).
Devuelve el JSON solo con las fechas (date) exactas que quieres actualizar que coincidan con las fechas del contexto. Si no hay modificaciones, devuelve texto plano normal.`;

        const body = {
          systemInstruction: {
            parts: [{ text: systemInstructionText }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        }

        const parts = json?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return '';
        return parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('');
      };

      const responseText = await generateWithModel(modelToUse, userText);

      try {
        // Intentar parsear como JSON si el modelo decidió actualizar el plan
        const jsonResponse = parseAIResponse(responseText);
        
        if (jsonResponse && jsonResponse.type === 'PLAN_UPDATE' && Array.isArray(jsonResponse.updates)) {
          updatePlanSessions(jsonResponse.updates);
          
          const newAiMsg: Message = { 
            id: Date.now().toString() + 'A', 
            text: jsonResponse.message + '\n\n✅ ¡Plan actualizado en la base de datos!', 
            isUser: false 
          };
          setMessages(prev => [...prev, newAiMsg]);
          setIsTyping(false);
          return;
        }
      } catch (e) {
        // No es un JSON o falló el parseo, lo tratamos como texto normal
      }

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
      className="flex-1 bg-gray-50 dark:bg-gray-900 pt-12"
    >
      <View className="px-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <Text className="text-3xl text-gray-900 dark:text-white font-bold">Coach IA</Text>
        <Text className="text-indigo-600 dark:text-indigo-400">Contexto completo de tu plan activado ✓</Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            className={`mb-4 max-w-[85%] rounded-2xl p-4 flex-shrink ${
              msg.isUser
                ? 'bg-indigo-600 self-end shadow-sm'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 self-start shadow-sm'
            }`}
          >
            <Text className={`${msg.isUser ? 'text-white' : 'text-gray-900 dark:text-white'} text-base leading-6`}>{msg.text}</Text>
          </View>
        ))}
        {isTyping && (
          <View className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 self-start p-4 rounded-2xl rounded-tl-sm mb-4 shadow-sm">
            <ActivityIndicator size="small" color="#4f46e5" />
          </View>
        )}
      </ScrollView>

      <View className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-row items-end">
        <TextInput
          ref={inputRef}
          className="flex-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-3xl px-4 py-3 mr-3 border border-gray-200 dark:border-gray-700 min-h-[48px] max-h-32"
          placeholder="Pregúntame sobre tus entrenamientos..."
          placeholderTextColor="#9ca3af"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity 
          className="bg-indigo-600 w-12 h-12 rounded-full items-center justify-center shadow-sm mb-0.5"
          onPress={handleSend}
          disabled={isTyping}
        >
          <Text className="text-white font-bold text-lg">↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
