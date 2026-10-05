const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async()=>{
 const [r] = await bq.query({location:'EU', query:`
   SELECT a.affiliation, a.displayJobTitle, COUNT(*) n
   FROM \`project-ariadne.ariadne_tiktok_demo.account\` a
   JOIN \`project-ariadne.ariadne_tiktok_demo.account_x_dashboard\` d ON CAST(d.accountId AS STRING)=CAST(a.id AS STRING)
   WHERE d.dashboardId = 1
   GROUP BY 1,2 ORDER BY n DESC LIMIT 12`});
 console.log(JSON.stringify(r, null, 1));
})();
