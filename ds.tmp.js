const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async()=>{
 const [datasets] = await bq.getDatasets();
 for (const d of datasets) {
   const [md] = await d.getMetadata();
   let tables = [];
   try { const [t] = await d.getTables(); tables = t.map(x=>x.id); } catch {}
   console.log(`${d.id.padEnd(28)} location=${String(md.location).padEnd(6)} tables=${tables.join(', ') || '(none)'}`);
 }
})().catch(e=>console.error('ERR', e.message));
