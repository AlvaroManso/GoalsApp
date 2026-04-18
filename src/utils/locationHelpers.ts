import * as Location from 'expo-location';

// Helper para calcular la distancia en kilómetros entre dos coordenadas GPS
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Retorna km
};

// Formatea el tiempo en MM:SS o HH:MM:SS
export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Calcula el ritmo en minutos/km y lo devuelve en formato String (Ej: "5:30")
export const calculatePace = (distanceKm: number, timeSeconds: number): string => {
  if (distanceKm === 0 || timeSeconds === 0) return "0:00";
  
  const timeMinutes = timeSeconds / 60;
  const pace = timeMinutes / distanceKm; // min/km
  
  const paceMinutes = Math.floor(pace);
  const paceSeconds = Math.round((pace - paceMinutes) * 60);
  
  // Limitar el ritmo si el usuario recién arranca y el cálculo da infinito o muy alto
  if (paceMinutes > 20) return "--:--"; 

  return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
};
