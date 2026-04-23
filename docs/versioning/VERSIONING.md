# Versioning & Changelog

## [Sprint 01] - Estado actual

### Added
- Integración de Firebase Functions para `generatePlan`, `coachChat` y `proactiveCoach`.
- Caché en memoria para respuestas del backend en cliente y para descubrimiento de modelos en Functions.
- Parche persistente de `react-native-css-interop` para estabilizar la interacción con React Navigation.
- Recarga de datos en `focus` para la pantalla de Calendario.
- Documento de handoff en `docs/CURRENT_STATE.md` para continuidad entre sesiones.
- Utilidades de gamificación: rachas, resumen semanal y modo objetivo / race week.
- Importación y exportación de calendario `.ics`.
- Preferencias de unidades `km/mi` y `kg/lbs`.
- Preferencias de planificación estructuradas para franja `AM/PM/ambos según intensidad`, tiempo diario disponible y día de descanso preferido.

### Changed
- Consolidación visual en tema oscuro fijo para toda la app.
- Reestructuración de la navegación con un único `NavigationContainer` en la raíz.
- Saneado de tipados de navegación, base de datos e internacionalización.
- Documentación del roadmap de producto en `docs/sprint-01/README.md` y `docs/CURRENT_STATE.md`.
- La app prioriza backend IA mediante `EXPO_PUBLIC_AI_*`; solo usa BYOK local si no hay backend.
- El Dashboard ya no exige API key cuando el backend está configurado.
- El tracker corrige mejor el ritmo medio y filtra mejor el ruido de GPS.
- El historial se ordena de más reciente a más antiguo.
- La IA ya puede generar varias sesiones en un mismo día y el prompt está alineado con sesiones GPS/no-GPS.

### Fixed
- Error crítico `Couldn't find a navigation context`.
- Bloqueo de botones y tab bar por remounts/interop de estilos.
- Inconsistencias visuales del calendario.
- Eliminado el fallback inseguro de Gemini vía variable pública `EXPO_PUBLIC_GEMINI_API_KEY`.
- Eliminada la dependencia sospechosa `temp_app: file:..` en `functions/package.json`.

### Product Roadmap
- **Now**: Auth/App Check para backend IA, cierre de i18n restante, validación outdoor del tracker.
- **Next**: Revisión del coach para subirlo al "coach definitivo", integración real con Health / Fit, notificaciones más robustas, optimización del historial.
- **Later**: Widgets, múltiples goals avanzados, sharing social, experiencia nativa para Apple Watch.
