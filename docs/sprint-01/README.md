# Sprint 01: Inicialización y Core del Proyecto

## Resumen del Sprint
Durante este sprint fundacional, se ha implementado con éxito la base arquitectónica y funcional del "AI Hybrid Athlete Coach". El objetivo principal era establecer el stack tecnológico, el modelo de datos local, la integración con la IA de Google Gemini y las funcionalidades core de seguimiento y recolección de métricas.

## Componentes y Funciones Implementadas

### 1. Arquitectura y Stack Base
- **Inicialización:** Proyecto creado con Expo SDK y TypeScript.
- **UI/UX:** Configuración de `NativeWind` (TailwindCSS) para el manejo global de estilos en "Dark Mode".
- **Almacenamiento:** Integración de `expo-sqlite` para almacenamiento persistente y `expo-secure-store` para salvaguardar credenciales.
- **Navegación:** Implementación de `@react-navigation/native-stack` controlando el flujo inicial basado en el estado de la base de datos (Onboarding -> CheckIn -> Dashboard).

### 2. Fase 1: Perfil Biométrico y Check-in Médico
- `OnboardingScreen`: Captura de edad, peso, FC máxima y FC en reposo.
- `physiology.ts`: Implementación de la fórmula de Karvonen para el cálculo de las 5 zonas de entrenamiento.
- `CheckInScreen`: Interfaz diaria usando Sliders (`@react-native-community/slider`) para medir Fatiga y Dolor Articular.
- **Lógica de Prevención:** Sistema de alertas y bloqueo de impacto basado en los niveles de dolor y fatiga.

### 3. Fase 2: Gestor de Eventos
- CRUD completo en SQLite (`src/db/events.ts`).
- `DashboardScreen`: Interfaz principal con lista de eventos y modal para creación de nuevos eventos.
- Componente nativo de calendario (`@react-native-community/datetimepicker`) para selección fácil y a prueba de errores de la fecha del evento.
- Soporte para múltiples disciplinas deportivas incluyendo opciones personalizadas ("Otro") con campos de descripción.
- Componentes visuales genéricos (`LoadingState`, `ErrorState`, `EmptyState`).

### 4. Fase 3: Motor de IA (Gemini)
- Integración de `@google/generative-ai` usando el modelo `gemini-1.5-pro-latest` con fallback en cascada hasta `1.5-flash` para evitar caídas de la API.
- Generación de un **Macrociclo Anual (52 semanas / 364 días)** basado en eventos y métricas biométricas.
- **Coach IA Chat:** Interfaz de chat (`ChatScreen.tsx`) que inyecta en el prompt de sistema todo el plan de 52 semanas para poder responder a cualquier duda contextual del atleta sobre sus próximos entrenamientos.
- **Sanitizador JSON:** Función robusta con Regex (`src/utils/sanitizer.ts`) para prevenir crashes en el parseo de respuestas de la IA.
- **Prompt Engineering:** Configuración de reglas inquebrantables (Método 80/20, Fatiga Cruzada, Tapering, Nutrición, Equipamiento Indoor).

### 5. Fase 4: Tracker de Entrenamiento e Historial
- `TrackerScreen`: Pantalla de seguimiento en tiempo real con `expo-location`.
- Cálculo dinámico de Distancia (Fórmula Haversine), Ritmo Actual, Ritmo Medio.
- `HealthServiceMock`: Simulación de lecturas de hardware (pulsaciones) asumiendo `0` por defecto si no hay hardware conectado.
- Cálculo de calorías usando fórmula científica (Keytel et al. 2005) combinando peso, edad, tiempo y pulsaciones (o estimación MET).
- **Historial (Strava-like):** Pantalla nueva que lista todos los entrenamientos guardados dibujando un mapa de calor/ruta con `react-native-maps`.

## Lógica Interna y Decisiones Técnicas
- **Seguridad:** La API Key de Gemini se almacena cifrada (`expo-secure-store`). Se implementó un fallback hardcodeado para uso personal del desarrollador.
- **UI/UX Responsive:** Implementación de `ScrollView` y `KeyboardAvoidingView` para evitar roturas de diseño en dispositivos pequeños, además de un `Bottom Tab Navigator` para moverse de forma elegante entre las 4 secciones principales.
- **Prevención de Crashes:** El parser de JSON y las llamadas a la IA están fuertemente protegidas con bloques `try-catch` y estados de UI para feedback al usuario. Se aplicaron migraciones seguras `ALTER TABLE` para evitar corrupción de la DB local durante las actualizaciones.

## Áreas Pendientes y Mejoras Futuras (Sprint 02)
- [ ] Reemplazar `HealthServiceMock` por integraciones reales con Apple Health / Google Fit.
- [ ] Implementar un tracking de localización real en *background* (actualmente solo lee en *foreground* de manera efectiva).
- [ ] Añadir gráficos de progreso y estadísticas globales en el Dashboard.
