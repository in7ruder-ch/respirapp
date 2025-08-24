# Seguridad y datos

- **Autenticación**: Supabase Auth.
- **Almacenamiento**: bucket `media` (audio/video) en Supabase Storage.
- **Reglas**:
  - Base de datos con **RLS** por usuario.
  - Storage: operaciones sensibles firmadas con **Service Role** desde API.
- **Privacidad**: ver [Política de Privacidad](legal/privacidad.md).
