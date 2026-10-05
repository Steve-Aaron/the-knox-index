import '../loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery();
const [ds] = await bq.getDatasets();
for (const d of ds) {
  const [md] = await d.getMetadata();
  console.log(`${d.id.padEnd(28)} ${md.location}`);
}
