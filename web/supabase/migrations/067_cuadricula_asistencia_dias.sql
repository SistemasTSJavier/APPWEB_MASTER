-- Tabla normalizada de asistencia (un día calendario por empleado/planta/semana).
-- Dual-write: cuadricula_asistencia.payload sigue siendo el snapshot de captura;
-- esta tabla alimenta reportes y consultas SQL.

CREATE TABLE IF NOT EXISTS public.cuadricula_asistencia_dias (
  week_start_iso date NOT NULL,
  scope_key text NOT NULL,
  employee_no text NOT NULL,
  fecha date NOT NULL,
  codigo_d text NOT NULL DEFAULT '',
  codigo_t text NOT NULL DEFAULT '',
  codigo_n text NOT NULL DEFAULT '',
  nombre text,
  servicio text,
  planta text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start_iso, scope_key, employee_no, fecha)
);

COMMENT ON TABLE public.cuadricula_asistencia_dias IS
  'Asistencia por día (Lun–Dom) expandida desde payload de cuadricula_asistencia.';

CREATE INDEX IF NOT EXISTS idx_asistencia_dias_fecha
  ON public.cuadricula_asistencia_dias (fecha);

CREATE INDEX IF NOT EXISTS idx_asistencia_dias_employee_fecha
  ON public.cuadricula_asistencia_dias (employee_no, fecha);

CREATE INDEX IF NOT EXISTS idx_asistencia_dias_week
  ON public.cuadricula_asistencia_dias (week_start_iso);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cuadricula_asistencia_dias TO service_role;

-- Backfill desde payload existente (una sola vez al aplicar la migración).
INSERT INTO public.cuadricula_asistencia_dias (
  week_start_iso,
  scope_key,
  employee_no,
  fecha,
  codigo_d,
  codigo_t,
  codigo_n,
  nombre,
  servicio,
  planta,
  updated_at
)
SELECT
  ca.week_start_iso,
  ca.scope_key,
  emp.employee_no,
  (ca.week_start_iso + (day_idx.i)::integer) AS fecha,
  COALESCE(day_idx.codigo_d, '') AS codigo_d,
  COALESCE(day_idx.codigo_t, '') AS codigo_t,
  COALESCE(day_idx.codigo_n, '') AS codigo_n,
  emp.nombre,
  emp.servicio,
  emp.planta,
  COALESCE(ca.updated_at, now())
FROM public.cuadricula_asistencia ca
CROSS JOIN LATERAL (
  SELECT
    NULLIF(TRIM(BOTH FROM COALESCE(
      r.elem->>'employeeNo',
      r.elem->>'empNo',
      r.elem->>'noEmpleado',
      r.elem->>'id',
      ''
    )), '') AS employee_no,
    NULLIF(TRIM(BOTH FROM COALESCE(
      r.elem->>'name',
      r.elem->>'nombre',
      r.elem->>'nombreCompleto',
      ''
    )), '') AS nombre,
    NULLIF(TRIM(BOTH FROM COALESCE(
      r.elem->>'servicioLinea',
      r.elem->>'rowServiceNo',
      r.elem->>'serviceNo',
      ''
    )), '') AS servicio,
    NULLIF(TRIM(BOTH FROM COALESCE(
      r.elem->>'plantaLinea',
      r.elem->>'planta',
      ''
    )), '') AS planta,
    r.elem->'shifts' AS shifts
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(ca.payload->'rows') = 'array' THEN ca.payload->'rows'
      ELSE '[]'::jsonb
    END
  ) AS r(elem)
) emp
CROSS JOIN LATERAL (
  SELECT
    i,
    COALESCE(emp.shifts->i->>'D', '') AS codigo_d,
    COALESCE(emp.shifts->i->>'T', '') AS codigo_t,
    COALESCE(emp.shifts->i->>'N', '') AS codigo_n
  FROM generate_series(0, 6) AS i
) day_idx
WHERE emp.employee_no IS NOT NULL
ON CONFLICT (week_start_iso, scope_key, employee_no, fecha) DO NOTHING;
