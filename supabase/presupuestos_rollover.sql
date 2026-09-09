-- Rollover de presupuesto: permite acumular el sobrante de un mes al límite
-- disponible del mes siguiente, por categoría/moneda.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS rollover_activo BOOLEAN NOT NULL DEFAULT false;
