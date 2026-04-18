export const calculateHeartRateZones = (maxHR: number, restingHR: number) => {
  const reserveHR = maxHR - restingHR;

  // Karvonen formula: Target HR = ((Max HR - Resting HR) * %Intensity) + Resting HR
  return {
    Z1: {
      min: Math.round(reserveHR * 0.50 + restingHR),
      max: Math.round(reserveHR * 0.60 + restingHR),
      label: 'Zona 1 (Recuperación - 50-60%)',
    },
    Z2: {
      min: Math.round(reserveHR * 0.60 + restingHR),
      max: Math.round(reserveHR * 0.70 + restingHR),
      label: 'Zona 2 (Resistencia Aeróbica - 60-70%)',
    },
    Z3: {
      min: Math.round(reserveHR * 0.70 + restingHR),
      max: Math.round(reserveHR * 0.80 + restingHR),
      label: 'Zona 3 (Tempo/Umbral Aeróbico - 70-80%)',
    },
    Z4: {
      min: Math.round(reserveHR * 0.80 + restingHR),
      max: Math.round(reserveHR * 0.90 + restingHR),
      label: 'Zona 4 (Umbral Anaeróbico - 80-90%)',
    },
    Z5: {
      min: Math.round(reserveHR * 0.90 + restingHR),
      max: Math.round(reserveHR * 1.00 + restingHR),
      label: 'Zona 5 (VO2 Max/Anaeróbico - 90-100%)',
    },
  };
};

export const checkDailyReadiness = (fatigue: number, jointPain: number) => {
  // Lógica de Bloqueo: Si Dolor > 7, desactivar sesión de impacto
  if (jointPain > 7) {
    return {
      canRun: false,
      message: 'Dolor articular elevado (>7). Se ha bloqueado la sesión de impacto (carrera).',
      suggestion: 'Sugerencia: Realiza crosstraining (bicicleta/natación) o descanso activo.',
    };
  }

  if (fatigue > 8) {
    return {
      canRun: true,
      message: 'Fatiga muy elevada (>8). Considera reducir la intensidad hoy.',
      suggestion: 'Sugerencia: Mantén el entrenamiento en Zona 1 o descansa.',
    };
  }

  return {
    canRun: true,
    message: 'Condición óptima para el entrenamiento programado.',
    suggestion: '',
  };
};
