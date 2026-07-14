-- Tabla principal de cuentas por cobrar (dinero que otras personas deben al usuario)
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_persona              TEXT NOT NULL,
  nota                        TEXT,
  moneda                      TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  monto_original              NUMERIC NOT NULL CHECK (monto_original > 0),
  saldo_pendiente             NUMERIC NOT NULL CHECK (saldo_pendiente >= 0),
  activo                      BOOLEAN DEFAULT TRUE NOT NULL,
  fecha_ultima_actualizacion  DATE,
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden ver cuentas por cobrar"
  ON cuentas_por_cobrar FOR SELECT TO authenticated USING (true);

CREATE POLICY "administradora puede insertar cuentas por cobrar"
  ON cuentas_por_cobrar FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );

CREATE POLICY "administradora puede actualizar cuentas por cobrar"
  ON cuentas_por_cobrar FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );

CREATE POLICY "administradora puede eliminar cuentas por cobrar"
  ON cuentas_por_cobrar FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );

-- Tabla de abonos (cobros recibidos) a cuentas por cobrar
CREATE TABLE IF NOT EXISTS abonos_cxc (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_cobrar_id    UUID REFERENCES cuentas_por_cobrar(id) NOT NULL,
  monto               NUMERIC NOT NULL CHECK (monto > 0),
  moneda              TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  fecha               DATE DEFAULT CURRENT_DATE NOT NULL,
  cuenta_destino_id   UUID REFERENCES cuentas(id),
  categoria_id        UUID REFERENCES categorias(id),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abonos_cxc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden gestionar abonos_cxc"
  ON abonos_cxc FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
