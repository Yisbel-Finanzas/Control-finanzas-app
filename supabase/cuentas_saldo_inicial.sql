-- Balance real por cuenta: saldo_inicial es el punto de partida sobre el cual se suma
-- el neto de los movimientos vinculados a la cuenta para calcular su balance actual.
-- El balance en sí NUNCA se persiste — se calcula en el cliente (ver Cuentas.jsx).
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.cuentas ADD COLUMN saldo_inicial numeric NOT NULL DEFAULT 0;
