const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async () => {
  const TMP = 'metadata_move_test';
  // Copy job submitted in the SOURCE location, destination in EU.
  const [job] = await bq.createJob({
    location: 'europe-west2',
    configuration: { copy: {
      sourceTable:      { projectId:'project-ariadne', datasetId:'metadata',  tableId:'topic' },
      destinationTable: { projectId:'project-ariadne', datasetId:TMP,         tableId:'topic' },
      writeDisposition: 'WRITE_TRUNCATE',
    }},
  }).catch(e => { console.log('submit failed:', e.message.split('\n')[0].slice(0,200)); return []; });

  if (!job) return;
  await job.promise().catch(e => console.log('job failed:', e.message.split('\n')[0].slice(0,200)));
  const [md] = await job.getMetadata();
  console.log('job state:', md.status?.state, md.status?.errorResult?.message ?? '');
  try {
    const [rows] = await bq.query({ location:'EU', query:`SELECT COUNT(*) n FROM \`project-ariadne.${TMP}.topic\`` });
    console.log('rows now readable in EU:', JSON.stringify(rows));
  } catch (e) { console.log('read back failed:', e.message.split('\n')[0].slice(0,140)); }
})();
