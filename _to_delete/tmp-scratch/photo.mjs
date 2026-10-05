import { query, metadata } from '../bqClient.mjs';
console.log(await query(`SELECT COUNT(*) people, COUNTIF(photo_url IS NOT NULL) with_photo,
  COUNTIF(photo_source='tiktok') from_tiktok, COUNTIF(photo_source='x') from_x,
  COUNTIF(x_photo IS NOT NULL) have_x_photo
  FROM ${metadata('person_photo')}`));
console.log(await query(`SELECT platform, status, confidence, COUNT(*) n
  FROM ${metadata('account_link')} GROUP BY 1,2,3 ORDER BY 1,2,4 DESC`));
