const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async () => {
  // Scratch dataset in EU, so nothing existing is touched.
  const TMP = 'metadata_move_test';
  try { await bq.createDataset(TMP, { location: 'EU' }); console.log('created scratch dataset', TMP, '(EU)'); }
  catch (e) { console.log('scratch dataset:', e.message.split('\n')[0].slice(0,90)); }

  try {
    const [job] = await bq.dataset('metadata').table('topic')
      .copy(bq.dataset(TMP).table('topic'), { location: 'europe-west2' });
    console.log('cross-region copy job:', job.metadata.status?.state ?? 'done');
    const [rows] = await bq.query({ location:'EU', query:`SELECT COUNT(*) n FROM \`project-ariadne.${TMP}.topic\`` });
    console.log('rows landed in EU:', JSON.stringify(rows));
  } catch (e) {
    console.log('copy failed:', e.message.split('\n')[0].slice(0, 200));
  }
})();
