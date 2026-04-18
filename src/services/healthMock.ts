/**
 * MOCK de Apple Health (HealthKit) / Google Fit.
 * Como la app se va a testear principalmente en Expo Go en esta etapa inicial,
 * no podemos enlazar librerías nativas puras como `react-native-health` sin que la app crashee.
 * Esta clase simulará los datos biométricos.
 */

export interface BiometricData {
  currentHR: number;
  caloriesBurned: number;
}

class HealthServiceMock {
  private isTracking: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private calories: number = 0;

  // Inicia la lectura de datos simulados
  startTracking(onDataUpdate: (data: BiometricData) => void) {
    if (this.isTracking) return;
    this.isTracking = true;
    this.calories = 0;

    this.timer = setInterval(() => {
      // Simular una Frecuencia Cardíaca entre 120 y 160 (Trote ligero/moderado)
      const mockHR = Math.floor(Math.random() * (160 - 120 + 1)) + 120;
      
      // Simular la quema de ~1 caloría por segundo en actividad
      this.calories += Math.random() * 0.5 + 0.5;

      onDataUpdate({
        currentHR: mockHR,
        caloriesBurned: parseFloat(this.calories.toFixed(1))
      });
    }, 2000); // Actualización cada 2 segundos
  }

  stopTracking() {
    this.isTracking = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /*
  // IMPLEMENTACIÓN REAL (Para futuras compilaciones en EAS Build)
  // Requerirá: npm install react-native-health
  
  import AppleHealthKit, { HealthValue, HealthKitPermissions } from 'react-native-health';

  initRealHealthKit() {
    const permissions = {
      permissions: {
        read: [AppleHealthKit.Constants.Permissions.HeartRate],
        write: [],
      },
    } as HealthKitPermissions;

    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        console.log('[ERROR] Cannot grant permissions!');
      }
    });
  }
  */
}

export const healthMock = new HealthServiceMock();
