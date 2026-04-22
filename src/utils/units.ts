export const kmToMi = (km: number): number => {
  return km * 0.621371;
};

export const miToKm = (mi: number): number => {
  return mi / 0.621371;
};

export const kgToLbs = (kg: number): number => {
  return kg * 2.20462;
};

export const lbsToKg = (lbs: number): number => {
  return lbs / 2.20462;
};

export const formatDistance = (km: number, unit: 'km' | 'mi'): string => {
  const dist = unit === 'mi' ? kmToMi(km) : km;
  return dist.toFixed(2);
};

export const formatPace = (paceStr: string, unit: 'km' | 'mi'): string => {
  if (unit === 'km') return paceStr;
  if (!paceStr || paceStr === '0:00' || paceStr === '--:--') return paceStr;
  
  // Pace is in min/km. Need to convert to min/mi.
  // 1 km = 0.621371 miles. So 1 mile = 1.60934 km.
  // Pace in min/mi = Pace in min/km * 1.60934
  const parts = paceStr.split(':');
  if (parts.length !== 2) return paceStr;
  
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  const totalSecondsKm = (mins * 60) + secs;
  
  const totalSecondsMi = totalSecondsKm * 1.60934;
  const outMins = Math.floor(totalSecondsMi / 60);
  const outSecs = Math.floor(totalSecondsMi % 60);
  
  return `${outMins}:${outSecs.toString().padStart(2, '0')}`;
};