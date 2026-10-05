const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
(async()=>{
 try {
   const [rows] = await bq.query({location:'EU', query:`
     SELECT job_type, statement_type, write_disposition_hint, COUNT(*) n,
            MAX(creation_time) lastSeen
     FROM \`region-eu\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
     WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
       AND EXISTS (SELECT 1 FROM UNNEST(referenced_tables) rt WHERE rt.table_id = 'account')
     GROUP BY 1,2,3 ORDER BY n DESC LIMIT 20`});
   console.log(JSON.stringify(rows, null, 1));
 } catch (e) { console.log('JOBS metadata not readable:', e.message.slice(0,200)); }
})();
