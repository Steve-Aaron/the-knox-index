const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
const q = s => bq.query({location:'EU', query:s}).then(([r])=>r);
(async()=>{
 console.log('account types across both dashboards:', JSON.stringify(await q(`
   SELECT t.name AS type, COUNT(DISTINCT a.id) AS accounts
   FROM \`project-ariadne.ariadne_tiktok_demo.account\` a
   JOIN \`project-ariadne.ariadne_tiktok_demo.account_x_accountType\` x ON CAST(x.accountId AS STRING)=CAST(a.id AS STRING)
   JOIN \`project-ariadne.ariadne_tiktok_demo.accountType\` t ON x.accountTypeId=t.id
   GROUP BY 1 ORDER BY accounts DESC`)));
})().catch(e=>console.error('ERR', e.message));
