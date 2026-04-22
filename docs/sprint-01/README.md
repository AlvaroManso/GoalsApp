# Sprint 01: Setup, MVP & Refinements

## 🎯 Objetivos del Sprint
- Inicializar el proyecto con Expo, TypeScript, y NativeWind.
- Configurar persistencia local con SQLite.
- Implementar la arquitectura y las 4 fases principales del MVP (Onboarding, CRUD Eventos, Gemini AI, GPS Tracker).
- Refinar la interfaz, consolidar un tema oscuro fijo, estabilizar la navegación y mejorar la IA para que pueda modificar el plan.

## 🚀 Funcionalidades Implementadas

### 1. Arquitectura y Base de Datos
- **SQLite (`src/db/database.ts`)**: Migraciones dinámicas con bloque try/catch. Tablas para `UserProfile`, `DailyCheckin`, `Events`, `TrainingPlan`, `ActivityHistory` y `AppSettings`.
- **Navegación (`App.tsx`, `AppNavigator.tsx`)**: Se estabiliza la jerarquía con un único `NavigationContainer` en la raíz, `GestureHandlerRootView` y stack/tabs sin contenedores anidados.
- **Compatibilidad NativeWind**: Se mantiene un parche persistente con `patch-package` sobre `react-native-css-interop` para evitar remounts y errores de interacción con React Navigation.

### 2. Fase 1: Perfil y Check-In
- **Onboarding (`OnboardingScreen.tsx`)**: Recopila peso, altura, edad, nivel y FC en reposo.
- **Check-In (`CheckInScreen.tsx`)**: Slider para fatiga, dolor articular y calidad de sueño, ajustado al tema oscuro fijo de la app.
- **Perfil (`ProfileScreen.tsx`)**: Pantalla accesible desde el menú superior para editar métricas biométricas y cambiar idioma. Se elimina el selector de tema para evitar estados visuales inconsistentes.

### 3. Fase 2: Creador de Eventos
- **Dashboard (`DashboardScreen.tsx`)**: Interfaz principal para añadir eventos (con selector nativo de fecha `DateTimePicker`). Permite eventos de carrera, ciclismo, triatlón y "Otro".

### 4. Fase 3: Motor IA (Google Gemini)
- **Generación de Macrociclo**: Se envían datos de fatiga, eventos y preferencias del usuario para generar un plan estructurado en JSON de 52 semanas.
- **Preferencias Pre-generación**: Se permite al usuario indicar el equipamiento indoor del que dispone y escribir texto libre (Ej: "En agosto hace calor en Sevilla, adapta los entrenos").
- **Coach IA y Modificación de Plan (`ChatScreen.tsx`)**: Un chatbot que no solo responde preguntas leyendo las próximas 60 sesiones del plan, sino que además tiene la capacidad de emitir un JSON especial (`PLAN_UPDATE`) que la app interpreta para sobreescribir la base de datos (Ej: "Cambia todos los entrenamientos de fuerza a 5 repeticiones").
- **Seguridad de API Key**: La clave de Gemini deja de estar hardcodeada y se resuelve desde `expo-secure-store` con fallback a `.env` local, evitando filtraciones accidentales al publicar el repositorio.

### 5. Fase 4: Tracker y Fisiología
- **Tracker GPS y Multipropósito (`TrackerScreen.tsx`)**: Mide distancia, ritmo medio, ritmo actual, tiempo y dibuja la ruta usando `expo-location`. Ahora se adapta al tipo de actividad: si es de Fuerza o Descanso, se oculta la distancia y el ritmo, mostrando solo un gran cronómetro central.
- **Fórmulas Médicas**: Cálculos realistas de gasto calórico basados en Keytel et al. (2005).
- **Historial (`HistoryScreen.tsx`)**: Lista de entrenamientos guardados con un mini-mapa tipo Strava usando `react-native-maps`.

### 6. Refinamientos de UI/UX
- **Tema Oscuro Fijo**: Se unifica la experiencia visual en modo oscuro estable para evitar inconsistencias y eliminar cambios dinámicos de tema que interferían con la navegación.
- **Gestión de Entrenos Semanales**: El Dashboard muestra ahora los **7 días** de la semana. Los entrenamientos tienen un indicador visual (✓) y se atenúan al completarlos. 
- **Navegación Fluida**: Tocar un entrenamiento no completado en el Dashboard o el Calendario abre directamente el Tracker pre-configurado para esa actividad. El calendario vuelve a recargar datos en `focus` para reflejar cambios hechos desde Dashboard, Chat o Tracker.
- **Tracker Inteligente (requiresGPS)**: La IA determina si una actividad necesita GPS o no. El Tracker adapta su interfaz dinámicamente, ocultando la distancia y los ritmos para actividades indoor o de fuerza, y ahorrando batería al no solicitar ubicación.

## 🔧 Tecnologías Usadas
- **React Native (Expo)**
- **NativeWind (Tailwind CSS)**
- **Google Gemini API**
- **Expo SQLite**
- **Expo Location**
- **React Native Maps**

## 📋 Pendiente / Próximos Pasos
- Sincronización real con Apple HealthKit/Google Fit para FC en vivo (actualmente se usa un Mock).
- Exportación del plan de entrenamiento a .ics (Calendario del móvil).
- Documentar formalmente la arquitectura en `docs/architecture/keizai_architecture.md` para alinear el desarrollo con las reglas del proyecto.
