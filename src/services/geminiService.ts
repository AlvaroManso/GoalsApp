import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './secureStorage';
import { parseAIResponse } from '../utils/sanitizer';

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
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('No se ha configurado una API Key de Gemini.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const eventsList = params.events.map(e => `${e.type} (Prioridad ${e.priority}) el ${e.date}`).join(', ');

    const dynamicPrompt = `Atleta de ${params.age} años. Género: ${params.gender}. FC Reposo: ${params.restingHR}. Fatiga: ${params.fatigue}/10. Dolor articular: ${params.jointPain}/10.
Eventos próximos en el año: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${params.runAvailability} run, ${params.strengthAvailability} fuerza.
Equipamiento disponible en el sitio: [${params.equipment.length > 0 ? params.equipment.join(', ') : 'Ninguno, solo exterior'}].
${params.userPreferences ? `Preferencias y condiciones del usuario: "${params.userPreferences}"` : ''}
Genera el plan de entrenamiento macrociclo de 52 semanas en JSON.`;

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

    // Iniciar progreso
    if (params.onProgress) params.onProgress(5); // Simulamos un 5% al enviar la petición

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        // Usamos streaming para poder capturar progreso
        const resultStream = await model.generateContentStream(dynamicPrompt);
        
        let chunkCount = 0;
        const totalEstimatedChunks = 40; // Aproximadamente 40 chunks para 364 objetos JSON, varía según el modelo

        for await (const chunk of resultStream) {
          responseText += chunk.text();
          chunkCount++;
          
          if (params.onProgress) {
            // Simulamos el progreso hasta un 95% basado en chunks. 
            // 5% inicial + (hasta 90% del streaming) = 95% máximo antes del parseo final.
            const progress = Math.min(95, 5 + Math.floor((chunkCount / totalEstimatedChunks) * 90));
            params.onProgress(progress);
          }
        }
        
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
    throw error;
  }
};
