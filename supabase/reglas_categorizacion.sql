-- Reglas de categorización automática: si el concepto/subcategoría de un movimiento
-- nuevo contiene el patrón de texto de una regla, se sugiere su categoría asociada.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

CREATE TABLE IF NOT EXISTS public.reglas_categorizacion (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patron_texto  TEXT NOT NULL,
  categoria_id  UUID REFERENCES public.categorias(id) ON DELETE CASCADE NOT NULL,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patron_texto)
);

ALTER TABLE public.reglas_categorizacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reglas_categorizacion_select" ON public.reglas_categorizacion
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reglas_categorizacion_insert" ON public.reglas_categorizacion
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );
CREATE POLICY "reglas_categorizacion_delete" ON public.reglas_categorizacion
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );
