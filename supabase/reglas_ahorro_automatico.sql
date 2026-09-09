-- Reglas de ahorro automático hacia una meta: redondeo de gastos o % de cada ingreso.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

CREATE TABLE IF NOT EXISTS public.reglas_ahorro_automatico (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_id     UUID REFERENCES public.metas_ahorro(id) ON DELETE CASCADE NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('redondeo', 'porcentaje_ingreso')),
  valor       NUMERIC NOT NULL CHECK (valor > 0), -- redondeo: unidad de redondeo (ej. 50, 100); porcentaje_ingreso: % (1-100)
  activa      BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meta_id, tipo) -- una regla de cada tipo por meta
);

ALTER TABLE public.reglas_ahorro_automatico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reglas_ahorro_select" ON public.reglas_ahorro_automatico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reglas_ahorro_insert" ON public.reglas_ahorro_automatico
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reglas_ahorro_update" ON public.reglas_ahorro_automatico
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reglas_ahorro_delete" ON public.reglas_ahorro_automatico
  FOR DELETE TO authenticated USING (true);
