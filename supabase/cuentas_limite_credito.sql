-- Límite de crédito de referencia, solo relevante para cuentas con producto = 'Tarjeta de
-- crédito'. El balance disponible ya se calcula en el cliente (saldo_inicial + ingresos -
-- gastos +/- transferencias); este campo solo sirve para mostrar "disponible de X límite" con
-- una barra de progreso, igual que el patrón ya usado en deudas (limite_o_monto_original).
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS limite_credito NUMERIC CHECK (limite_credito > 0);
