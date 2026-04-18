import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './secureStorage';
import { parseAIResponse } from '../utils/sanitizer';

const SYSTEM_PROMPT = `Actúa como un Entrenador de Atletismo de Élite, Fisiólogo y Nutricionista. Genera un plan semanal estructurado en formato JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: El 80% del volumen de carrera debe ser en Z1/Z2 (Conversacional). Solo el 20% en Z4/Z5 (Series).
2. Fatiga Cruzada: NUNCA programes una Tirada Larga de carrera el día posterior a un entrenamiento pesado de Fuerza o Hyrox.
3. Tapering: Si hay un evento Prioridad A en los próximos 14 días, reduce el volumen de entrenamiento un 30-50% progresivamente.
4. Nutrición: Para sesiones de duración > 90 minutos, incluye una nota: 'Ingerir 40-60g CH/hora y 500ml agua con electrolitos/hora'.
5. Equipamiento: Si el usuario indica que dispone de equipamiento de interior (cinta, rodillo/bici, piscina), siéntete libre de programar sesiones específicas usando ese equipo, especialmente útil para recuperación o si la fatiga de impacto es alta.
FORMATO JSON REQUERIDO: Devuelve estrictamente un array de objetos. Estructura: 'dayOfWeek' (number 1-7), 'activityType' (string: Run, Treadmill, Cycling, Strength, Rest, Crosstraining, Swimming), 'durationMinutes' (number), 'targetHRZone' (string) y 'coachNotes' (string).`;

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
  equipment: string[];
}

export const generateWeeklyPlan = async (params: GeneratePlanParams): Promise<PlanSession[]> => {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('No se ha configurado una API Key de Gemini.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const eventsList = params.events.map(e => `${e.type} (Prioridad ${e.priority}) el ${e.date}`).join(', ');

    const dynamicPrompt = `Atleta de ${params.age} años. FC Reposo: ${params.restingHR}. Fatiga: ${params.fatigue}/10. Dolor articular: ${params.jointPain}/10.
Eventos próximos: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${params.runAvailability} run, ${params.strengthAvailability} fuerza.
Equipamiento disponible en el sitio: [${params.equipment.length > 0 ? params.equipment.join(', ') : 'Ninguno, solo exterior'}].
Genera el plan de entrenamiento en JSON.`;

    console.log('Enviando prompt a Gemini:', dynamicPrompt);

    // Cascada de mejor a peor calidad (siempre con fallback para evitar bloqueos por 404).
    const modelCandidates = [
      'gemini-2.5-pro',
      'gemini-1.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    let responseText = '';
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const result = await model.generateContent(dynamicPrompt);
        responseText = result.response.text();
        console.log(`Gemini model used: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model failed: ${modelName}`);
      }
    }

    if (!responseText) {
      throw lastError ?? new Error('No se pudo obtener respuesta de ningún modelo Gemini.');
    }
    
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
