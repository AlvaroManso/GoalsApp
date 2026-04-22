import { getApiKey } from './secureStorage';
import { parseAIResponse } from '../utils/sanitizer';
import { generatePlanViaBackend, hasAiBackend } from './aiBackend';

const SYSTEM_PROMPT = `Actúa como un Entrenador de Atletismo de Élite, Fisiólogo y Nutricionista. Genera un macrociclo de entrenamiento para las próximas 52 semanas (1 año completo) estructurado en formato JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: El 80% del volumen de carrera debe ser en Z1/Z2 (Conversacional). Solo el 20% en Z4/Z5 (Series).
2. Fatiga Cruzada: NUNCA programes una Tirada Larga de carrera el día posterior a un entrenamiento pesado de Fuerza o Hyrox.
3. Tapering: Si hay un evento Prioridad A programado, reduce el volumen de entrenamiento un 30-50% progresivamente las 2 semanas previas.
4. Nutrición: Para sesiones de duración > 90 minutos, incluye una nota: 'Ingerir 40-60g CH/hora y 500ml agua con electrolitos/hora'.
5. Equipamiento: Si el usuario indica que dispone de equipamiento de interior (cinta, rodillo/bici, piscina), siéntete libre de programar sesiones específicas usando ese equipo, especialmente útil para recuperación o si la fatiga de impacto es alta.
FORMATO JSON REQUERIDO: Devuelve estrictamente un array de objetos. Estructura para cada día del año: 'weekNumber' (number 1-52), 'dayOfWeek' (number 1-7), 'activityType' (string: Run, Treadmill, Cycling, Strength, Rest, Crosstraining, Swimming), 'durationMinutes' (number), 'targetHRZone' (string), 'coachNotes' (string) y 'requiresGPS' (boolean). El campo 'requiresGPS' debe ser true SÓLO si la actividad requiere medir distancia al aire libre (ej: Run, Cycling). Para entrenamientos indoor (Treadmill, Rodillo, Piscina, Fuerza, Descanso), 'requiresGPS' DEBE SER false para no gastar batería.
Deben ser exactamente 364 objetos (52 semanas * 7 días).`;

export interface PlanSession {
  weekNumber: number;
  dayOfWeek: number;
  date?: string; // Lo calcularemos y asignaremos después
  activityType: string;
  durationMinutes: number;
  targetHRZone: string;
  coachNotes: string;
  requiresGPS?: boolean;
}

interface GeneratePlanParams {
  age: number;
  gender: string;
  restingHR: number;
  fatigue: number;
  jointPain: number;
  events: { type: string; priority: string; date: string }[];
  runAvailability: number;
  strengthAvailability: number;
  equipment: string[];
  userPreferences?: string;
  onProgress?: (progress: number) => void;
}

export const generateWeeklyPlan = async (params: GeneratePlanParams): Promise<PlanSession[]> => {
  try {
    if (hasAiBackend()) {
      if (params.onProgress) params.onProgress(15);
      const plan = await generatePlanViaBackend({
        age: params.age,
        gender: params.gender,
        restingHR: params.restingHR,
        fatigue: params.fatigue,
        jointPain: params.jointPain,
        events: params.events,
        runAvailability: params.runAvailability,
        strengthAvailability: params.strengthAvailability,
        equipment: params.equipment,
        userPreferences: params.userPreferences,
      });
      if (params.onProgress) params.onProgress(100);
      return plan;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('No se ha configurado una API Key de Gemini.');
    }

    const eventsList = params.events.map(e => `${e.type} (Prioridad ${e.priority}) el ${e.date}`).join(', ');

    const dynamicPrompt = `Atleta de ${params.age} años. Género: ${params.gender}. FC Reposo: ${params.restingHR}. Fatiga: ${params.fatigue}/10. Dolor articular: ${params.jointPain}/10.
Eventos próximos en el año: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${params.runAvailability} run, ${params.strengthAvailability} fuerza.
Equipamiento disponible en el sitio: [${params.equipment.length > 0 ? params.equipment.join(', ') : 'Ninguno, solo exterior'}].
${params.userPreferences ? `Preferencias y condiciones del usuario: "${params.userPreferences}"` : ''}
Genera el plan de entrenamiento macrociclo de 52 semanas en JSON.`;

    console.log('Enviando prompt a Gemini:', dynamicPrompt);

    const listModels = async (): Promise<string[]> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`No se pudo listar modelos de Gemini (${message}). Revisa tu API Key y que la Gemini API esté habilitada.`);
      }
      const models: any[] = Array.isArray(json?.models) ? json.models : [];
      const supported = models
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => (typeof m.name === 'string' ? m.name : ''))
        .filter(Boolean)
        .map((name) => name.replace(/^models\//, ''));
      return supported;
    };

    const generateWithModel = async (modelId: string): Promise<string> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: dynamicPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(message);
      }

      const parts = json?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return '';
      return parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('');
    };

    if (params.onProgress) params.onProgress(5);

    const available = await listModels();
    console.log('Modelos Gemini disponibles (generateContent):', available.slice(0, 20));
    const preferredOrder = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',

    ];
    const candidates = preferredOrder.filter((m) => available.includes(m));
    const modelCandidates = candidates.length > 0 ? candidates : available.slice(0, 5);

    let responseText = '';
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        responseText = await generateWithModel(modelName);
        if (params.onProgress) params.onProgress(95);
        console.log(`Gemini model used: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        responseText = '';
        console.warn(`Gemini model failed: ${modelName}`);
      }
    }

    if (!responseText) {
      throw lastError ?? new Error('No se pudo obtener respuesta de ningún modelo Gemini.');
    }
    
    if (params.onProgress) params.onProgress(98); // Parseando
    
    // Parseamos la respuesta usando nuestro sanitizador robusto
    const plan = parseAIResponse(responseText);
    
    if (!Array.isArray(plan)) {
      throw new Error('El plan generado no es un array válido.');
    }

    if (params.onProgress) params.onProgress(100); // Terminado

    return plan;
  } catch (error) {
    console.error('Error generando plan con Gemini:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('No se pudo generar el plan ahora mismo. Inténtalo de nuevo en unos segundos.');
  }
};
