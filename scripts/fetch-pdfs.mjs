// Descarga los PDFs de las revistas a public/pdf para que el visor pueda leerlos
// desde el mismo dominio (la web antigua no permite CORS).
// Los PDFs ya subidos a Sanity se leen directamente desde su CDN.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getRevistas } from '../src/lib/data.mjs';

const LIMITE_MB = Number(process.env.PDF_LIMITE_MB || 700); // GitHub Pages admite ~1 GB
const base = (process.env.BASE_PATH ?? '/libreriasindependientes-web').replace(/\/$/, '');

await mkdir('public/pdf', { recursive: true });
const revistas = await getRevistas();
const manifest = {};
let total = 0;

for (const r of revistas) {
  if (!r.pdf || r.pdf.includes('cdn.sanity.io')) continue;
  const destino = `public/pdf/${r.slug}.pdf`;
  try {
    if (!existsSync(destino)) {
      const res = await fetch(r.pdf);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const len = Number(res.headers.get('content-length') || 0);
      if ((total + len) / 1e6 > LIMITE_MB) {
        console.log(`límite alcanzado, se omite ${r.slug}`);
        await res.body?.cancel();
        continue;
      }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(destino));
    }
    const { size } = await stat(destino);
    total += size;
    manifest[r.slug] = `${base}/pdf/${r.slug}.pdf`;
    console.log(`ok ${r.slug} (${(size / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    console.warn(`sin PDF para ${r.slug}: ${e.message}`);
  }
}

await writeFile('src/data/pdf-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Total: ${(total / 1e6).toFixed(0)} MB en ${Object.keys(manifest).length} PDFs`);
