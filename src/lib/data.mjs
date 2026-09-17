// Fuente de datos única para la web.
// - Si hay SANITY_PROJECT_ID, lee de Sanity (modo producción).
// - Si no, usa los JSON extraídos de la web actual (modo demo / respaldo).
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

export const TEMPORADAS = {
  primavera: { nombre: 'Primavera', orden: 1 },
  verano: { nombre: 'Verano', orden: 2 },
  otono: { nombre: 'Otoño', orden: 3 },
  invierno: { nombre: 'Navidad', orden: 4 },
  especial: { nombre: 'Especial', orden: 0 },
};

async function readJson(name, fallback) {
  const f = path.join(DATA_DIR, name);
  if (!existsSync(f)) return fallback;
  return JSON.parse(await readFile(f, 'utf8'));
}

let clientPromise;
function sanityClient() {
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) return null;
  clientPromise ??= import('@sanity/client').then(({ createClient }) =>
    createClient({
      projectId,
      dataset: process.env.SANITY_DATASET || 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
      token: process.env.SANITY_READ_TOKEN || undefined,
    }),
  );
  return clientPromise;
}

export function sortRevistas(list) {
  return [...list].sort(
    (a, b) =>
      (b.anio || 0) - (a.anio || 0) ||
      (TEMPORADAS[b.temporada]?.orden ?? 0) - (TEMPORADAS[a.temporada]?.orden ?? 0) ||
      (b.numero || 0) - (a.numero || 0) ||
      (a.idioma === 'es' ? -1 : 1) - (b.idioma === 'es' ? -1 : 1),
  );
}

let cache = {};

export async function getRevistas() {
  if (cache.revistas) return cache.revistas;
  const client = await sanityClient();
  let list;
  if (client) {
    list = await client.fetch(`*[_type == "revista" && !(_id in path("drafts.**"))]{
      "slug": slug.current, titulo, subtitulo, numero, anio, temporada, idioma, descripcion,
      "portada": coalesce(portada.asset->url, portadaUrl),
      "pdf": coalesce(pdf.asset->url, pdfUrl)
    }`);
  } else {
    list = await readJson('revistas.json', []);
  }
  const manifest = await readJson('pdf-manifest.json', {});
  cache.revistas = sortRevistas(list).map((r) => ({
    ...r,
    // URL legible por el visor (mismo origen o CDN con CORS)
    pdfVisor: manifest[r.slug] || (r.pdf && r.pdf.includes('cdn.sanity.io') ? r.pdf : null),
  }));
  return cache.revistas;
}

export async function getLibrerias() {
  if (cache.librerias) return cache.librerias;
  const client = await sanityClient();
  let list;
  if (client) {
    list = await client.fetch(`*[_type == "libreria" && !(_id in path("drafts.**"))] | order(nombre asc){
      "slug": slug.current, nombre, direccion, cp, ciudad, provincia, comunidad, telefono, email, web, descripcion,
      "lat": ubicacion.lat, "lng": ubicacion.lng,
      "logo": coalesce(logo.asset->url, logoUrl),
      "fotos": coalesce(fotos[].asset->url, fotosUrl, [])
    }`);
  } else {
    list = await readJson('librerias.json', []);
  }
  cache.librerias = list
    .filter((l) => l.slug && l.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return cache.librerias;
}

export function nombreTemporada(r) {
  if (r.idioma === 'ca') {
    return { primavera: 'Primavera', verano: 'Estiu', otono: 'Tardor', invierno: 'Hivern' }[r.temporada] || 'Especial';
  }
  return TEMPORADAS[r.temporada]?.nombre || 'Especial';
}

export function url(p = '/') {
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${p.startsWith('/') ? p : '/' + p}`;
}
