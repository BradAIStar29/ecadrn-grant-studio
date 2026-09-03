// Deadline Scanner — queries Firestore for grants with deadlines within the next 7 days
// and writes the result to the `alerts` branch as alerts/deadlines.json.
// Run daily by .github/workflows/deadline-alerts.yml (WIF-authenticated).

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0456143672';
const DB_ID = process.env.FIREBASE_DB_ID || 'ai-studio-bad18069-1a94-4ead-b188-10dcbdd2eee2';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ No ACCESS_TOKEN — WIF auth failed.');
  process.exit(1);
}

async function runQuery(structuredQuery) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB_ID}/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore runQuery ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// Walk documents of a collection (paginated list API)
async function listAll(collectionId) {
  const docs = [];
  let pageToken = null;
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB_ID}/documents/${collectionId}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Firestore list ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = await res.json();
    (data.documents || []).forEach(d => docs.push(d));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

function fieldValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fieldValue);
  if (v.mapValue) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = fieldValue(val);
    return out;
  }
  return null;
}

function docToGrant(d) {
  const fields = d.fields || {};
  const g = {};
  for (const [k, v] of Object.entries(fields)) g[k] = fieldValue(v);
  g._name = (d.name || '').split('/').pop();
  g._path = d.name || '';
  return g;
}

async function main() {
  // Find all org IDs by listing the organizations collection
  const orgs = await listAll('organizations');
  const orgIds = orgs.map(o => (o.name || '').split('/').pop());
  console.log(`Found organizations: ${orgIds.join(', ') || '(none)'}`);

  const allGrants = [];
  for (const orgId of orgIds) {
    const grants = await listAll(`organizations/${orgId}/grants`);
    for (const d of grants) {
      const g = docToGrant(d);
      g.orgId = orgId;
      allGrants.push(g);
    }
    console.log(`  ${orgId}: ${grants.length} grants`);
  }

  // Filter: deadline within next 7 days (inclusive)
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const urgent = allGrants
    .filter(g => {
      const raw = g.deadline || g.applicationDeadline;
      if (!raw || typeof raw !== 'string') return false;
      // Accept YYYY-MM-DD (or full ISO); reject "Rolling"/"Varies"
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      return d >= now && d <= horizon;
    })
    .map(g => {
      const d = new Date(g.deadline || g.applicationDeadline);
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      return {
        grantTitle: g.title || g.grantTitle || 'Untitled grant',
        funderName: g.funderName || g.funder || 'Unknown funder',
        deadline: (g.deadline || g.applicationDeadline).slice(0, 10),
        daysLeft,
        url: g.url || null,
        matchScore: g.ecadrnAlignmentScore ?? g.matchScore ?? null,
        orgId: g.orgId,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const payload = {
    generatedAt: new Date().toISOString(),
    scanned: allGrants.length,
    urgentCount: urgent.length,
    urgent,
  };

  const fs = await import('fs');
  fs.mkdirSync('alerts', { recursive: true });
  fs.writeFileSync('alerts/deadlines.json', JSON.stringify(payload, null, 2));
  console.log(`✅ Scanned ${allGrants.length} grants — ${urgent.length} due within 7 days.`);
  console.log(urgent.map(u => `   ${u.daysLeft}d: ${u.grantTitle} (${u.funderName})`).join('\n'));
}

main().catch(err => {
  console.error('❌ Deadline scan failed:', err.message);
  if (String(err.message).includes('403')) {
    console.error('HINT: The github-deployer service account likely lacks Firestore data read access.');
    console.error('Grant it: gcloud projects add-iam-policy-binding gen-lang-client-0456143672 --member="serviceAccount:github-deployer@gen-lang-client-0456143672.iam.gserviceaccount.com" --role="roles/datastore.user"');
  }
  process.exit(1);
});
