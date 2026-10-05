const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery({projectId:'project-ariadne', keyFilename:'./keys/project-ariadne-1594cc65a2ed.json'});
const show = async (ds, t) => {
  const [md] = await bq.dataset(ds).table(t).getMetadata();
  console.log(`\n${ds}.${t}  (${md.numRows} rows)`);
  console.log('  ' + md.schema.fields.map(f => `${f.name}:${f.type}`).join(', '));
};
(async()=>{
 for (const [ds,t] of [['metadata','topic'],['metadata','hook'],['metadata','post_x_hook'],['twitter','account'],['twitter','post']]) {
   try { await show(ds,t); } catch(e){ console.log(ds+'.'+t, 'ERR', e.message.slice(0,80)); }
 }
})();
