/**
 * Normaliza texto de fecha a `YYYY-MM-DD` para `<input type="date">`.
 * Acepta prefijo ISO, DD/MM/YYYY y DD-MM-YYYY (uso típico en MX).
 */
export function normalizarFechaParaInputDate(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";

  const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (isoDay) return `${isoDay[1]}-${isoDay[2]}-${isoDay[3]}`;

  const ymd = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/.exec(t);
  if (ymd) {
    const yyyy = Number(ymd[1]);
    const mm = Number(ymd[2]);
    const dd = Number(ymd[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 1900 && yyyy <= 2100) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    }
  }

  const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(t);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yyyy = Number(dmy[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 1900 && yyyy <= 2100) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    }
  }

  return "";
}
