import '../loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery({ projectId: process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne' });
const q = async (sql, location) => (await bq.query({ query: sql, location }))[0];

const tk = await q(`SELECT id, name, profile, displayName FROM \`project-ariadne.ariadne_tiktok_demo.account\` LIMIT 8`, 'EU');
console.log('TIKTOK:'); console.table(tk);
const tw = await q(`SELECT authorId, author, name, ariadneId, profilePicture IS NOT NULL AS haspic FROM \`project-ariadne.twitter.account\` LIMIT 8`, 'europe-west2');
console.log('TWITTER:'); console.table(tw);
const cnt = await q(`SELECT COUNT(*) n, COUNTIF(ariadneId IS NOT NULL) linked, COUNTIF(profilePicture IS NOT NULL) pics FROM \`project-ariadne.twitter.account\``, 'europe-west2');
console.log(cnt);
const tkpic = await q(`SELECT COUNT(*) n, COUNTIF(avatar IS NOT NULL AND avatar != '') pics, COUNTIF(rawAvatarLink IS NOT NULL AND rawAvatarLink != '') raw FROM \`project-ariadne.ariadne_tiktok_demo.account\``, 'EU');
console.log(tkpic);
