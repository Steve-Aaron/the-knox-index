const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async()=>{
 for (const id of ['metadata','metadata_move_test']) {
   try {
     const [md] = await bq.dataset(id).getMetadata();
     const [t]  = await bq.dataset(id).getTables();
     const counts = [];
     for (const tbl of t) {
       const [r] = await bq.query({location: md.location, query:`SELECT COUNT(*) n FROM \`project-ariadne.${id}.${tbl.id}\``});
       counts.push(`${tbl.id}=${r[0].n}`);
     }
     console.log(`${id.padEnd(20)} ${md.location.padEnd(13)} ${counts.join(', ')}`);
   } catch (e) { console.log(`${id.padEnd(20)} absent (${e.message.split('\n')[0].slice(0,60)})`); }
 }
})();
