const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-service-account.json'});
const q = s => bq.query({location:'EU', query:s}).then(([r])=>r);
(async()=>{
 console.log('cross-dataset join (the point of the move):');
 console.log(JSON.stringify(await q(`
   SELECT p.name, p.display_job_title, p.location.country, p.location.region, p.wing, a.profile
   FROM \`project-ariadne.ariadne_tiktok_demo.account\` a
   JOIN \`project-ariadne.metadata.person\` p ON p.person_id = a.person_id
   JOIN \`project-ariadne.ariadne_tiktok_demo.account_x_dashboard\` d ON CAST(d.accountId AS STRING)=CAST(a.id AS STRING)
   WHERE d.dashboardId = 2 ORDER BY a.totalFollowers DESC LIMIT 3`), null, 1));
 console.log('\ntiktok dataset untouched:', JSON.stringify(await q(`
   SELECT (SELECT COUNT(*) FROM \`project-ariadne.ariadne_tiktok_demo.account\`) accounts,
          (SELECT COUNT(*) FROM \`project-ariadne.ariadne_tiktok_demo.post\`) posts,
          (SELECT COUNT(*) FROM \`project-ariadne.ariadne_tiktok_demo.account_x_dashboard\`) memberships`)));
 console.log('metadata now holds:', JSON.stringify(await q(`
   SELECT (SELECT COUNT(*) FROM \`project-ariadne.metadata.person\`) person,
          (SELECT COUNT(*) FROM \`project-ariadne.metadata.topic\`) topic,
          (SELECT COUNT(*) FROM \`project-ariadne.metadata.hook\`) hook`)));
})().catch(e=>console.error('ERR', e.message));
