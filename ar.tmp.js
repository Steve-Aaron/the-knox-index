const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
const q = (s, loc) => bq.query({location:loc, query:s}).then(([r])=>r);
(async()=>{
 console.log('twitter.account ariadneId:', JSON.stringify(await q(`
   SELECT COUNT(*) accounts, COUNT(DISTINCT ariadneId) distinctAriadneId,
          COUNTIF(ariadneId IS NULL) nullAriadneId
   FROM \`project-ariadne.twitter.account\``, 'europe-west2')));
 console.log('sample:', JSON.stringify(await q(`
   SELECT ariadneId, author, name FROM \`project-ariadne.twitter.account\`
   WHERE ariadneId IS NOT NULL ORDER BY ariadneId LIMIT 5`, 'europe-west2')));
 console.log('tiktok.account id sample:', JSON.stringify(await q(`
   SELECT CAST(id AS STRING) id, profile, name FROM \`project-ariadne.ariadne_tiktok_demo.account\` ORDER BY id LIMIT 3`, 'EU')));
 console.log('handles in both platforms (by handle text):', JSON.stringify(await q(`
   SELECT COUNT(*) n FROM \`project-ariadne.twitter.account\` t
   WHERE LOWER(t.author) IN ('keirstarmer','nigel_farage','uklabour')`, 'europe-west2')));
})().catch(e=>console.error('ERR', e.message));
