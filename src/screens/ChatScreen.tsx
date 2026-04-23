import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { TabScreenProps } from '../types/navigation';
import { getApiKey } from '../services/secureStorage';
import { getAllTrainingPlan, updatePlanSessions } from '../db/trainingPlan';
import { getDB } from '../db/database';
import { getEvents } from '../db/events';
import { getSetting } from '../db/settings';
import { parseAIResponse } from '../utils/sanitizer';
import { coachChatViaBackend, hasAiBackend } from '../services/aiBackend';
import i18n from '../i18n';

type Props = TabScreenProps<'Chat'>;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

const isFutureOrToday = (date: string) => date >= new Date().toISOString().split('T')[0];

const getNextRelevantEvents = (events: Array<{ type: string; priority: string; date: string; description?: string }>) => {
  const upcoming = events.filter((event) => event.date && isFutureOrToday(event.date));
  const nextEvent = upcoming[0] || null;
  const nextMarathon =
    upcoming.find((event) => {
      const normalized = `${event.type} ${event.description || ''}`.toLowerCase();
      return normalized.includes('marat') && !normalized.includes('media marat') && !normalized.includes('half marathon') && !normalized.includes('semi-marathon');
    }) || null;
  const nextHalfMarathon =
    upcoming.find((event) => {
      const normalized = `${event.type} ${event.description || ''}`.toLowerCase();
      return normalized.includes('media marat') || normalized.includes('half marathon') || normalized.includes('semi-marathon');
    }) || null;

  return { upcoming, nextEvent, nextMarathon, nextHalfMarathon };
};

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
      const db = getDB();
      const plan = getAllTrainingPlan();
      // Extract the next 60 days to avoid huge payload, but sufficient for short-term edits
      const todayDate = new Date().toISOString().split('T')[0];
      const futurePlan = plan.filter(p => p.date && p.date >= todayDate).slice(0, 60);
      const events = getEvents();
      const profile = db.getFirstSync<any>('SELECT * FROM UserProfile ORDER BY id DESC LIMIT 1');
      const latestCheckin = db.getFirstSync<any>('SELECT * FROM DailyCheckin ORDER BY date DESC, id DESC LIMIT 1');

      const planContextItems = futurePlan.map(p => ({
        date: p.date,
        activityType: p.activityType,
        durationMinutes: p.durationMinutes,
        targetHRZone: p.targetHRZone,
        coachNotes: p.coachNotes,
        requiresGPS: p.requiresGPS
      }));
      const eventsContext = events.map((event) => ({
        type: event.type,
        priority: event.priority,
        date: event.date,
        description: event.description,
      }));
      const athleteContext = {
        profile: profile ? {
          age: profile.age,
          weight: profile.weight,
          maxHR: profile.maxHR,
          restingHR: profile.restingHR,
          gender: profile.gender,
          fitnessLevel: profile.fitnessLevel,
        } : undefined,
        latestCheckin: latestCheckin ? {
          date: latestCheckin.date,
          fatigue: latestCheckin.fatigue,
          jointPain: latestCheckin.jointPain,
        } : undefined,
        preferences: {
          distanceUnit: getSetting('distanceUnit'),
          weightUnit: getSetting('weightUnit'),
          userPreferences: getSetting('user-preferences'),
          sessionTimingPreference: getSetting('session-timing-preference'),
          preferredRestDay: getSetting('preferred-rest-day'),
          amTimeBudget: getSetting('am-time-budget'),
          pmTimeBudget: getSetting('pm-time-budget'),
        },
      };
      const { upcoming, nextEvent, nextMarathon, nextHalfMarathon } = getNextRelevantEvents(eventsContext);
      console.log('[CoachChat] eventsContext', {
        todayDate,
        message: userText,
        upcoming,
        nextEvent,
        nextMarathon,
        nextHalfMarathon,
      });

      if (hasAiBackend()) {
        const backendResponse = await coachChatViaBackend({
          message: userText,
          language: i18n.language,
          athleteContext,
          eventsContext: upcoming,
          planContext: planContextItems,
        });

        if (backendResponse.type === 'PLAN_UPDATE' && Array.isArray(backendResponse.updates)) {
          updatePlanSessions(backendResponse.updates);
          const newAiMsg: Message = {
            id: Date.now().toString() + 'A',
            text: backendResponse.message + '\n\n✅ ¡Plan actualizado en la base de datos!',
            isUser: false,
          };
          setMessages(prev => [...prev, newAiMsg]);
          setIsTyping(false);
          return;
        }

        const newAiMsg: Message = {
          id: Date.now().toString() + 'A',
          text: backendResponse.message,
          isUser: false,
        };
        setMessages(prev => [...prev, newAiMsg]);
        setIsTyping(false);
        return;
      }

      const apiKey = await getApiKey();
      if (!apiKey) throw new Error('API Key no configurada');

      const planContext = JSON.stringify(planContextItems);
      const eventsContextJson = JSON.stringify(upcoming);
      const athleteContextJson = JSON.stringify(athleteContext);

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
        const systemInstructionText = `Eres un entrenador de atletismo de élite respondiendo a tu atleta en el idioma '${i18n.language}'.
Hoy es ${todayDate}.
Aquí tienes los próximos 60 días de su plan de entrenamiento actual:
---
${planContext}
---
Aquí tienes también sus eventos objetivo configurados:
---
${eventsContextJson}
---
Y aquí tienes su contexto completo de atleta:
---
${athleteContextJson}
---
Próximo evento futuro: ${nextEvent ? `${nextEvent.type} el ${nextEvent.date}` : 'ninguno'}.
Próxima maratón futura: ${nextMarathon ? `${nextMarathon.type} el ${nextMarathon.date}` : 'ninguna'}.
Próxima media maratón futura: ${nextHalfMarathon ? `${nextHalfMarathon.type} el ${nextHalfMarathon.date}` : 'ninguna'}.
IMPORTANTE:
Antes de responder o modificar nada, integra mentalmente plan, eventos y contexto del atleta.
Si el usuario SOLO hace una pregunta, respóndele de forma concisa, útil y muy personalizada.
Si la pregunta afecta a una carrera, objetivo o fecha relevante, usa también el contexto de eventos.
Si la pregunta afecta a carga, recuperación, intensidad, nutrición o cambios de calendario, usa también perfil, preferencias y último check-in.
Si te preguntan por el próximo evento o la próxima media maratón, usa solo fechas que existan en el contexto y prioriza siempre las futuras respecto a hoy.
No inventes fechas ni menciones eventos que no estén en el contexto.
PERO si el usuario PIDE MODIFICAR el plan (ej: "haz que los entrenos de fuerza sean de 5 repeticiones", "reduce la duración del running en agosto"), DEBES DEVOLVER ESTRICTAMENTE un JSON (sin texto adicional ni markdown) con la siguiente estructura:
{
  "type": "PLAN_UPDATE",
  "message": "He modificado tus entrenamientos de fuerza para enfocarnos en 5 repeticiones máximas...",
  "updates": [
    { "date": "2024-07-15", "activityType": "Strength", "durationMinutes": 60, "targetHRZone": "Z4", "coachNotes": "Fuerza 5x5 al fallo", "requiresGPS": false }
  ]
}
REGLAS PARA PLAN_UPDATE:
- Antes de proponer cambios, revisa la semana afectada, los eventos futuros, la fatiga, el dolor articular, el perfil fisiológico y las preferencias del atleta.
- Usa solo fechas exactas existentes en el contexto.
- Mantén coherencia entre 'activityType' y 'requiresGPS'.
- Si un día debe quedar con doble sesión, puedes devolver varias entradas con la misma fecha.
- Para sesiones indoor o complementarias usa requiresGPS=false.
- No añadas markdown ni texto fuera del JSON.
Si no hay modificaciones, devuelve texto plano normal.`;

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
      const friendlyError =
        error instanceof Error
          ? error.message
          : 'Ups, no pude procesar eso ahora mismo. Inténtalo de nuevo en unos segundos.';
      const errorMsg: Message = { id: Date.now().toString() + 'E', text: friendlyError, isUser: false };
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
