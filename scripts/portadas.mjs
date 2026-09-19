// Genera las portadas a partir de la primera página de cada PDF descargado.
// Las imágenes de la web antigua son de 225 px de ancho y se ven borrosas;
// estas salen a ~1000 px. Requiere poppler-utils (pdftoppm).
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const base = (process.env.BASE_PATH ?? '/libreriasindependientes-web').replace(/\/$/, '');
const DPI = Number(process.env.PORTADA_DPI || 110); // ~840 px de ancho en A4

if (!existsSync('public/pdf')) {
  console.log('No hay PDFs descargados; se mantienen las portadas originales.');
  process.exit(0);
}

await mkdir('public/portadas', { recursive: true });
const manifest = {};
const pdfs = (await readdir('public/pdf')).filter((f) => f.endsWith('.pdf'));

for (const archivo of pdfs) {
  const slug = archivo.replace(/\.pdf$/, '');
  const destino = `public/portadas/${slug}.jpg`;
  try {
    if (!existsSync(destino)) {
      await ejecutar('pdftoppm', ['-jpeg', '-jpegopt', 'quality=82', '-r', String(DPI), '-f', '1', '-l', '1', '-singlefile', `public/pdf/${archivo}`, `public/portadas/${slug}`]);
    }
    const { size } = await stat(destino);
    manifest[slug] = `${base}/portadas/${slug}.jpg`;
    console.log(`portada ${slug} (${Math.round(size / 1024)} KB)`);
  } catch (e) {
    console.warn(`sin portada para ${slug}: ${e.message}`);
  }
}

await writeFile('src/data/portadas-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`${Object.keys(manifest).length} portadas generadas de ${pdfs.length} PDFs`);
