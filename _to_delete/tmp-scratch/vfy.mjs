import { query, metadata } from '../bqClient.mjs';
console.log(await query(`SELECT photo_source, COUNT(*) n FROM ${metadata('person_photo')} GROUP BY 1`));
console.log(await query(`SELECT COUNT(*) n FROM ${metadata('person_photo')} WHERE x_photo IS NOT NULL`));
