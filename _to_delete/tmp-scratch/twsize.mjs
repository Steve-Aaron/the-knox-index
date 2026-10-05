import '../loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery();
for (const dsId of ['twitter','conference_twitter']) {
  const [tables] = await bq.dataset(dsId).getTables();
  let tot=0;
  console.log(`\n=== ${dsId} (${tables.length} tables)`);
  for (const t of tables) {
    const [md] = await t.getMetadata();
    const mb = Number(md.numBytes||0)/1048576;
    tot += mb;
    console.log(`  ${t.id.padEnd(34)} ${String(md.numRows||0).padStart(10)} rows  ${mb.toFixed(1)} MB  ${md.type}`);
  }
  console.log(`  TOTAL ${tot.toFixed(1)} MB`);
}
