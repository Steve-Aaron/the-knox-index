const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
const SQL = `
  SELECT COUNT(*) n
  FROM \`project-ariadne.ariadne_tiktok_demo.account\` a
  CROSS JOIN (SELECT id FROM \`project-ariadne.metadata.topic\` LIMIT 1) t`;
(async () => {
  for (const loc of ['EU', 'europe-west2', null]) {
    try {
      const [rows] = await bq.query(loc ? { query: SQL, location: loc } : { query: SQL });
      console.log(`location=${loc ?? '(auto)'} -> OK ${JSON.stringify(rows)}`);
    } catch (e) {
      console.log(`location=${loc ?? '(auto)'} -> ${e.message.split('\n')[0].slice(0, 170)}`);
    }
  }
})();
