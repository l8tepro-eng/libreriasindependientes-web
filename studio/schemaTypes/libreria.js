import { defineField, defineType } from 'sanity';

const COMUNIDADES = ['Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria', 'Castilla y León',
  'Castilla La Mancha', 'Cataluña', 'Comunidad Valenciana', 'Extremadura', 'Galicia', 'Madrid', 'Murcia',
  'Navarra', 'País Vasco', 'La Rioja'];

export default defineType({
  name: 'libreria',
  title: 'Librería asociada',
  type: 'document',
  groups: [
    { name: 'datos', title: 'Datos', default: true },
    { name: 'ubicacion', title: 'Ubicación' },
    { name: 'imagenes', title: 'Imágenes' },
  ],
  fields: [
    defineField({ name: 'nombre', title: 'Nombre', type: 'string', group: 'datos', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Dirección web', type: 'slug', group: 'datos', options: { source: 'nombre' }, validation: (r) => r.required() }),
    defineField({ name: 'telefono', title: 'Teléfono', type: 'string', group: 'datos' }),
    defineField({ name: 'email', title: 'Email', type: 'string', group: 'datos' }),
    defineField({ name: 'web', title: 'Web', type: 'url', group: 'datos', validation: (r) => r.uri({ allowRelative: false, scheme: ['http', 'https'] }) }),
    defineField({ name: 'descripcion', title: 'Descripción', type: 'text', rows: 5, group: 'datos' }),
    defineField({ name: 'direccion', title: 'Dirección', type: 'string', group: 'ubicacion' }),
    defineField({ name: 'cp', title: 'Código postal', type: 'string', group: 'ubicacion' }),
    defineField({ name: 'ciudad', title: 'Ciudad', type: 'string', group: 'ubicacion' }),
    defineField({ name: 'provincia', title: 'Provincia', type: 'string', group: 'ubicacion' }),
    defineField({ name: 'comunidad', title: 'Comunidad autónoma', type: 'string', group: 'ubicacion', options: { list: COMUNIDADES } }),
    defineField({ name: 'ubicacion', title: 'Punto en el mapa', type: 'geopoint', group: 'ubicacion', description: 'Latitud y longitud (se pueden copiar de Google Maps).' }),
    defineField({ name: 'logo', title: 'Logo', type: 'image', group: 'imagenes' }),
    defineField({ name: 'fotos', title: 'Fotos', type: 'array', of: [{ type: 'image' }], group: 'imagenes', options: { layout: 'grid' } }),
    defineField({ name: 'logoUrl', type: 'url', hidden: true }),
    defineField({ name: 'fotosUrl', type: 'array', of: [{ type: 'url' }], hidden: true }),
  ],
  preview: {
    select: { title: 'nombre', ciudad: 'ciudad', comunidad: 'comunidad', media: 'logo' },
    prepare: ({ title, ciudad, comunidad, media }) => ({ title, subtitle: [ciudad, comunidad].filter(Boolean).join(' · '), media }),
  },
});
