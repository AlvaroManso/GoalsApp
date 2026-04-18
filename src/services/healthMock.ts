/**
 * MOCK de Apple Health (HealthKit) / Google Fit.
 * Como la app se va a testear principalmente en Expo Go en esta etapa inicial,
 * no podemos enlazar librerías nativas puras como `react-native-health` sin que la app crashee.
 * Esta clase simulará los datos biométricos.
 */

export interface BiometricData {
  currentHR: number;
}

class HealthServiceMock {
  private isTracking: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  // Inicia la lectura de datos
  startTracking(onDataUpdate: (data: BiometricData) => void) {
    if (this.isTracking) return;
    this.isTracking = true;

    this.timer = setInterval(() => {
      // Como solicitaste, no falseamos los datos. Si no hay un reloj conectado (real), devolvemos 0.
      // Cuando se integre react-native-health real, aquí vendrán las pulsaciones verdaderas.
      onDataUpdate({
        currentHR: 0,
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
