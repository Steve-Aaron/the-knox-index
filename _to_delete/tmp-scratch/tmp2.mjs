import { query, metadata } from './bqClient.mjs';
console.log(await query(`SELECT person_id, slug, name, display_job_title, location.country, location.region,
  location.latitude, location.longitude, source_platform, source_account_id, created_by
  FROM ${metadata('person')} WHERE source_platform != 'tiktok'`));
console.log(await query(`SELECT platform, platform_handle, status, person_id, reviewed_by
  FROM ${metadata('account_link')} WHERE platform_account_id = '4826781063'`));
console.log(await query(`SELECT p.name, ph.photo_source, ph.photo_url IS NOT NULL AS has_photo
  FROM ${metadata('person_photo')} ph JOIN ${metadata('person')} p USING (person_id)
  WHERE p.source_platform != 'tiktok'`));
