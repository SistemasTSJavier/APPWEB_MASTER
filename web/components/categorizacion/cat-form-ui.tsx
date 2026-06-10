"use client";

import type { CatCampoDef } from "@/lib/categorizacion-campos";
import { CAT_ESCALA_MAX, CAT_ESCALA_MIN } from "@/lib/categorizacion-calificaciones";

export function CatMsg({ msg, error }: { msg: string | null; error?: boolean }) {
  if (!msg) return null;
  return (
    <p
      className={`text-xs font-bold uppercase ${error || msg.includes("ERROR") ? "text-red-800" : "text-emerald-800"}`}
    >
      {msg}
    </p>
  );
}

export function CatRatingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase leading-snug text-slate-700">{label}</span>
      <select
        className="form-control w-full text-sm"
        value={value === "" ? "" : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
      >
        <option value="">—</option>
        {Array.from({ length: CAT_ESCALA_MAX - CAT_ESCALA_MIN + 1 }, (_, i) => CAT_ESCALA_MIN + i).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CatRatingGrid({
  campos,
  scores,
  onChange,
}: {
  campos: CatCampoDef[];
  scores: Record<string, number | "">;
  onChange: (key: string, v: number | "") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {campos.map((c) => (
        <CatRatingSelect
          key={c.key}
          label={c.label}
          value={scores[c.key] ?? ""}
          onChange={(v) => onChange(c.key, v)}
        />
      ))}
    </div>
  );
}

export function CatPromedioBadge({
  promedio,
  label = "Promedio",
}: {
  promedio: number | null;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
      <span className="text-xs font-bold uppercase text-violet-900">{label}</span>
      <span className="text-lg font-extrabold text-violet-950">{promedio != null ? promedio.toFixed(2) : "—"}</span>
      <span className="text-[10px] font-semibold text-slate-600">(escala 1–5)</span>
    </div>
  );
}
