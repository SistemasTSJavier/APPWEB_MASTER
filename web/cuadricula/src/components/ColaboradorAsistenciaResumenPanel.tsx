import { useMemo } from "react";
import { addDays, collectFaltaDatesForRow, formatDateEs, weekDayMetas } from "../attendanceExportSummary";
import type { SemanaResumenColaborador } from "../attendanceResumenColaborador";
import { WEEK_COLUMNS, type GridRow, type Turn } from "../mockData";
import { TOTAL_COLUMN_HELP } from "../weekTotalsLegend";

const TURNS: Turn[] = ["D", "T", "N"];

function faltaFechasSemana(row: GridRow | null, monday: Date): string {
  if (!row?.shifts?.length) return "—";
  const metas = weekDayMetas(monday, WEEK_COLUMNS);
  const text = collectFaltaDatesForRow(row, metas);
  return text || "—";
}

function formatWeekCodes(row: GridRow | null): string {
  if (!row?.shifts?.length) return "—";
  const parts = WEEK_COLUMNS.map((col, i) => {
    const day = row.shifts[i];
    if (!day) return "";
    const codes = TURNS.map((t) => day[t]?.trim()).filter(Boolean);
    if (!codes.length) return "";
    return `${col.weekday.slice(0, 2)}: ${codes.join("/")}`;
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export type ColaboradorAsistenciaResumenPanelProps = {
  titulo: string;
  subtitulo?: string;
  mesYm: string;
  filas: SemanaResumenColaborador[];
  loading?: boolean;
  mostrarCodigos?: boolean;
};

export function ColaboradorAsistenciaResumenPanel({
  titulo,
  subtitulo,
  mesYm,
  filas,
  loading = false,
  mostrarCodigos = false,
}: ColaboradorAsistenciaResumenPanelProps) {
  const totalesMes = useMemo(() => {
    const acc = {
      asist: 0,
      extra: 0,
      desc: 0,
      falta: 0,
      inc: 0,
      pcgs: 0,
      psgs: 0,
      vac: 0,
      cap: 0,
    };
    for (const { row } of filas) {
      if (!row?.totals) continue;
      for (const k of Object.keys(acc) as (keyof typeof acc)[]) {
        acc[k] += row.totals[k] ?? 0;
      }
    }
    return acc;
  }, [filas]);

  const faltasMesTexto = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const { monday, row } of filas) {
      if (!row?.shifts?.length) continue;
      const metas = weekDayMetas(monday, WEEK_COLUMNS);
      const raw = collectFaltaDatesForRow(row, metas);
      if (!raw) continue;
      for (const d of raw.split(";")) {
        const label = d.trim();
        if (label && !seen.has(label)) {
          seen.add(label);
          ordered.push(label);
        }
      }
    }
    return ordered.length > 0 ? ordered.join("; ") : "—";
  }, [filas]);

  return (
    <div className="monthFocoPanel consultaResumen">
      <h2 className="monthFocoPanel__title">
        {titulo}
        <span className="monthFocoPanel__sub"> ({mesYm})</span>
      </h2>
      {subtitulo ? <p className="monthFocoPanel__hint">{subtitulo}</p> : null}
      {loading ? (
        <p className="hint">Cargando semanas del mes…</p>
      ) : filas.length === 0 ? (
        <p className="hint">No hay semanas en el mes seleccionado.</p>
      ) : (
        <div className="monthFocoPanel__scroll">
          <table className="sheet sheet--monthFoco" aria-label="Resumen de asistencia por semana">
            <thead>
              <tr className="theadSub">
                <th className="th th--monthWeek">Semana (lun–dom)</th>
                {mostrarCodigos ? (
                  <th className="th th--weekCodes">Códigos por día</th>
                ) : null}
                <th className="th th--total" title={TOTAL_COLUMN_HELP.asist}>
                  Asist.
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.extra}>
                  Extra
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.desc}>
                  Desc.
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.falta}>
                  Falta
                </th>
                <th className="th th--faltaFechas">Faltas (fechas)</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.inc}>
                  Inc.
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.pcgs}>
                  PCGS
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.psgs}>
                  PSGS
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.vac}>
                  Vac.
                </th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.cap}>
                  Cap.
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ monday, weekIso, row }) => (
                <tr key={weekIso}>
                  <td className="td td--monthWeek">
                    {formatDateEs(monday)} – {formatDateEs(addDays(monday, 6))}
                  </td>
                  {mostrarCodigos ? (
                    <td className="td td--weekCodes">{formatWeekCodes(row)}</td>
                  ) : null}
                  <td className="td td--total">{row?.totals.asist ?? "—"}</td>
                  <td className="td td--total">{row?.totals.extra ?? "—"}</td>
                  <td className="td td--total">{row?.totals.desc ?? "—"}</td>
                  <td className="td td--total">{row?.totals.falta ?? "—"}</td>
                  <td className="td td--faltaFechas">{faltaFechasSemana(row, monday)}</td>
                  <td className="td td--total">{row?.totals.inc ?? "—"}</td>
                  <td className="td td--total">{row?.totals.pcgs ?? "—"}</td>
                  <td className="td td--total">{row?.totals.psgs ?? "—"}</td>
                  <td className="td td--total">{row?.totals.vac ?? "—"}</td>
                  <td className="td td--total">{row?.totals.cap ?? "—"}</td>
                </tr>
              ))}
              <tr className="tr--monthTotal">
                <td className="td td--monthWeek">
                  <strong>Total mes</strong>
                </td>
                {mostrarCodigos ? <td className="td td--weekCodes" /> : null}
                <td className="td td--total">
                  <strong>{totalesMes.asist || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.extra || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.desc || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.falta || "—"}</strong>
                </td>
                <td className="td td--faltaFechas">
                  <strong>{faltasMesTexto}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.inc || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.pcgs || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.psgs || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.vac || "—"}</strong>
                </td>
                <td className="td td--total">
                  <strong>{totalesMes.cap || "—"}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
