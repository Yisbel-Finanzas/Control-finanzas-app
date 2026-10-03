-- Transferencias entre cuentas propias (ej. Popular -> BHD). No son ingreso ni gasto real —
-- no deben contar en Resumen/Presupuesto, solo mover el balance de una cuenta a otra. Por eso
-- viven en su propia tabla en vez de en movimientos (igual que abonos_deuda/abonos_meta).
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

CREATE TABLE IF NOT EXISTS public.transferencias (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_origen_id  UUID REFERENCES public.cuentas(id) NOT NULL,
  cuenta_destino_id UUID REFERENCES public.cuentas(id) NOT NULL,
  monto             NUMERIC NOT NULL CHECK (monto > 0),
  moneda            TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  fecha             DATE DEFAULT CURRENT_DATE NOT NULL,
  concepto          TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CHECK (cuenta_origen_id <> cuenta_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON public.transferencias (cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.transferencias (cuenta_destino_id);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

-- Igual que abonos_deuda/abonos_meta: cualquier autenticado puede registrar y ver transferencias.
CREATE POLICY "transferencias_all" ON public.transferencias
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
