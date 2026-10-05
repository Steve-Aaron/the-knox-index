const {BigQuery} = require('@google-cloud/bigquery');
const fs = require('fs');
(async()=>{
 for (const key of ['keys/project-ariadne-service-account.json','keys/project-ariadne-1594cc65a2ed.json']) {
   const email = JSON.parse(fs.readFileSync(key,'utf8')).client_email;
   const bq = new BigQuery({projectId:'project-ariadne', keyFilename:key});
   try { await bq.dataset('metadata').delete({ force: true }); console.log(`${email} -> DELETED metadata (europe-west2)`); return; }
   catch (e) { console.log(`${email} -> ${e.message.split('\n')[0].slice(0,120)}`); }
 }
})();
