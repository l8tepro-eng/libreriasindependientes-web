// Importa en Sanity el contenido extraído (src/data/*.json).
// Requiere: SANITY_PROJECT_ID, SANITY_WRITE_TOKEN (rol Editor). Opcional: SANITY_DATASET, IMPORT_PDFS (nº de PDFs a subir).
import { createClient } from '@sanity/client';
import { readFile } from 'node:fs/promises';

const { SANITY_PROJECT_ID, SANITY_WRITE_TOKEN } = process.env;
if (!SANITY_PROJECT_ID || !SANITY_WRITE_TOKEN) {
  console.error('Faltan SANITY_PROJECT_ID o SANITY_WRITE_TOKEN');
  process.exit(1);
}
const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
});
const IMPORT_PDFS = Number(process.env.IMPORT_PDFS ?? 8);

const revistas = JSON.parse(await readFile('src/data/revistas.json', 'utf8'));
const librerias = JSON.parse(await readFile('src/data/librerias.json', 'utf8'));
const idSeguro = (s) => s.replace(/[^a-zA-Z0-9_-]/g, '-');

async function subir(tipo, url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const asset = await client.assets.upload(tipo, buf, { filename });
  return { _type: tipo, asset: { _type: 'reference', _ref: asset._id } };
}

async function existentes(tipo) {
  const docs = await client.fetch(`*[_type == $tipo]{_id, portada, pdf, logo, fotos}`, { tipo });
  return new Map(docs.map((d) => [d._id, d]));
}

// ---- Revistas (ya ordenadas por la web; las primeras son las más recientes)
const { sortRevistas } = await import('../src/lib/data.mjs');
const prevR = await existentes('revista');
let pdfsSubidos = 0;
for (const r of sortRevistas(revistas)) {
  const _id = `revista-${idSeguro(r.slug)}`;
  const prev = prevR.get(_id) || {};
  const doc = {
    _id,
    _type: 'revista',
    titulo: r.titulo,
    subtitulo: r.subtitulo || undefined,
    slug: { _type: 'slug', current: r.slug },
    numero: r.numero || undefined,
    anio: r.anio || undefined,
    temporada: r.temporada,
    idioma: r.idioma,
    descripcion: r.descripcion || undefined,
    portadaUrl: r.portada,
    pdfUrl: r.pdf,
  };
  try {
    doc.portada = prev.portada || (r.portada ? await subir('image', r.portada, `${r.slug}.jpg`) : undefined);
    if (prev.pdf) doc.pdf = prev.pdf;
    else if (pdfsSubidos < IMPORT_PDFS && r.pdf) {
      doc.pdf = await subir('file', r.pdf, `${r.slug}.pdf`);
      pdfsSubidos++;
    }
  } catch (e) {
    console.warn(`  archivos de ${r.slug}: ${e.message}`);
  }
  await client.createOrReplace(doc);
  console.log(`revista ${r.slug}`);
}

// ---- Librerías
const prevL = await existentes('libreria');
for (const l of librerias) {
  const _id = `libreria-${idSeguro(l.slug)}`;
  const prev = prevL.get(_id) || {};
  const doc = {
    _id,
    _type: 'libreria',
    nombre: l.nombre,
    slug: { _type: 'slug', current: l.slug },
    direccion: l.direccion,
    cp: l.cp,
    ciudad: l.ciudad,
    provincia: l.provincia,
    comunidad: l.comunidad,
    telefono: l.telefono,
    email: l.email,
    web: l.web,
    descripcion: l.descripcion || undefined,
    ubicacion: l.lat ? { _type: 'geopoint', lat: l.lat, lng: l.lng } : undefined,
    logoUrl: l.logo || undefined,
    fotosUrl: l.fotos?.length ? l.fotos : undefined,
  };
  try {
    doc.logo = prev.logo || (l.logo ? await subir('image', l.logo, `${l.slug}-logo.jpg`) : undefined);
  } catch (e) {
    console.warn(`  logo de ${l.slug}: ${e.message}`);
  }
  await client.createOrReplace(doc);
  console.log(`librería ${l.slug}`);
}
console.log('Importación completada.');
