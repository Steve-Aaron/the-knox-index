import './scripts/metadata/loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery({ projectId: 'project-ariadne', keyFilename: './keys/project-ariadne-service-account.json' });
// The globe needs coordinates. Can we add nested fields to the STRUCT in place?
try {
  await bq.query({ location: 'EU', query: `
    ALTER TABLE \`project-ariadne.metadata.person\`
      ADD COLUMN IF NOT EXISTS location.latitude  FLOAT64,
      ADD COLUMN IF NOT EXISTS location.longitude FLOAT64` });
  const [md] = await bq.dataset('metadata').table('person').getMetadata();
  const loc = md.schema.fields.find(f => f.name === 'location');
  console.log('location fields now:', loc.fields.map(f => `${f.name}:${f.type}`).join(', '));
} catch (e) {
  console.log('nested ALTER failed ->', e.message.split('\n')[0].slice(0, 160));
}
