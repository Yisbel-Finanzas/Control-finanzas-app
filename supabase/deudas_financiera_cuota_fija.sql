-- Financieras no bancarias (ej. Finservices): cuota mensual FIJA durante toda la vida del
-- crédito, pactada sobre un número de cuotas establecido. A diferencia de un préstamo bancario,
-- un abono a capital no reduce la cuota (solo acorta el plazo o queda como excedente según la
-- política de la financiera) — por eso se modela aparte del amortizable 'prestamo'.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.deudas DROP CONSTRAINT deudas_tipo_check;
ALTER TABLE public.deudas ADD CONSTRAINT deudas_tipo_check
  CHECK (tipo IN ('prestamo', 'tarjeta_credito', 'financiera_cuota_fija'));

ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS cuota_fija NUMERIC CHECK (cuota_fija > 0);
ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS cuotas_totales INTEGER CHECK (cuotas_totales > 0);

COMMENT ON COLUMN public.deudas.cuota_fija IS 'Solo para tipo financiera_cuota_fija: monto de cuota fijo que no cambia aunque se abone a capital.';
COMMENT ON COLUMN public.deudas.cuotas_totales IS 'Solo para tipo financiera_cuota_fija: número total de cuotas pactadas.';
