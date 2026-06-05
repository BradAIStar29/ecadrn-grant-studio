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


    case 'research-grant-url':
      return `You are a nonprofit grants researcher and web analyst. The user has provided a grant opportunity name and/or URL.

TASK: Based on the grant name and any URL context provided, generate a comprehensive intelligence report on this specific grant opportunity — as if you researched its official program page.

GRANT NAME: \${data.grantName}
GRANT URL: \${data.grantUrl || 'Not provided'}
ADDITIONAL CONTEXT: \${data.additionalContext || 'None'}

APPLYING ORGANIZATION — ECADRN:
Mission: Supports early-career ADR professionals through structural equity, trauma-informed mediation, peer networks, access to justice, restorative circle spaces, and professional empowerment.
Programs: ADR Fellowship, Peer Mediation Circles, Justice Access Lab, Early Career Mentorship Network

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
{
  "grantTitle": "string",
  "funderName": "string",
  "funderType": "Foundation | Government | Corporation | Community Foundation | University",
  "description": "2-3 sentence overview of what this grant funds",
  "missionStatement": "string — funder's stated mission",
  "focusAreas": ["string"],
  "geographicFocus": "string",
  "eligibility": "string — who can apply",
  "amountMin": number,
  "amountMax": number,
  "deadline": "YYYY-MM-DD or Varies or Rolling",
  "applicationProcess": "string",
  "whatTheyFund": ["string — specific program types they fund"],
  "whatTheyDontFund": ["string"],
  "recentGrantees": ["string — known past grantees if any"],
  "keySelectionCriteria": ["string — what reviewers prioritize"],
  "ecadrnAlignmentScore": number,
  "ecadrnAlignmentRationale": "string — 2-3 sentences on fit",
  "strategicApproach": "string — recommended framing and angle for ECADRN's application"
}`;

    case 'agent-write-proposal':
      return `You are ECADRN's elite grant writer — a senior fundraising strategist who writes proposals that win. You are writing the COMPLETE, FINAL, SUBMISSION-READY grant proposal for this opportunity.

ORGANIZATION: ECADRN
${JSON.stringify(data.orgProfile)}

GRANT OPPORTUNITY (fully researched):
Title: \${data.grantTitle}
Funder: \${data.funderName}
Funder type: \${data.funderType}
Description: \${data.description}
Focus areas: \${JSON.stringify(data.focusAreas)}
Award range: $\${data.amountMin}–$\${data.amountMax}
Geographic focus: \${data.geographicFocus}
Eligibility: \${data.eligibility}
What they fund: \${JSON.stringify(data.whatTheyFund)}
What they don't fund: \${JSON.stringify(data.whatTheyDontFund)}
Key selection criteria: \${JSON.stringify(data.keySelectionCriteria)}
Strategic approach: \${data.strategicApproach}
Deadline: \${data.deadline}

ECADRN VOICE PROFILE:
Tone: \${data.toneDescriptors}
Signature phrases: \${data.keyPhrases}
Style rules: \${data.voiceRules}
Sample writing: \${data.writingSamples}

STRICT REQUIREMENTS:
1. Write EVERY section as a complete, polished, submission-ready piece — not a placeholder or outline.
2. Mirror the funder's language and priorities directly in each section.
3. Every goal must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound).
4. Budget narrative must align exactly with described activities and realistic nonprofit costs.
5. Apply ECADRN's voice throughout — it must read as written by a human who deeply knows this org.
6. Evaluation plan must name specific metrics, data collection methods, and reporting timelines.
7. Organizational capacity section must reference ECADRN's actual programs and credentials.
8. DO NOT use AI clichés: "delve", "tapestry", "testament", "leverage", "robust", "moreover", "it is important to note".
9. Executive summary must open with a compelling hook, not a boilerplate intro.
10. sustainability section must describe concrete plans beyond grant period.

ADDITIONAL INSTRUCTIONS FROM USER: \${data.userInstructions || 'None — write the strongest possible proposal.'}

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
{
  "executiveSummary": "string — 300-400 words, compelling hook, mission alignment, ask amount, key outcomes",
  "needStatement": "string — 300-400 words, data-backed, community voice, urgency",
  "projectDescription": "string — 400-500 words, specific activities, timeline, populations served",
  "goalsObjectives": "string — 300-400 words, 3-4 SMART goals with measurable targets",
  "methodology": "string — 400-500 words, evidence-based approach, step-by-step activities",
  "evaluationPlan": "string — 300-400 words, metrics, data collection, reporting cadence",
  "sustainability": "string — 250-350 words, diversified revenue, partnerships, long-term vision",
  "organizationalCapacity": "string — 300-400 words, track record, team, programs, governance",
  "budgetNarrative": "string — 300-400 words, itemized rationale, cost-effectiveness, match if any"
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

TASK: Identify up to ${data.count || 5} REAL, VERIFIABLE grant opportunities that are a strong mission fit for the organization below.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile)}

SEARCH PARAMETERS:
Focus areas: ${data.focusAreas}
Geographic scope: ${data.geographicFocus}
Preferred award range: $${data.amountMin}–$${data.amountMax}
Additional guidance: ${data.searchQuery}

⚠️ STRICT ANTI-HALLUCINATION RULES — FOLLOW EXACTLY:
1. ONLY include funders that ACTUALLY EXIST and are KNOWN to fund nonprofits in the ADR, conflict resolution, access to justice, or civic equity space.
2. ONLY include grant programs that have ACTUALLY EXISTED or are CURRENTLY ACTIVE as of your knowledge cutoff. Do NOT invent program names.
3. If you are not certain a grant program exists, DO NOT include it. It is better to return fewer results than to fabricate any.
4. Every "title" must be the REAL name of an actual grant program — not a description you made up.
5. Every "funderName" must be a REAL organization with a real website.
6. "url" must be a real, known URL for the grant or funder — set to null if you are not certain.
7. "deadline" must be null unless you have specific knowledge of a real deadline date.
8. "amountMin" and "amountMax" must reflect ACTUAL known award ranges — do not fabricate numbers.
9. Set "verified": false if you have ANY uncertainty about the grant's current active status.
10. NEVER set "verified": true unless you are highly confident the program is real and currently active.

GOOD examples of real funders in this space:
- Open Society Foundations, Z. Smith Reynolds Foundation, Hewlett Foundation, MacArthur Foundation,
  Robert Wood Johnson Foundation, JPMorgan Chase Foundation, Google.org, National Institute of Justice,
  Surdna Foundation, W.K. Kellogg Foundation, Ford Foundation, Skoll Foundation.

OUTPUT FORMAT — Respond ONLY with a valid JSON array. No preamble. No markdown fences.
[{
  "title": "string — REAL grant program name only",
  "funderName": "string — REAL organization name only",
  "funderType": "foundation | government | corporate | community_foundation",
  "description": "string — accurate description of what the program actually funds",
  "focusAreas": ["string"],
  "geographicFocus": "string",
  "amountMin": number,
  "amountMax": number,
  "deadline": "YYYY-MM-DD or null",
  "url": "string — real known URL, or null",
  "eligibility": "string",
  "missionFitScore": number,
  "missionFitRationale": "string — cite specific alignment between this funder's KNOWN priorities and ECADRN's mission",
  "verified": boolean
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

TASK: Identify the TOP 5 most fundable REAL grant opportunities for this organization.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile)}

VOICE & FOCUS AREAS: ${data.focusAreas || 'ADR, conflict resolution, civic equity, early career professional development'}

⚠️ CRITICAL ANTI-HALLUCINATION RULES — NON-NEGOTIABLE:
1. You MUST only return grants from funders that ACTUALLY EXIST in the real world.
2. You MUST only return grant PROGRAMS that have actually existed or are currently known to be active.
3. DO NOT invent, composite, or approximate any grant name, funder name, amount, or deadline.
4. If you are not certain a specific program exists by name, describe the funder's general grantmaking instead and set verified: false.
5. "url" must be a real known URL — set to null if uncertain.
6. "deadline" must be null unless you know a specific real date.
7. It is BETTER to return 2-3 real grants than 5 fabricated ones.
8. Each "matchReason" must cite the funder's KNOWN, DOCUMENTED funding priorities — not assumptions.

REAL funders known to fund ADR / access to justice / conflict resolution / civic equity:
- Open Society Foundations (Justice & Governance)
- Hewlett Foundation (Conflict Resolution & Global Development)
- MacArthur Foundation (Safety & Justice Challenge)
- Z. Smith Reynolds Foundation (NC nonprofits)
- Surdna Foundation (Thriving Cultures / Strong Democracy)
- National Institute of Justice (DOJ grants)
- Robert Wood Johnson Foundation (Health Equity)
- Ford Foundation (Civic Engagement & Government)
- W.K. Kellogg Foundation (Racial Equity, Community Engagement)
- Skoll Foundation (Social Innovation)

OUTPUT FORMAT — Respond ONLY with this exact JSON array. No preamble. No markdown fences.
[{
  "title": "string — REAL program name, or funder's general grantmaking if no named program known",
  "funderName": "string — REAL organization only",
  "funderType": "Foundation | Government | Corporate",
  "description": "string — accurate 2-3 sentence description of what this funder ACTUALLY supports",
  "focusAreas": ["string"],
  "amountMin": number,
  "amountMax": number,
  "deadline": "YYYY-MM-DD or null",
  "geographicFocus": "string",
  "eligibility": "string",
  "matchScore": number,
  "matchReason": "string — cite specific known funder priorities that align with ECADRN",
  "verified": boolean,
  "url": "string or null"
}]`;


    case 'rewrite-voice':
      return `You are an expert editor who masterfully adopts any brand voice.

TASK: Rewrite the SOURCE CONTENT below to strictly adhere to the VOICE PROFILE provided. 

VOICE PROFILE:
Tone: \${data.voiceProfile.toneDescriptors}
Rules: \${data.voiceProfile.voiceRules}
Samples: \${data.voiceProfile.writingSamples}

SOURCE CONTENT:
\${data.content}

REQUIREMENTS:
- Preserve all facts, data points, and semantic meaning perfectly.
- Transform the vocabulary, rhythm, and tone to match the profile.
- Output ONLY the rewritten text. No meta-commentary. No preamble.`;

    case 'generate-outreach-email': {
      const emailTypeDesc: Record<string, string> = {
        introduction: 'a warm cold introduction email to a funder we have not previously contacted',
        loi: 'a formal Letter of Inquiry (LOI) requesting consideration for funding',
        followup: 'a professional follow-up email after a previous conversation or LOI submission',
        thankyou: 'a heartfelt thank-you note after receiving a grant decision (positive or otherwise)'
      };
      const typeDesc = emailTypeDesc[data.emailType] || 'a professional outreach email';
      return `You are a senior nonprofit development director with 20 years of experience writing funder correspondence for ECADRN (Early Career ADR Network — a nonprofit focused on conflict resolution and access to justice).

TASK: Draft ${typeDesc}.

ORGANIZATION:
- Name: ${data.organization?.name || 'ECADRN'}
- Mission: ${data.organization?.mission || 'Expanding access to conflict resolution and ADR for early-career professionals and underserved communities'}
- Programs: ${data.organization?.programs || 'Training, mentorship, and community outreach'}

TARGET FUNDER:
- Name: ${data.funder?.name || 'Unknown Funder'}
- Giving Priorities: ${data.funder?.priorities || 'Not specified'}
- Intelligence Notes: ${data.funder?.analysis || 'None available'}

${data.proposal ? `RELATED PROPOSAL:
- Title: ${data.proposal.title}
- Funder: ${data.proposal.funder}
- Description: ${data.proposal.description}` : ''}

WRITING RULES:
1. Write in a warm, professional, mission-driven tone
2. Bridge ECADRN's work explicitly to the funder's stated priorities
3. Be specific — reference real programs, populations served, or outcomes where possible
4. Keep the email concise: 250–400 words maximum
5. Include: subject line, greeting, body paragraphs, closing, and signature placeholder
6. Do NOT use generic filler phrases or obvious nonprofit clichés
7. Make the connection between funder priorities and ECADRN's work feel natural and genuine

OUTPUT: Return the full email as plain text (not JSON), starting with "Subject: ..."`;
    }

    case 'identify-missing':
      return `You are a systems analyst for a Grant Management SaaS.

TASK: Compare the current application feature set against requirements for a Professional Grant Studio.

CURRENT FEATURES:
\${JSON.stringify(data.currentFeatures)}

USER CONTEXT: ECADRN (Early Career ADR Network)

OUTPUT FORMAT: JSON array of strings describing missing components or improvements needed.`;

    case 'align-to-funder':
      return `You are a strategic grant writer.
      
TASK: Incorporate specific funder intelligence into the grant section provided to maximize alignment.

FUNDER INTELLIGENCE:
\${JSON.stringify(data.funderIntelligence)}

GRANT SECTION CONTENT:
\${data.content}

REQUIREMENTS:
- Subtle but potent inclusion of funder-aligned priorities and vocabulary.
- Do NOT change the core meaning or facts.
- Heighten the rationale for why THIS funder is the right partner for this work.
- Output ONLY the rewritten text. No preamble.`;

    case 'generate-justification':
      return `You are a professional grant budget analyst.
      
TASK: Generate a concise, persuasive budget justification for a specific line item.

PROJECT DESCRIPTION:
\${data.projectDescription}

LINE ITEM:
Description: \${data.description}
Amount: $\${data.amount}

REQUIREMENTS:
- Be specific and direct.
- Explain WHY this expense is necessary for the project.
- Keep it under 2 sentences.
- Output ONLY the justification text. No preamble.`;

    case 'align-grant-ecadrn':
      return `You are a specialist ADR scholar and grants manager evaluating a funding opportunity against ECADRN's mission.

FUNDER & GRANT DETAILS:
Title: \${data.grantTitle}
Funder Name: \${data.funderName}
Description: \${data.grantDescription}
Focus Areas: \${data.focusAreas}
Geographic Scope: \${data.geographicFocus}
Eligibility: \${data.eligibility}

ECADRN MISSION: Supports early-career ADR professionals through structural equity, trauma-informed mediation, peer networks, access to justice, restorative circle spaces, and professional empowerment.
ECADRN VISION: An equitable and accessible ADR field where early career professionals lead, innovate, and bridge the gap between academic research and community restorative efforts.

TASK: Compare the grant against ECADRN's mission/vision and provide an alignment score (0-100) and 2-sentence rationale.

OUTPUT FORMAT — Respond ONLY with this exact JSON structure. No preamble. No markdown fences.
{
  "ecadrnAlignmentScore": number,
  "ecadrnAlignmentRationale": "string"
}`;

    case 'analyze-uploaded-grant':
      return `You are a professional grants officer and ADR analyst at ECADRN.
      
TASK: Read the uploaded grant document text, extract its parameters, and assess strategic fit against ECADRN.

ECADRN MISSION: Supports early-career ADR professionals through structural equity, trauma-informed mediation, peer networks, access to justice, restorative circle spaces, and professional empowerment.
ECADRN VISION: An equitable and accessible ADR field where early career professionals lead, innovate, and bridge academic research with community restorative efforts.

UPLOADED GRANT DOCUMENT / TEXT:
\${data.text}

REQUIREMENTS:
- Extract or infer the grant title and funder name. Use placeholders if not found.
- Provide a summary description.
- Map focus areas as an array of strings.
- Extract or infer geographic scope and eligibility.
- Provide ecadrnAlignmentScore (0-100) and ecadrnAlignmentRationale (2 sentences).

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
{
  "title": "string",
  "funderName": "string",
  "description": "string",
  "focusAreas": ["string"],
  "geographicFocus": "string",
  "eligibility": "string",
  "amountMin": number,
  "amountMax": number,
  "missionFitScore": number,
  "missionFitRationale": "string",
  "ecadrnAlignmentScore": number,
  "ecadrnAlignmentRationale": "string",
  "deadline": "YYYY-MM-DD or null"
}`;

    case 'humanize-proposal':
      return `You are an elite academic editor specializing in making AI-written grant proposals read as genuinely human.

TASK: Audit the draft proposal below for robotic styling, clichés, and artificial transitional phrases, and provide humanization recommendations.

PROPOSAL FOR AUDIT:
\${JSON.stringify(data.proposal)}

FUNDER FOR ALIGNMENT:
\${data.funderName || "Target Funder"}

REQUIREMENTS:
1. Estimate aiProbabilityScore (0-100) and its inverse humanScore.
2. Flag overused AI terms (e.g., "delve", "testament", "tapestry", "moreover", "leverage", "robust").
3. Determine funderAiCheckRisk (Low, Medium, or High).
4. Provide section-by-section humanization strategies.

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
{
  "aiProbabilityScore": number,
  "humanScore": number,
  "flaggedPhrases": ["string"],
  "bannedWordsFound": ["string"],
  "readabilityGrade": "string",
  "funderAiCheckRisk": "Low",
  "structuralVarianceAdvice": "string",
  "sectionAverages": [
    {
      "sectionTitle": "string",
      "detectionProbability": number,
      "roboticPhrases": ["string"],
      "humanizerStrategy": "string"
    }
  ],
  "verdict": "string"
}`;

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
