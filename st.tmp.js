const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async()=>{
 const [datasets] = await bq.getDatasets();
 for (const d of datasets) {
   const [md] = await d.getMetadata();
   let t = []; try { const [x] = await d.getTables(); t = x.map(i=>i.id); } catch {}
   console.log(`${d.id.padEnd(22)} ${String(md.location).padEnd(13)} ${t.join(', ') || '(none)'}`);
 }
})().catch(e=>console.error('ERR', e.message));
