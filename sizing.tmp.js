const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
const q = s => bq.query({location:'EU', query:s}).then(([r])=>r);
(async()=>{
 console.log(JSON.stringify(await q(`
   WITH typed AS (
     SELECT CAST(a.id AS STRING) id,
            STRING_AGG(t.name ORDER BY t.name) types
     FROM \`project-ariadne.ariadne_tiktok_demo.account\` a
     LEFT JOIN \`project-ariadne.ariadne_tiktok_demo.account_x_accountType\` x ON CAST(x.accountId AS STRING)=CAST(a.id AS STRING)
     LEFT JOIN \`project-ariadne.ariadne_tiktok_demo.accountType\` t ON x.accountTypeId=t.id
     GROUP BY 1)
   SELECT
     COUNT(*) totalAccounts,
     COUNTIF(types IS NULL) noType,
     COUNTIF(types LIKE '%political_party%') orgLike,
     COUNTIF(types IS NOT NULL AND types NOT LIKE '%political_party%') personLike
   FROM typed`), null, 1));
 console.log('table write check (last modified):', JSON.stringify((await bq.dataset('ariadne_tiktok_demo').table('account').getMetadata())[0].lastModifiedTime));
})().catch(e=>console.error('ERR', e.message));
