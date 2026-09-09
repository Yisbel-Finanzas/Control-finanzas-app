-- Amplía la política de lectura de `perfiles`: de "solo tu propio perfil" a
-- "cualquier usuario autenticado puede leer todos los perfiles" (nombre, rol, etc).
-- Necesario para mostrar quién registró cada movimiento (trazabilidad multiusuario)
-- y para desglosar aportes por usuario en metas/deudas compartidas.
-- No amplía UPDATE: cada usuario solo puede seguir editando su propio perfil.
--
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

DROP POLICY IF EXISTS "perfiles_select" ON public.perfiles;
CREATE POLICY "perfiles_select" ON public.perfiles FOR SELECT TO authenticated USING (true);
