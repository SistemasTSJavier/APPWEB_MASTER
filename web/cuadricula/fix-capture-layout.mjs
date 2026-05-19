import fs from "fs";

const p = new URL("./src/views/AttendanceView.tsx", import.meta.url);
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("              </table>\n            </motion>");
if (start === -1) {
  const alt = s.indexOf("              </table>\n            </div>\n          </div>\n        <div className=\"topbar__persistRow\">");
  if (alt === -1) throw new Error("start marker not found");
  const end = s.indexOf("      </header>\n\n      <motion className=\"sheetWrap sheetWrap--capture\">");
  if (end === -1) {
    const end2 = s.indexOf("      </header>\n\n      <div className=\"sheetWrap sheetWrap--capture\">");
    if (end2 === -1) throw new Error("end marker not found");
    var endPos = end2;
  } else var endPos = end;
  var startPos = alt;
} else {
  var startPos = start;
  var endPos = s.indexOf("      </header>\n\n      <div className=\"sheetWrap sheetWrap--capture\">");
}

if (endPos === -1) throw new Error("end not found");

const importExportBlock = `              </table>
              </motion>
            </motion>
          </details>

          <details className="attPanel">
            <summary className="attPanel__summary">Importar y exportar CSV</summary>
            <div className="attPanel__body">
          {puedeImportarCsv && !mostrarSoloResumenMensual ? (
            <div className="persistRow__csvBlock">
              <p className="persistRow__csvLead">
                <strong>Importación por CSV</strong> — semana en pantalla ({weekRangeLabel}). Con columna{' '}
                <strong>PLANTA</strong> y <strong>NO. SERVICIO</strong> (formato SERVICIO, NO. SERVICIO, PLANTA, POSICION… + D/T/N×7) un solo
                archivo actualiza <strong>todas las plantas</strong>: empareja por <strong>NO DE EMPLEADO</strong> y, si hay varios servicios en la
                misma planta, por <strong>NO SERVICIO</strong> de cada bloque. Si PLANTA viene vacía, se infiere del catálogo por N.º de servicio.
                Sin columna PLANTA, elija la planta arriba.
              </p>
              <div className="persistRow__csvActions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(false)}
                  disabled={!plantaSeleccionada.trim() || rows.length === 0}
                  title={!plantaSeleccionada.trim() ? 'Seleccione planta' : undefined}
                >
                  Descargar CSV (planta)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(true)}
                >
                  Descargar CSV (todas las plantas)
                </button>
                <input
                  ref={importCsvCodesRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="persistRow__csvFile"
                  aria-label="Importar CSV de códigos de asistencia"
                  onChange={onImportCsvCodesChange}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => importCsvCodesRef.current?.click()}
                >
                  Importar CSV…
                </button>
              </div>
            </div>
          ) : (
            <p className="persistRow__meta muted">La importación CSV requiere permiso de edición.</p>
          )}
            <div className="topbar__exportRow topbar__exportRow--panel">
`;

// Read export+hint from file between markers
const exportStart = s.indexOf('<div className="topbar__exportRow topbar__exportRow--panel">');
const hintEnd = s.indexOf("          </details>\n        </motion>\n      </header>");
let middle = "";
if (exportStart !== -1 && hintEnd !== -1) {
  middle = s.slice(exportStart, hintEnd);
  middle = middle.replace(/<motion className="topbar__exportRow/g, "<div className=\"topbar__exportRow");
  middle = middle.replace(/<\/motion>/g, "");
}

const tail = `            </div>
          </details>

          <details className="attPanel">
            <summary className="attPanel__summary">Ayuda y códigos de captura</summary>
            <div className="attPanel__body">
        <p className="hint attPanel__hint">
          El listado de <strong>Planta</strong> sale solo de colaboradores activos (campo planta en expediente). Cada fila usa su{' '}
          <strong>N.º de servicio</strong> según <strong>Servicios</strong> (referencia por fila). Use{' '}
          <strong>Colaborador</strong> para una persona o el <strong>resumen mensual</strong>. <strong>Número</strong> o <strong>A</strong> → Asist.;{' '}
          <strong>DD</strong>+número → Extra; <strong>F</strong> → Falta; <strong>D</strong> → 1 Desc. por día (aunque esté en D+T+N); INC/VAC/PCGS/PSGS/CAP → su columna.{' '}
          {puedeEditar ? (
            <>
              Pulse <strong>Guardar semana</strong> para conservar en el servidor.{' '}
            </>
          ) : (
            <>
              <strong>Solo lectura</strong> (sin permiso de edición).{' '}
            </>
          )}
          {puedeImportarCsv ? (
            <>
              Para capturar <strong>códigos en celdas</strong> use <strong>Importar y exportar CSV</strong> (panel arriba).{' '}
            </>
          ) : null}
          Códigos:{' '}
          {CODE_HINTS.join(', ')}, <strong>A</strong> o número (Asist.), <strong>DD</strong>+n.º (Extra, p. ej. DD937).
        </p>
            </div>
          </details>
        </div>
`;

// Find start: after legend table closes - use line 943
const legendTableEnd = s.indexOf("              </table>");
const persistRowStart = s.indexOf("        <div className=\"topbar__persistRow\">", legendTableEnd);
const headerEnd = s.indexOf("      </header>", persistRowStart);

const before = s.slice(0, legendTableEnd);
const replacement = `              </table>
              </div>
            </motion>
          </details>

          <details className="attPanel">
            <summary className="attPanel__summary">Importar y exportar CSV</summary>
            <div className="attPanel__body">
          {puedeImportarCsv && !mostrarSoloResumenMensual ? (
            <div className="persistRow__csvBlock">
              <p className="persistRow__csvLead">
                <strong>Importación por CSV</strong> — semana en pantalla ({weekRangeLabel}). Con columna{' '}
                <strong>PLANTA</strong> y <strong>NO. SERVICIO</strong> (formato SERVICIO, NO. SERVICIO, PLANTA, POSICION… + D/T/N×7) un solo
                archivo actualiza <strong>todas las plantas</strong>: empareja por <strong>NO DE EMPLEADO</strong> y, si hay varios servicios en la
                misma planta, por <strong>NO SERVICIO</strong> de cada bloque. Si PLANTA viene vacía, se infiere del catálogo por N.º de servicio.
                Sin columna PLANTA, elija la planta arriba.
              </p>
              <div className="persistRow__csvActions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(false)}
                  disabled={!plantaSeleccionada.trim() || rows.length === 0}
                  title={!plantaSeleccionada.trim() ? 'Seleccione planta' : undefined}
                >
                  Descargar CSV (planta)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(true)}
                >
                  Descargar CSV (todas las plantas)
                </button>
                <input
                  ref={importCsvCodesRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="persistRow__csvFile"
                  aria-label="Importar CSV de códigos de asistencia"
                  onChange={onImportCsvCodesChange}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => importCsvCodesRef.current?.click()}
                >
                  Importar CSV…
                </button>
              </div>
            </div>
          ) : (
            <p className="persistRow__meta muted">La importación CSV requiere permiso de edición.</p>
          )}
`;

// extract export row from original slice
let exportSection = s.slice(s.indexOf("<div className=\"topbar__exportRow"), s.indexOf("<details className=\"attPanel\">\n            <summary className=\"attPanel__summary\">Ayuda"));
if (exportSection === "" || exportSection.length < 50) {
  exportSection = s.slice(s.indexOf("topbar__exportRow"), s.indexOf("Ayuda y códigos"));
}

// simpler: slice from persistRow to header and rebuild
const chunk = s.slice(persistRowStart, headerEnd);
const exportMatch = chunk.match(/<div className="topbar__exportRow[\s\S]*?<\/div>\s*\n\s*<\/details>/);
// manual extract export - from line with exportRow to before Ayuda details

const exportOnly = s.substring(
  s.indexOf('            <div className="topbar__exportRow topbar__exportRow--panel">') !== -1
    ? s.indexOf('            <motion className="topbar__exportRow topbar__exportRow--panel">') !== -1
      ? s.indexOf('            <motion className="topbar__exportRow topbar__exportRow--panel">')
      : s.indexOf('            <motion className="topbar__exportRow topbar__exportRow--panel">')
    : s.indexOf('        <div className="topbar__exportRow">'),
);

// Too messy - use line-based approach
const lines = s.split(/\r?\n/);
const out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.includes("              </table>") && i > 900 && i < 950) {
    out.push("              </table>");
    out.push("              </div>");
    out.push("            </div>");
    out.push("          </details>");
    out.push("");
    out.push("          <details className=\"attPanel\">");
    out.push("            <summary className=\"attPanel__summary\">Importar y exportar CSV</summary>");
    out.push("            <div className=\"attPanel__body\">");
    i++;
    // skip until we pass persistRow duplicate meta (lastSavedAt block)
    while (i < lines.length && !lines[i].includes("persistRow__csvBlock") && !lines[i].includes("{puedeImportarCsv && !mostrarSoloResumenMensual")) {
      if (lines[i].includes("topbar__persistRow") || lines[i].includes("persistRow__meta") || lines[i].includes("persistRow__flash") || lines[i].includes("Ir al último guardado globalmente") || lines[i].includes("legacyRecoveredHint")) {
        i++;
        continue;
      }
      if (lines[i].trim() === "</div>" && lines[i + 1]?.includes("topbar__exportRow")) break;
      if (lines[i].includes("</details>") && lines[i + 1]?.includes("Ayuda")) break;
      i++;
    }
    continue;
  }
  if (line.includes("</motion>") && i > 1140 && i < 1155) {
    out.push("        </motion>");
    i++;
    continue;
  }
  out.push(line);
  i++;
}

fs.writeFileSync(p, out.join("\n").replace(/<motion/g, "<div").replace(/<\/motion>/g, "</motion>"), "utf8");
console.log("patched");
