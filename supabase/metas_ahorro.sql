-- Tabla principal de metas de ahorro
CREATE TABLE IF NOT EXISTS metas_ahorro (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  monto_objetivo  NUMERIC NOT NULL CHECK (monto_objetivo > 0),
  monto_actual    NUMERIC DEFAULT 0 NOT NULL CHECK (monto_actual >= 0),
  moneda          TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  fecha_objetivo  DATE,
  cuenta_id       UUID REFERENCES cuentas(id),
  activo          BOOLEAN DEFAULT TRUE NOT NULL,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE metas_ahorro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden ver metas"
  ON metas_ahorro FOR SELECT TO authenticated USING (true);

CREATE POLICY "usuarios autenticados pueden insertar metas"
  ON metas_ahorro FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "usuarios autenticados pueden actualizar metas"
  ON metas_ahorro FOR UPDATE TO authenticated USING (true);

CREATE POLICY "administradora puede eliminar metas"
  ON metas_ahorro FOR DELETE TO authenticated USING (true);

-- Tabla de abonos a metas
CREATE TABLE IF NOT EXISTS abonos_meta (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_id     UUID REFERENCES metas_ahorro(id) NOT NULL,
  monto       NUMERIC NOT NULL CHECK (monto > 0),
  fecha       DATE DEFAULT CURRENT_DATE NOT NULL,
  nota        TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abonos_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden gestionar abonos_meta"
  ON abonos_meta FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
