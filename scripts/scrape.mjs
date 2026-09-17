// Extrae el contenido de la web actual (revistas y librerías asociadas)
// y lo guarda en src/data/*.json. Pensado para ejecutarse en GitHub Actions.
import * as cheerio from 'cheerio';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ORIGEN = 'https://www.libreriasindependientes.com';
const UA = 'LeranAI-migracion/0.1 (demo nueva web; contacto: Leran AI)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.warn(`  fallo ${url} (${e.message}), intento ${i}`);
      if (i === intentos) throw e;
      await sleep(1500 * i);
    }
  }
}

const abs = (u) => (u ? new URL(u, ORIGEN).href : null);

// Texto con saltos de línea respetando <br> y bloques
function lineas($, el) {
  const html = $.html(el)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr|section|article)>/gi, '\n');
  return cheerio
    .load(html)
    .root()
    .text()
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const quitarAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ---------------- Revistas ----------------
function temporadaDe(texto) {
  const t = quitarAcentos(texto.toLowerCase());
  if (/primavera|abril|marzo|dias de libros/.test(t)) return 'primavera';
  if (/verano|estiu|junio|julio/.test(t)) return 'verano';
  if (/otono|tardor|septiembre|octubre|volvemos/.test(t)) return 'otono';
  if (/invierno|navidad|hivern|nadal|diciembre|noviembre/.test(t)) return 'invierno';
  return 'especial';
}

async function scrapeRevistas() {
  console.log('Revistas…');
  const $ = cheerio.load(await get(`${ORIGEN}/revista-l`));
  const vistos = new Set();
  const revistas = [];
  $('a[href$=".pdf"]').each((i, a) => {
    const href = abs($(a).attr('href'));
    if (vistos.has(href)) return;
    const img = $(a).find('img').first();
    if (!img.length) return;
    vistos.add(href);

    // Contenedor: el ancestro más alto que solo contiene este PDF
    let cont = $(a);
    let p = cont.parent();
    while (p.length && p[0].tagName !== 'body') {
      const pdfs = new Set(p.find('a[href$=".pdf"]').map((_, x) => abs($(x).attr('href'))).get());
      if (pdfs.size > 1) break;
      cont = p;
      p = p.parent();
    }
    let ls = lineas($, cont).filter((l) => !/^descargar$/i.test(l));
    if (ls.length === 0) {
      // títulos fuera del contenedor: buscar encabezados previos
      ls = cont.prevAll('h1,h2,h3,h4').slice(0, 2).map((_, h) => $(h).text().trim()).get().reverse();
    }
    const archivo = href.split('/').pop().replace(/\.pdf$/i, '');
    const titulo = ls[0] || archivo;
    const subtitulo = ls[1] || '';
    const descripcion = ls.slice(2).join(' ').replace(/^"|"$/g, '');
    const todo = `${titulo} ${subtitulo} ${archivo}`;
    const numero = Number((titulo.match(/N[ºo°.]\s*(\d+)/i) || archivo.match(/-(\d{2,3})-/) || archivo.match(/revista-(\d{2,3})/) || [])[1]) || null;
    const anio = Number((todo.match(/(20\d\d)/) || [])[1]) || null;
    const idioma = /catal|llibres|tardor|estiu|hivern/i.test(`${titulo} ${subtitulo} ${archivo}`) ? 'ca' : 'es';
    revistas.push({
      slug: archivo.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      titulo: titulo.replace(/\s+/g, ' '),
      subtitulo,
      descripcion,
      numero,
      anio,
      temporada: temporadaDe(todo),
      idioma,
      portada: abs(img.attr('src') || img.attr('data-src')),
      pdf: href,
      orden: i,
    });
  });
  console.log(`  ${revistas.length} revistas`);
  return revistas;
}

// ---------------- Librerías ----------------
const COMUNIDADES = ['Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria', 'Castilla y León',
  'Castilla La Mancha', 'Cataluña', 'Comunidad Valenciana', 'Extremadura', 'Galicia', 'Madrid', 'Murcia',
  'Navarra', 'País Vasco', 'La Rioja'];
const normCom = (s) => {
  const t = quitarAcentos(s.toLowerCase()).trim();
  return COMUNIDADES.find((c) => quitarAcentos(c.toLowerCase()) === t) || null;
};

const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s\-/(])([a-záéíóúñüç])/g, (m, p, c) => p + c.toUpperCase());

async function scrapeLibrerias() {
  console.log('Librerías…');
  const $ = cheerio.load(await get(`${ORIGEN}/asociados`));
  const libs = new Map();
  let comunidad = null;
  $('h1,h2,h3,h4,h5,strong,option,a[href*="/asociados/"]').each((_, el) => {
    if (el.tagName === 'option') return;
    if (el.tagName !== 'a') {
      const c = normCom($(el).text());
      if (c) comunidad = c;
      return;
    }
    const href = abs($(el).attr('href'));
    const slug = href.replace(/\/$/, '').split('/asociados/')[1];
    if (!slug || slug.includes('/') || libs.has(slug)) return;
    const lineasEnlace = lineas($, el);
    const nombre = (lineasEnlace[0] || $(el).text()).replace(/\s+/g, ' ').trim();
    if (!nombre) return;
    // bloque de la librería: ancestro con un único enlace a ficha
    let cont = $(el);
    let p = cont.parent();
    while (p.length && p[0].tagName !== 'body') {
      const n = new Set(p.find('a[href*="/asociados/"]').map((_, x) => $(x).attr('href')).get());
      if (n.size > 1) break;
      cont = p;
      p = p.parent();
    }
    const ls = lineas($, cont).filter((l) => l !== nombre);
    const d = { slug, nombre, comunidad, url: href };
    for (const l of ls) {
      let m;
      if ((m = l.match(/^(\d{5})\s*-\s*(.+)$/))) { d.cp = m[1]; d.ciudad = titleCase(m[2].trim()); }
      else if (/@/.test(l) && !d.email) d.email = (l.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [l])[0];
      else if (/^(h[tp]{2,3}s?:\/\/|www\.)/i.test(l) && !d.web) d.web = l.replace(/^htpps?:/i, 'https:').replace(/^www\./i, 'https://www.');
      else if (/^[\d\s.()+-]{9,}$/.test(l) && !d.telefono) d.telefono = l.trim();
      else if (!d.direccion && !d.cp) d.direccion = l;
    }
    libs.set(slug, d);
  });
  console.log(`  ${libs.size} librerías en el listado`);

  // Fichas individuales: logo, fotos, descripción, provincia
  for (const d of libs.values()) {
    try {
      const $f = cheerio.load(await get(d.url));
      const imgs = $f('img').map((_, i) => abs($f(i).attr('src'))).get();
      d.logo = imgs.find((s) => /logo-asociado/i.test(s)) || null;
      d.fotos = [...new Set(imgs.filter((s) => /foto-asociado/i.test(s)))];
      const parrafos = $f('p')
        .map((_, p) => $f(p).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter((t) => t.length > 60 && !/Villanueva 33|cookies|Desarrollado por/i.test(t));
      d.descripcion = parrafos.join('\n\n');
      const texto = $f('body').text().replace(/\s+/g, ' ');
      if (d.cp) {
        const m = texto.match(new RegExp(`${d.cp},\\s*[^,]+,\\s*([^,]+),\\s*([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)`));
        if (m) {
          d.provincia = m[1].trim();
          d.comunidad ??= normCom(m[2]);
        }
      }
    } catch (e) {
      console.warn(`  sin ficha ${d.slug}: ${e.message}`);
    }
    await sleep(300);
  }
  return [...libs.values()];
}

// ---------------- Geocodificación (OpenStreetMap Nominatim) ----------------
async function geocodificar(libs, previas) {
  console.log('Geocodificando…');
  const cacheGeo = new Map(previas.filter((l) => l.lat).map((l) => [l.slug, l]));
  const buscar = async (q) => {
    const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q=${encodeURIComponent(q)}`;
    await sleep(1100); // política de uso: 1 petición/segundo
    const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' } });
    if (!res.ok) return null;
    const j = await res.json();
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  };
  let ok = 0;
  for (const d of libs) {
    const prev = cacheGeo.get(d.slug);
    if (prev) { d.lat = prev.lat; d.lng = prev.lng; d.geoPrecision = prev.geoPrecision; ok++; continue; }
    const dir = (d.direccion || '').replace(/^(c\/|calle)\s*/i, 'Calle ').replace(/nº\s*/i, '');
    const intentos = [
      [`${dir}, ${d.cp || ''} ${d.ciudad || ''}, España`, 'calle'],
      [`${d.cp || ''} ${d.ciudad || ''}, España`, 'cp'],
      [`${d.ciudad || ''}, ${d.provincia || d.comunidad || ''}, España`, 'ciudad'],
    ];
    for (const [q, prec] of intentos) {
      try {
        const r = await buscar(q);
        if (r) { Object.assign(d, r, { geoPrecision: prec }); ok++; break; }
      } catch {}
    }
  }
  console.log(`  ${ok}/${libs.length} con coordenadas`);
}

// ---------------- Main ----------------
await mkdir('src/data', { recursive: true });
const revistas = await scrapeRevistas();
if (!revistas.length) throw new Error('No se encontró ninguna revista: revisar el extractor');
await writeFile('src/data/revistas.json', JSON.stringify(revistas, null, 2));

const previas = existsSync('src/data/librerias.json') ? JSON.parse(await readFile('src/data/librerias.json', 'utf8')) : [];
const librerias = await scrapeLibrerias();
if (!librerias.length) throw new Error('No se encontró ninguna librería: revisar el extractor');
await geocodificar(librerias, previas);
await writeFile('src/data/librerias.json', JSON.stringify(librerias, null, 2));
console.log('Listo.');
