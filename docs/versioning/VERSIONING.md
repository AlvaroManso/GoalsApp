# Versioning & Changelog

## [Sprint 01] - Estado actual

### Added
- Integración segura de la API key de Gemini mediante `expo-secure-store` con fallback local a `.env`.
- Parche persistente de `react-native-css-interop` para estabilizar la interacción con React Navigation.
- Recarga de datos en `focus` para la pantalla de Calendario.
- Documento de handoff en `docs/CURRENT_STATE.md` para continuidad entre sesiones.

### Changed
- Consolidación visual en tema oscuro fijo para toda la app.
- Reestructuración de la navegación con un único `NavigationContainer` en la raíz.
- Saneado de tipados de navegación, base de datos e internacionalización.
- Documentación del roadmap de producto en `docs/sprint-01/README.md` y `docs/CURRENT_STATE.md`.

### Fixed
- Error crítico `Couldn't find a navigation context`.
- Bloqueo de botones y tab bar por remounts/interop de estilos.
- Inconsistencias visuales del calendario.
- Exposición previa de la API key en código fuente.

### Product Roadmap
- **Now**: Coach Proactivo, Adherencia / progreso visible, Notificaciones locales inteligentes, Consistencia de datos del perfil / check-in / plan, Reducir fricción de la API key.
- **Next**: Integración real con Health / Fit, Resúmenes semanales, Modo objetivo / race week, Gamificación con sentido.
- **Later**: Widgets, Múltiples goals avanzados, Exportaciones más sofisticadas, Sharing social.
