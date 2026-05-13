#!/usr/bin/env node
/**
 * Vacía el bucket `colaboradores-fotos` usando la Storage API (service role).
 * Supabase bloquea DELETE SQL directo sobre storage.objects — hay que usar este script o el Dashboard.
 *
 * Uso (desde la carpeta web):
 *   set SUPABASE_URL=https://xxxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node supabase/scripts/empty-colaboradores-fotos-bucket.mjs
 *
 * O con archivo de entorno (Node 20+):
 *   node --env-file=.env.local supabase/scripts/empty-colaboradores-fotos-bucket.mjs
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "colaboradores-fotos";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY en el entorno.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function isFile(item) {
  const m = item?.metadata;
  return m != null && typeof m.size === "number";
}

/** Lista y borra recursivamente (rutas tipo NO123/uuid.jpg). */
async function purgePrefix(prefix) {
  let offset = 0;
  const limit = 1000;
  let totalRemoved = 0;

  while (true) {
    const { data: items, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!items?.length) break;

    const files = [];
    const subdirs = [];

    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (isFile(item)) {
        files.push(path);
      } else {
        subdirs.push(path);
      }
    }

    for (const dir of subdirs) {
      totalRemoved += await purgePrefix(dir);
    }

    if (files.length) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(files);
      if (rmErr) throw rmErr;
      totalRemoved += files.length;
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return totalRemoved;
}

try {
  const n = await purgePrefix("");
  console.log(`Listo. Archivos eliminados del bucket "${BUCKET}": ${n}`);
} catch (e) {
  console.error(e?.message ?? e);
  process.exit(1);
}
