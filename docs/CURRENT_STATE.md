# Estado Actual del Proyecto

Documento de referencia para retomar el proyecto y cerrar el sprint con una foto fiel del estado real del código.

## Estado real
- La app móvil funciona sobre Expo + TypeScript + SQLite con tema oscuro fijo.
- La navegación está estabilizada con el parche persistente de `react-native-css-interop`.
- La IA ya puede ejecutarse por backend en Firebase Functions para `generatePlan`, `coachChat` y `proactiveCoach`.
- El cliente todavía conserva modo BYOK guardando la key en `expo-secure-store`, pero ya no usa una variable pública `EXPO_PUBLIC_GEMINI_API_KEY`.
- El tracker GPS funciona en primer plano con `expo-location`; no hay tracking robusto en segundo plano todavía.
- El historial ya se ordena de más reciente a más antiguo.
- La app soporta i18n base en cinco idiomas y preferencias de distancia/peso (`km/mi`, `kg/lbs`), aunque aún quedan textos hardcodeados en algunas pantallas.
- La generación del plan ya admite preferencias estructuradas de horario (`AM/PM/ambos según intensidad`), minutos disponibles por bloque `AM/PM`, día de descanso preferido y disponibilidad semanal más flexible.
- Calendario ya permite exportar e importar `.ics`.

## Auditoría del cierre de sprint

### Corregido en esta auditoría
- Se elimina el fallback inseguro de Gemini desde variable pública del cliente; la key local solo se resuelve desde `SecureStore`.
- Se corrige el flujo de Dashboard para no exigir API key si el backend IA ya está configurado.
- Se elimina la dependencia sospechosa `temp_app: file:..` de `functions/package.json`.
- Se añade caché en memoria para la lista de modelos Gemini en Functions y así reducir latencia y llamadas redundantes.

### Riesgos todavía abiertos
- Las Functions siguen siendo públicas: falta autenticación real de usuario y/o App Check.
- El rate limiting del backend es en memoria y por IP; sirve como freno básico, no como protección seria ante abuso.
- `temp_app/` sigue existiendo en el repo como scaffold residual; ya no cuelga de Functions, pero conviene decidir si se archiva o elimina.
- `HistoryScreen` renderiza mapas dentro de una lista simple; con mucho historial puede penalizar memoria y scroll.
- El tracker usa permisos de ubicación en primer plano; para uso tipo Strava con móvil bloqueado hace falta background location + dev build/EAS.
- Parte del Dashboard y algunos mensajes auxiliares siguen con textos fijos en español.

## Arquitectura IA

### Flujo recomendado actual
1. La app llama a Firebase Functions mediante URLs `EXPO_PUBLIC_AI_*`.
2. Functions usa `GEMINI_API_KEY` como secreto de servidor.
3. La respuesta vuelve ya filtrada al cliente.

### Modo alternativo solo para desarrollo
- Si no hay backend configurado, la app puede seguir funcionando con una key guardada manualmente en `SecureStore`.
- Este modo no debe considerarse flujo principal de producto.

## Estado funcional por áreas

### IA y backend
- `generatePlan`, `coachChat` y `proactiveCoach` ya viven en backend.
- Hay manejo de errores públicos más claros y rate limiting básico.
- El prompt de generación ya está alineado con sesiones múltiples por día y diferencia correctamente entre sesiones con GPS y sin GPS.
- El chat IA ya tiene acceso al plan cercano, eventos objetivo, perfil biométrico, último check-in y preferencias activas del atleta.
- Falta endurecer seguridad para producción con Auth/App Check y reglas de consumo por usuario.

### Tracker y actividad
- El tracker registra distancia, ruta, tiempo, calorías y ritmos.
- Se corrigió el cálculo del ritmo medio para evitar usar tiempos desfasados y se filtró parte del ruido del GPS.
- La frecuencia cardiaca sigue mockeada; no hay integración real con Apple Health / Google Fit.

### Producto y UX
- Existen rachas, resumen semanal y race week.
- Hay importación/exportación de calendario.
- Persisten mejoras pendientes en copy y localización completa de pantallas.

## Cómo arrancar
- App móvil:
  - `npx expo start -c`
- Para probar fuera de casa con Expo Go:
  - `npx expo start --tunnel`
- Functions:
  - `npm install --prefix functions`
  - `npm run deploy --prefix functions`

## Prioridades del próximo sprint
- Añadir autenticación real y App Check al backend IA.
- Decidir el destino de `temp_app/`.
- Terminar la limpieza de i18n en pantallas restantes.
- Mejorar rendimiento del historial si crece el volumen de sesiones.
- Evaluar background location y estrategia de builds para salidas reales largas.

## Siguiente fase propuesta: Coach definitivo
- Convertir el coach en un sistema de alto contexto que unifique `generatePlan`, `coachChat` y `proactiveCoach` sobre una misma visión del atleta.
- Crear un `context builder` compartido con perfil, eventos, check-ins, preferencias activas, historial reciente y carga acumulada.
- Endurecer prompts y guardrails para nutrición, suplementos, hidratación, composición corporal y recomendaciones sensibles.
- Mejorar la lógica de modificación del calendario para que cualquier `PLAN_UPDATE` revise siempre semana afectada, objetivos cercanos, fatiga, disponibilidad real y tipo de sesión.
- Evaluar si conviene añadir una capa de planificación intermedia antes de aplicar cambios para acercarse más a un agente IA especializado.

## TODO consolidado

### P0 - API y seguridad
- Añadir autenticación real al backend IA antes de abrirlo a usuarios finales.
- Añadir App Check o una capa equivalente para reducir abuso desde clientes no confiables.
- Sustituir el rate limiting en memoria por una estrategia más robusta por usuario/dispositivo.
- Definir el futuro del modo BYOK: desarrollo solamente o feature avanzada separada.
- Revisar despliegue y observabilidad mínima de Functions: logs útiles, cuotas y alertas.

### P1 - Lógica de producto
- Introducir un `sessionId` real en plan e historial para soportar perfectamente varias sesiones del mismo tipo el mismo día.
- Revisar streaks y resumen semanal una vez exista `sessionId`, para que la adherencia por día/sesión quede totalmente exacta.
- Validar en uso real que las nuevas preferencias (`AM/PM`, tiempo diario, descanso preferido) mejoran el plan y no generan dobles sesiones poco realistas.
- Decidir si el usuario podrá editar también esas preferencias desde perfil además del modal previo a generar.

### P1 - Tracker y datos de actividad
- Implementar background location robusto para salidas largas con móvil bloqueado.
- Definir política de guardado final de actividades cortas según tipo de sesión y uso real.
- Integrar frecuencia cardiaca y actividad real con Apple Health / Google Fit en lugar del mock actual.
- Revisar cómo representar visualmente días con varias sesiones en Dashboard y Calendar cuando haya más volumen de uso.

### P2 - UX e internacionalización
- Terminar la limpieza de textos hardcodeados en español.
- Revisar consistencia de copies, etiquetas y mensajes cortos en los 5 idiomas.
- Mostrar un resumen visible de preferencias de generación en el Dashboard para que el usuario vea con qué reglas va a crear el plan.

### P2 - Deuda técnica
- Decidir si `temp_app/` se elimina, se renombra o se documenta claramente.
- Revisar `HistoryScreen` para evitar problemas de rendimiento con mapas embebidos cuando el historial crezca.
- Valorar una caché y rehidratación de datos más fina para reducir lecturas SQLite repetidas en varias pantallas.

### P3 - Backlog de producto
- Notificaciones locales más inteligentes y sostenibles en el tiempo.
- Resúmenes semanales más ricos y mejor adherencia visual.
- Gamificación más profunda con sentido, no solo streaks.
- Integración real con Health / Fit.
- Widgets.
- Sharing social.
- Soporte más serio para Apple Watch cuando exista estrategia nativa real.
