const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async()=>{
 try { await bq.dataset('metadata').delete({ force: true }); console.log('deleted metadata (europe-west2)'); }
 catch (e) { console.log('delete failed ->', e.message.split('\n')[0].slice(0,220)); }
})();
