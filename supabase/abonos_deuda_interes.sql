-- Permite registrar la cuota completa (capital + interés) de un préstamo bancario. `monto` sigue
-- siendo el total pagado (lo que realmente salió de la cuenta); `interes` es la porción de ese
-- monto que fue interés. El saldo de la deuda solo debe reducirse por (monto - interes).
-- Para abonos puramente a capital (pago extra fuera de la cuota regular), interes queda en 0 —
-- comportamiento idéntico al que ya existía antes de este cambio.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.abonos_deuda ADD COLUMN IF NOT EXISTS interes NUMERIC DEFAULT 0 CHECK (interes >= 0);
