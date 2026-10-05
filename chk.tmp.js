const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-service-account.json'});
(async()=>{
 const [r] = await bq.query({location:'EU', query:`
   SELECT (SELECT COUNT(*) FROM \`project-ariadne.metadata.person\`) people,
          (SELECT COUNTIF(person_id IS NOT NULL) FROM \`project-ariadne.ariadne_tiktok_demo.account\`) linked`});
 console.log(JSON.stringify(r));
})();
