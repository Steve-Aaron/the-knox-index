import './scripts/metadata/loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery({ projectId: 'project-ariadne', keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
const [rows] = await bq.query({ location: 'EU', query: `
  SELECT a.profile, a.name, a.displayJobTitle
  FROM \`project-ariadne.ariadne_tiktok_demo.account\` a
  WHERE LOWER(a.displayJobTitle) LIKE '%prime minister of the united kingdom%'` });
console.log(JSON.stringify(rows, null, 1));
