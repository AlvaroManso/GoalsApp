import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './secureStorage';
import { parseAIResponse } from '../utils/sanitizer';

const SYSTEM_PROMPT = `Actúa como un Entrenador de Atletismo de Élite, Fisiólogo y Nutricionista. Genera un plan semanal estructurado en formato JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: El 80% del volumen de carrera debe ser en Z1/Z2 (Conversacional). Solo el 20% en Z4/Z5 (Series).
2. Fatiga Cruzada: NUNCA programes una Tirada Larga de carrera el día posterior a un entrenamiento pesado de Fuerza o Hyrox.
3. Tapering: Si hay un evento Prioridad A en los próximos 14 días, reduce el volumen de entrenamiento un 30-50% progresivamente.
4. Nutrición: Para sesiones de duración > 90 minutos, incluye una nota: 'Ingerir 40-60g CH/hora y 500ml agua con electrolitos/hora'.
FORMATO JSON REQUERIDO: Devuelve estrictamente un array de objetos. Estructura: 'dayOfWeek' (number 1-7), 'activityType' (string: Run, Strength, Rest, Crosstraining), 'durationMinutes' (number), 'targetHRZone' (string) y 'coachNotes' (string).`;

export interface PlanSession {
  dayOfWeek: number;
  activityType: string;
  durationMinutes: number;
  targetHRZone: string;
  coachNotes: string;
}

interface GeneratePlanParams {
  age: number;
  restingHR: number;
  fatigue: number;
  jointPain: number;
  events: { type: string; priority: string; date: string }[];
  runAvailability: number;
  strengthAvailability: number;
}

export const generateWeeklyPlan = async (params: GeneratePlanParams): Promise<PlanSession[]> => {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('No se ha configurado una API Key de Gemini.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro-latest', // Cambiado a 1.5-pro-latest que es más estable en esta versión
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const eventsList = params.events.map(e => `${e.type} (Prioridad ${e.priority}) el ${e.date}`).join(', ');

    const dynamicPrompt = `Atleta de ${params.age} años. FC Reposo: ${params.restingHR}. Fatiga: ${params.fatigue}/10. Dolor articular: ${params.jointPain}/10.
Eventos próximos: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${params.runAvailability} run, ${params.strengthAvailability} fuerza.
Genera el plan de entrenamiento en JSON.`;

    console.log('Enviando prompt a Gemini:', dynamicPrompt);

    const result = await model.generateContent(dynamicPrompt);
    const responseText = result.response.text();
    
    // Parseamos la respuesta usando nuestro sanitizador robusto
    const plan = parseAIResponse(responseText);
    
    if (!Array.isArray(plan)) {
      throw new Error('El plan generado no es un array válido.');
    }

    return plan;
  } catch (error) {
    console.error('Error generando plan con Gemini:', error);
    throw error;
  }
};
