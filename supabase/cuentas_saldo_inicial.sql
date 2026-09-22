-- Balance real por cuenta: saldo_inicial es el punto de partida sobre el cual se suma
-- el neto de los movimientos vinculados a la cuenta para calcular su balance actual.
-- El balance en sí NUNCA se persiste — se calcula en el cliente (ver Cuentas.jsx).
-- PENDIENTE: aplicar manualmente en el editor SQL de Supabase (proyecto de producción
-- a confirmar). Una vez aplicada, actualizar esta nota para reflejarlo.

ALTER TABLE public.cuentas ADD COLUMN saldo_inicial numeric NOT NULL DEFAULT 0;
