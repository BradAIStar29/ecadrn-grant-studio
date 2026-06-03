import { GoogleGenAI } from '@google/genai';

export interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  GOOGLE_DRIVE_TOKEN?: string; // Optional: set via Cloudflare secret for server-side Drive access
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function getPrompt(action: string, data: any): string {
  switch (action) {
    case 'generate-draft':
      return `You are an expert nonprofit grant writer with deep experience in Alternative Dispute Resolution, conflict resolution, access to justice, and civic equity funding.

TASK: Write a complete 9-section grant proposal for the organization below, tailored precisely to the grant opportunity provided.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile)}

GRANT OPPORTUNITY:
Title: ${data.grantTitle}
Funder: ${data.funderName}
Funder type: ${data.funderType}
Description: ${data.grantDescription}
Focus areas: ${data.focusAreas}
Award range: $${data.amountMin}–$${data.amountMax}
Eligibility: ${data.eligibility}
Geographic focus: ${data.geographicFocus}

VOICE PROFILE:
Tone descriptors: ${data.toneDescriptors}
Characteristic phrases: ${data.keyPhrases}
Writing style rules: ${data.voiceRules}
Sample sentences: ${data.writingSamples}

REQUIREMENTS:
- Each section MUST be substantive, specific, and directly address the funder's stated priorities
- Ground every claim in the org's actual programs, populations, and work
- Apply the voice profile throughout — NEVER use vague filler
- Goals must be SMART; Evaluation plan must reference concrete metrics
- Budget narrative must align with project description activities

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "executiveSummary": "string",
  "needStatement": "string",
  "projectDescription": "string",
  "goalsObjectives": "string",
  "methodology": "string",
  "evaluationPlan": "string",
  "sustainability": "string",
  "organizationalCapacity": "string",
  "budgetNarrative": "string"
}`;

    case 'research-funder':
      return `You are a nonprofit fundraising strategist specializing in foundation research and ADR/conflict resolution sector funding.

TASK: Generate a comprehensive strategic intelligence report on the funder below.

FUNDER:
Name: ${data.funderName}
Website: ${data.funderWebsite}
Primary contact: ${data.contactName}
Relationship stage: ${data.relationshipStage}
Notes: ${data.funderNotes}

APPLYING ORGANIZATION:
${JSON.stringify(data.orgProfile)}

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "funderOverview": "string",
  "funderType": "Foundation | Corporation | University | Government | Community Foundation",
  "givingPriorities": ["string"],
  "typicalGrantees": ["string"],
  "fundingRanges": "string",
  "geographicFocus": "string",
  "applicationProcess": "string",
  "missionAlignmentScore": number,
  "missionAlignmentRationale": "string",
  "recentStrategicShifts": "string",
  "whatTheyDontFund": ["string"],
  "applicationTips": ["string"],
  "recommendedApproach": "string"
}`;

    case 'discover-grants':
      return `You are a nonprofit grants researcher specializing in ADR, conflict resolution, access to justice, restorative justice, and civic equity funding.

TASK: Identify ${data.count || 5} active grant opportunities that are a strong mission fit for the organization below.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile)}

SEARCH PARAMETERS:
Focus areas: ${data.focusAreas}
Geographic scope: ${data.geographicFocus}
Preferred award range: $${data.amountMin}–$${data.amountMax}
Additional guidance: ${data.searchQuery}

OUTPUT FORMAT — Respond ONLY with a valid JSON array. No preamble. No markdown fences.
[{
  "title": "string",
  "funderName": "string",
  "funderType": "foundation | government | corporate | community_foundation",
  "description": "string",
  "focusAreas": ["string"],
  "geographicFocus": "string",
  "amountMin": number,
  "amountMax": number,
  "deadline": "YYYY-MM-DD or null",
  "url": "string or null",
  "eligibility": "string",
  "missionFitScore": number,
  "missionFitRationale": "string",
  "verified": true
}]`;

    case 'review-proposal':
      return `You are a senior grants review officer with expertise evaluating nonprofit proposals.

TASK: Conduct a comprehensive fundability audit of the grant proposal below.

GRANT OPPORTUNITY:
Title: ${data.grantTitle}
Funder: ${data.funderName}
Funder priorities: ${data.grantDescription}

PROPOSAL:
${JSON.stringify(data.proposal)}

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "overallScore": number,
  "verdict": "string",
  "strengths": ["string"],
  "redFlags": ["string"],
  "priorityRevisions": ["string"],
  "sections": {
    "executiveSummary": { "score": number, "feedback": "string", "fix": "string" },
    "needStatement": { "score": number, "feedback": "string", "fix": "string" },
    "projectDescription": { "score": number, "feedback": "string", "fix": "string" },
    "goalsObjectives": { "score": number, "feedback": "string", "fix": "string" },
    "methodology": { "score": number, "feedback": "string", "fix": "string" },
    "evaluationPlan": { "score": number, "feedback": "string", "fix": "string" },
    "sustainability": { "score": number, "feedback": "string", "fix": "string" },
    "organizationalCapacity": { "score": number, "feedback": "string", "fix": "string" },
    "budgetNarrative": { "score": number, "feedback": "string", "fix": "string" }
  }
}`;

    case 'chat':
      return `You are ECADRN's AI Grant Advisor — a knowledgeable, strategic, and direct grants management partner for the Early Career ADR Network.

ORGANIZATION CONTEXT:
${JSON.stringify(data.orgProfile)}

PIPELINE SUMMARY:
${JSON.stringify(data.pipelineSummary)}

USER MESSAGE:
${data.userMessage}

Respond conversationally and helpfully.`;

    case 'analyze-voice':
      return `You are a linguist and brand analyst specializing in nonprofit organizational identity.

TASK: Analyze the writing samples provided to extract a definitive voice profile.

CONTENT:
${data.content}

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "toneDescriptors": ["string"],
  "keyPhrases": ["string"],
  "voiceRules": ["string"],
  "writingSamples": ["string"],
  "maturityScore": number
}`;

    case 'generate-budget':
      return `You are a nonprofit financial strategist specializing in grant budgets.

TASK: Generate a realistic itemized budget for this grant proposal.

PROJECT DESCRIPTION:
${data.projectDescription}

AWARD RANGE: $${data.amountMin}–$${data.amountMax}

OUTPUT FORMAT — Respond ONLY with a valid JSON array. No preamble. No markdown fences.
[{
  "category": "string",
  "description": "string",
  "amount": number,
  "justification": "string"
}]`;


    case 'autopilot-search':
      return `You are an expert grant researcher for the Early Career ADR Network (ECADRN).

TASK: Search for and identify the TOP 5 most fundable grant opportunities for this organization RIGHT NOW.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile)}

VOICE & FOCUS AREAS: ${data.focusAreas || 'ADR, conflict resolution, civic equity, early career professional development'}

For each grant, assess realistic fit based on:
- Mission alignment with ADR, mediation, access to justice, civic equity
- Organization size and stage (early-career professional network)
- Geographic scope (national/international)
- Typical award range $20,000–$200,000

OUTPUT FORMAT — Respond ONLY with this exact JSON array. No preamble. No markdown fences.
[{
  "title": "string",
  "funderName": "string",
  "funderType": "Foundation | Government | Corporate",
  "description": "string (2-3 sentences on why this is a strong match)",
  "focusAreas": ["string"],
  "amountMin": number,
  "amountMax": number,
  "deadline": "string (e.g. Rolling, March 2026, or specific date)",
  "geographicFocus": "string",
  "eligibility": "string",
  "matchScore": number,
  "matchReason": "string (1-2 sentences)"
}]`;

    default:
      return 'INVALID';
  }
}

// ── Firebase token verification ─────────────────────────────────────────────

async function verifyFirebaseToken(token: string, projectId: string): Promise<{ email: string; uid: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    if (payload.exp < Date.now() / 1000) return null;
    if (payload.aud !== projectId) return null;

    const email: string = payload.email || '';
    if (!email.endsWith('@ecadrn.org')) return null;

    const keysRes = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    const keys: Record<string, string> = await keysRes.json();
    const certPem = keys[header.kid];
    if (!certPem) return null;

    const certDer = pemToDer(certPem);
    const cryptoKey = await crypto.subtle.importKey(
      'spki', certDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    );

    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlDecode(parts[2]);

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', cryptoKey, signature,
      new TextEncoder().encode(signingInput)
    );

    return valid ? { email, uid: payload.sub } : null;
  } catch {
    return null;
  }
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s/g, '');
  return base64UrlDecode(b64, true);
}

function base64UrlDecode(str: string, standard = false): ArrayBuffer {
  let b64 = standard ? str : str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Google Drive helpers ─────────────────────────────────────────────────────

async function driveRequest(path: string, options: RequestInit, token: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return res;
}

// ── Main handler ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || 'https://bradaistar29.github.io';

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Drive-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // Verify Firebase auth token
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const firebaseToken = authHeader.slice(7);
    const user = await verifyFirebaseToken(firebaseToken, env.FIREBASE_PROJECT_ID);
    if (!user) {
      return json({ error: 'Forbidden: @ecadrn.org accounts only' }, 403);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── AI Routes ──────────────────────────────────────────────────────────
    if (path.startsWith('/ai/')) {
      const action = path.replace('/ai/', '');
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

      const body = await request.json() as any;
      const prompt = getPrompt(action, body);
      if (prompt === 'INVALID') return json({ error: `Unknown action: ${action}` }, 400);

      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const text = result.text?.trim() || '';
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

      try {
        return json(JSON.parse(cleaned));
      } catch {
        return json({ raw: cleaned });
      }
    }

    // ── Google Drive Routes ────────────────────────────────────────────────
    // Drive token is passed in X-Drive-Token header (user's OAuth token from frontend)
    const driveToken = request.headers.get('X-Drive-Token');

    if (path === '/drive/files' && request.method === 'POST') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);
      const body = await request.json() as any;

      let q = "trashed=false";
      if (body.folderId) q += ` and '${body.folderId}' in parents`;
      if (body.query) q += ` and (name contains '${body.query}' or fullText contains '${body.query}')`;
      // Only docs, sheets, plain text, and PDFs
      q += " and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='text/plain' or mimeType='application/pdf')";

      const params = new URLSearchParams({
        q,
        fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,parents),nextPageToken',
        pageSize: String(body.pageSize || 20),
        orderBy: 'modifiedTime desc',
      });
      if (body.pageToken) params.set('pageToken', body.pageToken);

      const res = await driveRequest(`/files?${params}`, { method: 'GET' }, driveToken);
      if (!res.ok) return json({ error: 'Drive API error', details: await res.text() }, res.status);
      return json(await res.json());
    }

    if (path.match(/^\/drive\/file\/[^/]+\/content$/) && request.method === 'GET') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);
      const fileId = path.split('/')[3];

      // First get metadata to check mime type
      const metaRes = await driveRequest(`/files/${fileId}?fields=mimeType,name`, { method: 'GET' }, driveToken);
      if (!metaRes.ok) return json({ error: 'File not found' }, 404);
      const meta = await metaRes.json() as any;

      let content = '';
      if (meta.mimeType === 'application/vnd.google-apps.document') {
        // Export Google Doc as plain text
        const exportRes = await driveRequest(`/files/${fileId}/export?mimeType=text/plain`, { method: 'GET' }, driveToken);
        if (!exportRes.ok) return json({ error: 'Export failed' }, 500);
        content = await exportRes.text();
      } else if (meta.mimeType === 'text/plain') {
        const dlRes = await driveRequest(`/files/${fileId}?alt=media`, { method: 'GET' }, driveToken);
        if (!dlRes.ok) return json({ error: 'Download failed' }, 500);
        content = await dlRes.text();
      } else {
        content = `[File: ${meta.name} — binary content cannot be displayed as text]`;
      }

      return json({ content, name: meta.name, mimeType: meta.mimeType });
    }

    if (path === '/drive/folders' && request.method === 'GET') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);
      const params = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id,name)',
        pageSize: '50',
        orderBy: 'name',
      });
      const res = await driveRequest(`/files?${params}`, { method: 'GET' }, driveToken);
      if (!res.ok) return json({ error: 'Drive API error' }, res.status);
      const data = await res.json() as any;
      return json({ folders: data.files || [] });
    }

    if (path === '/drive/export' && request.method === 'POST') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);
      const body = await request.json() as any;

      // Build document content as plain text
      const sections = body.sections || [];
      let docContent = `${body.title}\nFor: ${body.funder}\n\n`;
      sections.forEach((s: any) => {
        docContent += `${s.title.toUpperCase()}\n\n`;
        // Strip HTML tags
        docContent += s.content.replace(/<[^>]*>/g, '') + '\n\n';
      });

      if (body.budget && body.budget.length > 0) {
        docContent += 'BUDGET\n\n';
        body.budget.forEach((item: any) => {
          docContent += `${item.category}: $${item.amount?.toLocaleString()} — ${item.description}\n`;
        });
      }

      // Create the Google Doc via Drive API
      const metadata = {
        name: `${body.title} — ${body.funder}`,
        mimeType: 'application/vnd.google-apps.document',
        ...(body.folderId ? { parents: [body.folderId] } : {}),
      };

      // Upload as multipart: metadata + plain text content
      const boundary = '-------314159265358979323846';
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        docContent,
        `--${boundary}--`,
      ].join('\r\n');

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${driveToken}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body: multipart,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        return json({ error: 'Export to Drive failed', details: errText }, uploadRes.status);
      }

      return json(await uploadRes.json());
    }

    return json({ error: 'Not found' }, 404);
  },
};
