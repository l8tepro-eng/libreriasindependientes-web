import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemaTypes';

export default defineConfig({
  name: 'default',
  title: 'Librerías Independientes',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Contenido')
          .items([
            S.listItem()
              .title('Revista L')
              .child(
                S.documentTypeList('revista')
                  .title('Revistas')
                  .defaultOrdering([{ field: 'anio', direction: 'desc' }, { field: 'numero', direction: 'desc' }]),
              ),
            S.listItem()
              .title('Librerías asociadas')
              .child(S.documentTypeList('libreria').title('Librerías').defaultOrdering([{ field: 'nombre', direction: 'asc' }])),
          ]),
    }),
    visionTool(),
  ],
  schema: { types: schemaTypes },
});
