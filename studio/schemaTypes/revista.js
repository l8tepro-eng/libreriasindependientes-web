import { defineField, defineType } from 'sanity';

const TEMPORADAS = [
  { title: 'Primavera', value: 'primavera' },
  { title: 'Verano', value: 'verano' },
  { title: 'Otoño', value: 'otono' },
  { title: 'Navidad / Invierno', value: 'invierno' },
  { title: 'Especial', value: 'especial' },
];

export default defineType({
  name: 'revista',
  title: 'Revista L',
  type: 'document',
  fields: [
    defineField({ name: 'titulo', title: 'Título', type: 'string', validation: (r) => r.required(), description: 'Ej.: Nº 83 - Navidad 2026' }),
    defineField({ name: 'subtitulo', title: 'Subtítulo', type: 'string', description: 'Ej.: L y MAS. NAVIDAD' }),
    defineField({
      name: 'slug',
      title: 'Dirección web',
      type: 'slug',
      options: { source: 'titulo', maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'numero', title: 'Número', type: 'number' }),
    defineField({ name: 'anio', title: 'Año', type: 'number', validation: (r) => r.required().min(1997).max(2100) }),
    defineField({
      name: 'temporada',
      title: 'Temporada',
      type: 'string',
      options: { list: TEMPORADAS, layout: 'radio', direction: 'horizontal' },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'idioma',
      title: 'Idioma',
      type: 'string',
      options: { list: [{ title: 'Castellano', value: 'es' }, { title: 'Catalán', value: 'ca' }], layout: 'radio', direction: 'horizontal' },
      initialValue: 'es',
    }),
    defineField({ name: 'portada', title: 'Portada', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'pdf', title: 'PDF de la revista', type: 'file', options: { accept: 'application/pdf' } }),
    defineField({ name: 'descripcion', title: 'Descripción', type: 'text', rows: 3 }),
    defineField({ name: 'portadaUrl', title: 'Portada (URL antigua)', type: 'url', hidden: true }),
    defineField({ name: 'pdfUrl', title: 'PDF (URL antigua)', type: 'url', readOnly: true, description: 'Enlace a la web anterior. Si subes un PDF arriba, se usará ese.' }),
  ],
  orderings: [
    { title: 'Más recientes', name: 'recientes', by: [{ field: 'anio', direction: 'desc' }, { field: 'numero', direction: 'desc' }] },
  ],
  preview: {
    select: { title: 'titulo', subtitle: 'subtitulo', media: 'portada', idioma: 'idioma' },
    prepare: ({ title, subtitle, media, idioma }) => ({
      title,
      subtitle: `${idioma === 'ca' ? '[CAT] ' : ''}${subtitle || ''}`,
      media,
    }),
  },
});
