import './scripts/metadata/loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery({ projectId: 'project-ariadne', keyFilename: './keys/project-ariadne-service-account.json' });
const table = bq.dataset('metadata').table('person');
const [md] = await table.getMetadata();
const loc = md.schema.fields.find(f => f.name === 'location');
if (!loc.fields.some(f => f.name === 'latitude')) {
  loc.fields.push(
    { name: 'latitude',  type: 'FLOAT', description: 'Country centroid, degrees. Drives the globe' },
    { name: 'longitude', type: 'FLOAT', description: 'Country centroid, degrees. Drives the globe' },
  );
  await table.setMetadata({ schema: md.schema });
}
const [after] = await table.getMetadata();
console.log('location fields now:',
  after.schema.fields.find(f => f.name === 'location').fields.map(f => `${f.name}:${f.type}`).join(', '));
