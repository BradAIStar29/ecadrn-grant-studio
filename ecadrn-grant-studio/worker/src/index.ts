import { GoogleGenAI } from '@google/genai';

export interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
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

    default:
      return 'INVALID';
  }
}

// ── Firebase token verification ─────────────────────────────────────────────

async function verifyFirebaseToken(token: string, projectId: string): Promise<string | null> {
  try {
    // Decode JWT header to get key ID
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    // Check expiry
    if (payload.exp < Date.now() / 1000) return null;
    // Check audience matches project
    if (payload.aud !== projectId) return null;
    // Check email domain
    const email: string = payload.email || '';
    if (!email.endsWith('@ecadrn.org')) return null;

    // Fetch Google's public keys and verify signature
    const keysRes = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    const keys: Record<string, string> = await keysRes.json();
    const certPem = keys[header.kid];
    if (!certPem) return null;

    // Import the certificate and verify
    const certDer = pemToDer(certPem);
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      certDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlDecode(parts[2]);

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      new TextEncoder().encode(signingInput)
    );

    return valid ? email : null;
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

// ── Main handler ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || 'https://bradaistar29.github.io';

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify Firebase auth token
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const email = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
    if (!email) {
      return new Response(JSON.stringify({ error: 'Access restricted to @ecadrn.org accounts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract action from URL path: /ai/generate-draft → generate-draft
    const url = new URL(request.url);
    const action = url.pathname.split('/').filter(Boolean).pop() || '';
    const data = await request.json();

    const promptText = getPrompt(action, data);
    if (promptText === 'INVALID') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isJson = action !== 'chat';

    try {
      const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

      const config = isJson
        ? { responseMimeType: 'application/json' as const, temperature: 0.4, topP: 0.85 }
        : { temperature: 0.7, topP: 0.9 };

      const response = await genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config,
      });

      const text = response.text || '';

      if (isJson) {
        try {
          const parsed = JSON.parse(text);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON from AI', raw: text }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(text, {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
