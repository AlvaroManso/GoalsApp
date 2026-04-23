import { getApiKey } from './secureStorage';
import { parseAIResponse } from '../utils/sanitizer';
import { generatePlanViaBackend, hasAiBackend } from './aiBackend';
import i18n from '../i18n';

const SYSTEM_PROMPT = `Actúa como un entrenador de atletismo de élite, fisiólogo y nutricionista. Genera un macrociclo de 52 semanas estructurado en JSON puro.
REGLAS FISIOLÓGICAS INQUEBRANTABLES:
1. Método 80/20: el 80% del volumen de carrera debe ser en Z1/Z2 conversacional. Solo el 20% en Z4/Z5.
2. Fatiga cruzada: nunca programes una tirada larga de carrera el día posterior a una sesión pesada de fuerza o Hyrox.
3. Tapering: si hay un evento prioridad A, reduce el volumen progresivamente un 30-50% en las 2 semanas previas.
4. Nutrición: para sesiones de más de 90 minutos, incluye una nota breve sobre carbohidratos e hidratación.
5. Equipamiento: si el usuario tiene material indoor, úsalo de forma inteligente para recuperación, control de impacto o días de mala climatología.
REGLAS DE ESTRUCTURA:
1. Devuelve estrictamente un array JSON, sin markdown ni texto adicional.
2. Cada objeto representa UNA sesión concreta, no un día completo.
3. Campos obligatorios: 'weekNumber' (1-52), 'dayOfWeek' (1-7, donde 1 = lunes y 7 = domingo), 'activityType', 'durationMinutes', 'targetHRZone', 'coachNotes', 'requiresGPS'.
4. Debe haber cobertura completa de los 364 días del macrociclo: cada combinación weekNumber + dayOfWeek debe aparecer al menos una vez.
5. Si un día tiene doble sesión, devuelve varios objetos consecutivos con el mismo weekNumber y dayOfWeek.
6. Si un día tiene más de una sesión, no uses 'Rest' en ese mismo día.
7. Usa 'Rest' solo en días de descanso completo.
REGLAS DE TRACKER:
1. 'requiresGPS' debe ser true solo si esa sesión necesita medir distancia al aire libre.
2. 'requiresGPS' debe ser false para fuerza, cinta, bici estática, rodillo, piscina, movilidad, recuperación, descanso y trabajo indoor.
3. Si propones doble sesión, intenta que tenga sentido para la app: una principal y otra complementaria, o una GPS y otra sin GPS.
TIPOS RECOMENDADOS:
Run, Trail, Cycling, Treadmill, Strength, Hyrox, Crosstraining, Swimming, Mobility, Recovery, Rest.`;

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
  sessionTimingPreference?: string;
  preferredRestDay?: string;
  amTimeBudget?: string;
  pmTimeBudget?: string;
  onProgress?: (progress: number) => void;
}

const gpsActivities = new Set(['run', 'trail', 'cycling', 'bike outdoor', 'outdoor ride']);

const inferRequiresGPS = (activityType?: string): boolean => {
  return gpsActivities.has((activityType || '').trim().toLowerCase());
};

const normalizeGeneratedPlan = (plan: unknown): PlanSession[] => {
  if (!Array.isArray(plan)) {
    throw new Error('El plan generado no es un array válido.');
  }

  const normalized = plan
    .map((session: any, index) => ({
      weekNumber: Number(session?.weekNumber),
      dayOfWeek: Number(session?.dayOfWeek),
      activityType: typeof session?.activityType === 'string' && session.activityType.trim()
        ? session.activityType.trim()
        : 'Rest',
      durationMinutes: Math.max(0, Math.round(Number(session?.durationMinutes) || 0)),
      targetHRZone: typeof session?.targetHRZone === 'string' ? session.targetHRZone.trim() : '',
      coachNotes: typeof session?.coachNotes === 'string' ? session.coachNotes.trim() : '',
      requiresGPS: typeof session?.requiresGPS === 'boolean'
        ? session.requiresGPS
        : inferRequiresGPS(session?.activityType),
      __index: index,
    }))
    .filter((session) => Number.isFinite(session.weekNumber) && Number.isFinite(session.dayOfWeek))
    .filter((session) => session.weekNumber >= 1 && session.weekNumber <= 52 && session.dayOfWeek >= 1 && session.dayOfWeek <= 7)
    .sort((a, b) => {
      if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.__index - b.__index;
    })
    .map(({ __index, ...session }) => session as PlanSession);

  const uniqueDayCount = new Set(normalized.map((session) => `${session.weekNumber}-${session.dayOfWeek}`)).size;
  if (uniqueDayCount !== 364) {
    throw new Error(`El plan no cubre exactamente los 364 días requeridos. Días detectados: ${uniqueDayCount}.`);
  }

  return normalized;
};

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
        sessionTimingPreference: params.sessionTimingPreference,
        preferredRestDay: params.preferredRestDay,
        amTimeBudget: params.amTimeBudget,
        pmTimeBudget: params.pmTimeBudget,
        language: i18n.language,
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
Eventos próximos en el año: [${eventsList || 'Ninguno'}]. Disponibilidad semanal: ${params.runAvailability} sesiones principales de carrera/nado/bici, ${params.strengthAvailability} de fuerza.
Equipamiento disponible en el sitio: [${params.equipment.length > 0 ? params.equipment.join(', ') : 'Ninguno, solo exterior'}].
${params.userPreferences ? `Preferencias y condiciones del usuario: "${params.userPreferences}"` : ''}
Genera el plan de entrenamiento macrociclo de 52 semanas en JSON.
IMPORTANTE:
- El campo 'coachNotes' DEBE estar escrito en el idioma con código '${i18n.language}'.
- La app diferencia entre sesiones con tracker GPS y sesiones sin GPS.
- Puedes programar doble sesión el mismo día si tiene sentido fisiológico y logístico.
- Si generas doble sesión el mismo día, devuelve varios objetos consecutivos con el mismo weekNumber y dayOfWeek.
- Preferencia de franja horaria: ${params.sessionTimingPreference || 'sin preferencia'}.
- Día de descanso preferido: ${params.preferredRestDay || 'sin preferencia'}.
- Tiempo disponible AM: ${params.amTimeBudget || 'sin especificar'}.
- Tiempo disponible PM: ${params.pmTimeBudget || 'sin especificar'}.
- Si AM o PM es 0 min, evita programar sesiones en esa franja.
- Si ambos bloques tienen poco tiempo, evita dobles sesiones salvo que sea muy justificable.
- No inventes campos extra.`;

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
    const plan = normalizeGeneratedPlan(parseAIResponse(responseText));

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
