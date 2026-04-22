import type { PlanSession } from './geminiService';

const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL?.trim() || '';

type CoachUpdate = {
  date: string;
  activityType?: string;
  durationMinutes?: number;
  targetHRZone?: string;
  coachNotes?: string;
  requiresGPS?: boolean;
};

export type CoachBackendResponse =
  | {
      type: 'PLAN_UPDATE';
      message: string;
      updates: CoachUpdate[];
    }
  | {
      type: 'TEXT';
      message: string;
    };

export const hasAiBackend = () => Boolean(BACKEND_BASE_URL);

const postJson = async <T>(path: string, payload: unknown): Promise<T> => {
  if (!BACKEND_BASE_URL) {
    throw new Error('Backend IA no configurado.');
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || json?.message || `HTTP ${response.status}`);
  }

  return json as T;
};

export const generatePlanViaBackend = async (payload: {
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
}): Promise<PlanSession[]> => {
  const json = await postJson<{ plan: PlanSession[] }>('/generatePlan', payload);
  return Array.isArray(json.plan) ? json.plan : [];
};

export const coachChatViaBackend = async (payload: {
  message: string;
  planContext: Array<{
    date?: string;
    activityType: string;
    durationMinutes: number;
    targetHRZone: string;
    coachNotes: string;
    requiresGPS?: boolean;
  }>;
}): Promise<CoachBackendResponse> => {
  return postJson<CoachBackendResponse>('/coachChat', payload);
};
