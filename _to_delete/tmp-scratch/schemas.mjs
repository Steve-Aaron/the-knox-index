import '../loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery();
for (const [ds, t] of [['ariadne_tiktok_demo','account'],['twitter','account'],['metadata','person']]) {
  try {
    const [md] = await bq.dataset(ds).table(t).getMetadata();
    console.log(`\n=== ${ds}.${t} rows=${md.numRows}`);
    const walk = (f, pre='') => f.forEach(x => {
      console.log(`  ${pre}${x.name}: ${x.type}${x.mode==='REPEATED'?'[]':''}`);
      if (x.fields) walk(x.fields, pre+'  ');
    });
    walk(md.schema.fields);
  } catch (e) { console.log(`\n=== ${ds}.${t} ERROR ${e.message.slice(0,140)}`); }
}
