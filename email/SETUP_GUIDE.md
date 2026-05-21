# The Knox Index — Brevo + n8n Email Pipeline Setup

This guide takes you from zero to a working automated daily briefing: BigQuery data → n8n → Brevo transactional email → consented subscribers.

---

## Architecture

```
8:00AM schedule
     ↓
n8n workflow
     ├─ BigQuery: fetch today's top 5 posts
     ├─ Code node: build params object
     ├─ HTTP: GET consented contacts from Brevo (PERM_DAILY = 'yes')
     └─ Loop: for each contact → POST /smtp/email to Brevo
                                  (templateId + params + contact.FIRSTNAME)
```

Emails are sent as **transactional** (not campaigns), so each recipient gets a properly personalised send with per-contact `FIRSTNAME` merge and full delivery tracking.

---

## Step 1 — Check your contact attributes in Brevo

Your signup flow already creates the right attributes. Verify they exist:

1. Log in to Brevo → **Contacts** → **Settings** (gear icon) → **Contact attributes**
2. Confirm these exist (create any that are missing):

| Attribute name | Type   | Notes |
|----------------|--------|-------|
| `FIRSTNAME`    | Text   | Populated from signup |
| `LASTNAME`     | Text   | Populated from signup |
| `COMPANY`      | Text   | Populated from signup |
| `SEGMENT`      | Text   | e.g. 'Political consultant' |
| `INTERESTS`    | Text   | Comma-separated interests |
| `PERM_DAILY`   | Text   | `'yes'` = consented to daily briefing ← **the key one** |
| `PERM_REPORT`  | Text   | `'yes'` = consented to product reports |
| `PERM_WIDER`   | Text   | `'yes'` = consented to Knox Digital contact |
| `SOURCE`       | Text   | e.g. 'TKI signup page' |

> Note: `PERM_DAILY` (not `CONSENT_DAILY_BRIEFING`) is the attribute your signup API writes. Value is the string `'yes'` or `'no'`.

---

## Step 2 — Upload the email template to Brevo

Run this once from the project root:

```bash
node email/scripts/brevo-upload-template.mjs
```

This will:
- Upload `email/briefing_template.html` to Brevo → Transactional → Templates
- Print the new **template ID** — you'll need this in Step 4

To update the template after changes: set `EXISTING_TEMPLATE_ID` at the top of that script to the printed ID, then re-run.

After uploading, add to `.env.local` and Vercel project settings:

```
BREVO_BRIEFING_TEMPLATE_ID=<id from above>
```

---

## Step 3 — Get the list of consented contacts (now)

```bash
node email/scripts/brevo-contacts.mjs
```

Prints a table of everyone with `PERM_DAILY = 'yes'` and saves `email/scripts/consented-contacts.csv`.

---

## Step 4 — Build the n8n workflow

### Trigger node
- **Type:** Schedule
- **Time:** 08:00 every day (Mon–Fri if weekday only)
- Cron: `0 8 * * 1-5`

---

### Node 1 — BigQuery: fetch today's top posts

**Type:** Google BigQuery node (or HTTP Request to BigQuery REST API)

Query (adjust your dataset/project name):

```sql
WITH ranked AS (
  SELECT
    displayName         AS name,
    uniqueId            AS profile,
    party,
    videoSummary        AS summary,
    videoUrl            AS url,
    thumbnailUrl        AS thumbnail_url,
    CAST(playCount AS INT64)        AS views,
    ROUND(viralityScore, 1)         AS virality,
    ROUND(engagementRate * 100, 1)  AS eng_rate,
    CAST(diggCount AS INT64)        AS likes,
    CAST(commentCount AS INT64)     AS comments,
    CAST(collectCount AS INT64)     AS saves,
    DATE(createTime)                AS post_date,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(createTime)
      ORDER BY playCount DESC
    ) AS views_rank,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(createTime)
      ORDER BY viralityScore DESC
    ) AS virality_rank,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(createTime)
      ORDER BY engagementRate DESC
    ) AS eng_rank
  FROM `your-project.tki_data.posts`
  WHERE DATE(createTime) = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
),
top_3_views AS (
  SELECT *, 'views' AS selection_reason FROM ranked WHERE views_rank <= 3
),
most_viral AS (
  SELECT *, 'viral' AS selection_reason FROM ranked
  WHERE virality_rank = 1
  AND NOT EXISTS (SELECT 1 FROM top_3_views t WHERE t.profile = ranked.profile AND t.post_date = ranked.post_date)
),
highest_eng AS (
  SELECT *, 'engagement' AS selection_reason FROM ranked
  WHERE eng_rank = 1
  AND NOT EXISTS (SELECT 1 FROM top_3_views t WHERE t.profile = ranked.profile AND t.post_date = ranked.post_date)
  AND NOT EXISTS (SELECT 1 FROM most_viral t WHERE t.profile = ranked.profile AND t.post_date = ranked.post_date)
)
SELECT * FROM top_3_views
UNION ALL SELECT * FROM most_viral
UNION ALL SELECT * FROM highest_eng
ORDER BY views_rank
```

---

### Node 2 — Code node: build params

**Type:** Code (JavaScript)

```javascript
const rows = $input.all().map(i => i.json);

// Sort: top 3 views first, then viral, then engagement
const byViews    = rows.filter(r => r.selection_reason === 'views').sort((a,b) => a.views_rank - b.views_rank);
const viral      = rows.find(r => r.selection_reason === 'viral');
const highestEng = rows.find(r => r.selection_reason === 'engagement');

const posts = [...byViews, viral, highestEng].filter(Boolean);

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function fmtVirality(v) { return v ? `${Number(v).toFixed(1)}×` : '—'; }
function fmtEng(v)      { return v ? `${Number(v).toFixed(1)}%` : '—'; }

// Bar fill % (relative to the most-viewed post)
const maxViews = Math.max(...posts.map(p => p.views ?? 0), 1);
function viewsPct(v) { return Math.round((v / maxViews) * 100); }

const categories = [
  'MOST VIEWED', '2ND MOST VIEWED', '3RD MOST VIEWED', 'MOST VIRAL', 'HIGHEST ENGAGEMENT'
];

// Top performer: post 1 (most viewed overall)
const top = posts[0] ?? {};
const rawEng = parseFloat(top.eng_rate ?? 0);
const topEngPct = Math.min(Math.round(rawEng / 10 * 100), 100);

const today = new Date();
const briefingDate = today.toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

const params = {
  BRIEFING_DATE:  briefingDate,
  PREVIEW_TEXT:   `${top.name ?? 'Today'}: ${fmt(top.views ?? 0)} views — plus today's top 5 political TikTok posts.`,
  INTRO_SUMMARY:  `Here's your daily intelligence on UK politicians' TikTok performance for ${briefingDate}.`,
  WEEKLY_SUMMARY: 'Weekly context updated each Monday.',

  // Top performer
  TOP_NAME:     top.name     ?? '',
  TOP_PROFILE:  top.profile  ?? '',
  TOP_PARTY:    top.party    ?? '',
  TOP_VIEWS:    fmt(top.views),
  TOP_ENG_RATE: fmtEng(top.eng_rate),
  TOP_VIRALITY: fmtVirality(top.virality),
  TOP_ENG_PCT:  String(topEngPct),
};

// Per-post params
posts.forEach((p, i) => {
  const n = i + 1;
  params[`POST${n}_CATEGORY`]  = categories[i] ?? `#${n}`;
  params[`POST${n}_NAME`]      = p.name     ?? '';
  params[`POST${n}_PROFILE`]   = p.profile  ?? '';
  params[`POST${n}_PARTY`]     = p.party    ?? '';
  params[`POST${n}_SUMMARY`]   = p.summary  ?? '';
  params[`POST${n}_VIEWS`]     = fmt(p.views);
  params[`POST${n}_VIRALITY`]  = fmtVirality(p.virality);
  params[`POST${n}_ENG_RATE`]  = fmtEng(p.eng_rate);
  params[`POST${n}_VIEWS_PCT`] = String(viewsPct(p.views ?? 0));
  params[`POST${n}_URL`]       = p.url           ?? '#';
  params[`POST${n}_THUMBNAIL_URL`] = p.thumbnail_url ?? '';
  params[`POST${n}_LIKES`]     = fmt(p.likes);
  params[`POST${n}_COMMENTS`]  = fmt(p.comments);
  params[`POST${n}_SAVES`]     = fmt(p.saves);
});

return [{ json: { params } }];
```

---

### Node 3 — HTTP Request: get consented contacts

**Type:** HTTP Request

- **Method:** GET
- **URL:** `https://api.brevo.com/v3/contacts`
- **Query parameters:**
  - `limit` → `500`
  - `offset` → `0`
  - `sort` → `desc`
- **Headers:**
  - `api-key` → `{{ $env.BREVO_API_KEY }}`
  - `Accept` → `application/json`

> For over 500 contacts you'll need to paginate. Add a Loop node with offset increments.
> For now, 500 is more than sufficient.

After this node, add a **Code node** to filter:

```javascript
const contacts = $input.first().json.contacts ?? [];
const consented = contacts.filter(c => {
  const p = c.attributes?.PERM_DAILY;
  return p === 'yes' || p === 'YES';
});
return consented.map(c => ({ json: c }));
```

---

### Node 4 — Split in Batches (loop per contact)

**Type:** Split In Batches
- **Batch size:** 1

---

### Node 5 — HTTP Request: send email per contact

**Type:** HTTP Request

- **Method:** POST
- **URL:** `https://api.brevo.com/v3/smtp/email`
- **Headers:**
  - `api-key` → `{{ $env.BREVO_API_KEY }}`
  - `Content-Type` → `application/json`
- **Body (JSON):**

```json
{
  "templateId": {{ $env.BREVO_BRIEFING_TEMPLATE_ID }},
  "to": [
    {
      "email": "{{ $json.email }}",
      "name": "{{ $json.attributes.FIRSTNAME ?? '' }} {{ $json.attributes.LASTNAME ?? '' }}"
    }
  ],
  "params": {{ JSON.stringify($('Code node — build params').first().json.params) }}
}
```

> Brevo transactional templates automatically merge `contact.FIRSTNAME` from the recipient — you don't need to pass it in `params`.

---

### Node 6 — Error handling (optional but recommended)

After Node 5, add an **If** node:
- **Condition:** `{{ $json.messageId }}` exists → success branch
- **Else:** log to a Slack channel or append to a BigQuery error log

---

## Step 5 — Environment variables

Add to n8n's environment (Settings → Variables):

```
BREVO_API_KEY                = xkeysib-...
BREVO_BRIEFING_TEMPLATE_ID   = <id from Step 2>
```

---

## Step 6 — Test before going live

1. In n8n, **manually trigger** the workflow
2. In the filter code node, temporarily replace the filter with your own email address:
   ```javascript
   return [{ json: { email: 'steve@knoxdigi.com', attributes: { FIRSTNAME: 'Steve' } } }];
   ```
3. Check the email arrives correctly with real BigQuery data
4. Remove the override and trigger again to confirm the full contact loop works
5. Switch the trigger to active

---

## Sending limits & rate limits

| Concern | Detail |
|---------|--------|
| Brevo free tier | 300 emails/day. Paid plans from £19/mo for 20K/mo |
| API rate limit | 400 requests/min — safe for up to 400 contacts/send |
| Transactional vs campaign | This setup uses transactional. Brevo does not count transactional sends against unsubscribe opt-out the same way — but you must still respect `PERM_DAILY = 'no'` |
| Deliverability | Brevo handles SPF/DKIM automatically on shared IPs. Custom domain sending (from `@knoxindex.com`) requires DNS setup in Brevo → Senders & IPs |

---

## Quick reference: Brevo API endpoints used

| Action | Endpoint |
|--------|----------|
| Get all contacts | `GET /v3/contacts?limit=500` |
| Create/update contact | `POST /v3/contacts` |
| Send transactional email | `POST /v3/smtp/email` |
| Upload template | `POST /v3/smtp/templates` |
| Update template | `PUT /v3/smtp/templates/{id}` |
| List templates | `GET /v3/smtp/templates` |
| Get contact attributes | `GET /v3/contacts/attributes` |
