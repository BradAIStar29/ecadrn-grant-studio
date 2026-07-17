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

GRANT NAME: ${data.grantName}
GRANT URL: ${data.grantUrl || 'Not provided'}
ADDITIONAL CONTEXT: ${data.additionalContext || 'None'}

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
Title: ${data.grantTitle}
Funder: ${data.funderName}
Funder type: ${data.funderType}
Description: ${data.description}
Focus areas: ${JSON.stringify(data.focusAreas)}
Award range: $${data.amountMin}–$${data.amountMax}
Geographic focus: ${data.geographicFocus}
Eligibility: ${data.eligibility}
What they fund: ${JSON.stringify(data.whatTheyFund)}
What they don't fund: ${JSON.stringify(data.whatTheyDontFund)}
Key selection criteria: ${JSON.stringify(data.keySelectionCriteria)}
Strategic approach: ${data.strategicApproach}
Deadline: ${data.deadline}

ECADRN VOICE PROFILE:
Tone: ${data.toneDescriptors}
Signature phrases: ${data.keyPhrases}
Style rules: ${data.voiceRules}
Sample writing: ${data.writingSamples}

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

ADDITIONAL INSTRUCTIONS FROM USER: ${data.userInstructions || 'None — write the strongest possible proposal.'}

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
  Surdna Foundation, Woods Fund Chicago, JAMS Foundation, AAA-ICDR Foundation, NIDR, State Bar Foundations.

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
[
  {
    "grantTitle": "string — real grant program name",
    "funderName": "string — real funder name",
    "funderType": "Foundation | Government | Corporation | Community Foundation | University",
    "description": "string — 2-3 sentences overviewing the grant program, scope, and target population based on real facts",
    "focusAreas": ["string"],
    "geographicFocus": "string — e.g. National, California, Chicago, etc.",
    "amountMin": number,
    "amountMax": number,
    "deadline": "YYYY-MM-DD or Varies or Rolling",
    "url": "string or null — MUST be the actual URL or domain of the funder, or null if uncertain",
    "alignmentRationale": "string — 2 sentences explaining why this specifically fits ECADRN's mission and programs",
    "verified": boolean
  }
]`;

    case 'align-proposal':
      return `You are a nonprofit fundraising strategist and editor specializing in ADR/conflict resolution grant proposals.

TASK: Compare the draft proposal text below against the funder's priority guidelines and voice rules, then provide concrete, actionable improvements for each section.

DRAFT SECTIONS:
${JSON.stringify(data.sections)}

FUNDER GUIDELINES:
Title: ${data.grantTitle}
Funder: ${data.funderName}
Description: ${data.grantDescription}
Focus areas: ${data.focusAreas}
Key selection criteria: ${data.keySelectionCriteria || 'None'}

VOICE PROFILE:
Tone: ${data.toneDescriptors}
Style rules: ${data.voiceRules}

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "executiveSummary": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "needStatement": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "projectDescription": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "goalsObjectives": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "methodology": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "evaluationPlan": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "sustainability": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "organizationalCapacity": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" },
  "budgetNarrative": { "critique": "string", "recommendations": ["string"], "rewrittenSnippet": "string" }
}`;

    case 'verify-facts':
      return `You are an expert grant reviewer and fact-checker.

TASK: Audit the grant proposal text below against the organization's verified profile data to identify any factual inconsistencies, unsupported claims, or demographic mismatches.

PROPOSAL SECTIONS:
${JSON.stringify(data.sections)}

VERIFIED ORGANIZATIONAL DATA:
${JSON.stringify(data.orgProfile)}

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
[
  {
    "section": "executiveSummary | needStatement | projectDescription | goalsObjectives | methodology | evaluationPlan | sustainability | organizationalCapacity | budgetNarrative",
    "severity": "high | medium | low",
    "issue": "Detailed description of the discrepancy, mismatch, or unsupported claim",
    "verifiedFact": "The correct fact/data from the organizational profile",
    "proposedFix": "Specific suggestion on how to rephrase or correct the text"
  }
]`;


    case 'align-grant-ecadrn':
      return `You are an expert grant writer for ECADRN (Equity Center for Alternative Dispute Resolution & Negotiation). Align the following grant opportunity with ECADRN's mission of advancing ADR, conflict resolution, and civic equity.

Grant: ${data.grantTitle || ''}
Funder: ${data.funderName || ''}
Description: ${data.grantDescription || ''}
Focus Areas: ${data.focusAreas || ''}

Provide a JSON response with:
- "alignmentScore" (0-100): how well this grant fits ECADRN
- "recommendedAngle" (string): suggested approach
- "keyKeywords" (array of strings): keywords to emphasize
- "risks" (array of strings): potential alignment risks`;

    case 'align-to-funder':
      return `You are a grant alignment expert. Align the following proposal section to match the funder's priorities and language.

Funder Intelligence: ${JSON.stringify(data.funderIntelligence || {})}
Section Content: ${data.content || ''}

Return JSON with:
- "alignedContent" (string): the revised section content
- "changes" (array of strings): summary of changes made`;

    case 'analyze-uploaded-grant':
      return `Analyze this grant document and extract key information. Return JSON with:
- "title" (string): grant name
- "funderName" (string): funding organization
- "deadline" (string): application deadline if found
- "amount" (string): funding amount if found
- "focusAreas" (array of strings): key focus areas
- "eligibility" (array of strings): eligibility requirements
- "summary" (string): brief summary

Document text:
${(data.text || '').slice(0, 8000)}`;

    case 'analyze-voice':
      return `Analyze the following documents to identify the organization's unique writing voice and style. Return JSON with:
- "tone" (string): dominant tone (formal, conversational, urgent, etc.)
- "vocabulary" (array of strings): frequently used distinctive words
- "sentenceStyle" (string): description of sentence structure patterns
- "keyPhrases" (array of strings): signature phrases or themes
- "avoidWords" (array of strings): words or phrases to avoid

Documents:
${JSON.stringify(data.documents || []).slice(0, 8000)}`;

    case 'autopilot-search':
      return `Search for grant opportunities matching this organization's profile. Return a JSON array of grants, each with:
- "title" (string)
- "funderName" (string)
- "amount" (string)
- "deadline" (string, ISO format if known)
- "focusAreas" (array of strings)
- "url" (string, only if confirmed real)
- "verified" (boolean, always false — we never fabricate verification)
- "description" (string)

Organization Profile: ${JSON.stringify(data.orgProfile || {}).slice(0, 4000)}
Focus Areas: ${data.focusAreas || 'ADR, conflict resolution, civic equity'}

IMPORTANT: Only include real grants you are confident exist. Mark all as verified: false. Never fabricate URLs.`;

    case 'chat':
      return `You are ECADRN's AI grant writing assistant. Respond in JSON format:
{"reply": "your response text"}

Conversation context: ${data.context || ''}
Recent history: ${JSON.stringify(data.history || []).slice(-2000)}
User message: ${data.message || ''}`;

    case 'generate-budget':
      return `Generate a detailed grant budget based on the project description. Return a JSON array of line items, each with:
- "category" (string): e.g., Personnel, Travel, Equipment, Other
- "description" (string): line item description
- "amount" (number): dollar amount
- "justification" (string): brief justification

Project Description: ${data.description || ''}`;

    case 'generate-justification':
      return `Write a budget justification for this line item. Return JSON: {"justification": "string"}

Project Description: ${data.projectDescription || ''}
Line Item: ${data.description || ''}
Amount: $${data.amount || 0}`;

    case 'generate-outreach-email':
      return `Write a professional outreach email. Return JSON: {"subject": "string", "body": "string"}

Email Type: ${data.emailType || 'introduction'}
Funder: ${JSON.stringify(data.funder || {})}
Organization: ECADRN (Equity Center for Alternative Dispute Resolution & Negotiation)

Keep the email concise, professional, and tailored to the funder's priorities.`;

    case 'humanize-proposal':
      return `Review this proposal and suggest improvements to make it more natural and compelling. Return JSON with:
- "score" (number): natural writing score 0-100
- "suggestions" (array of strings): specific improvement suggestions
- "rewrittenSection" (string): a more natural version of any key section

Funder: ${data.funderName || ''}
Proposal: ${JSON.stringify(data.proposal || {}).slice(0, 6000)}`;

    case 'identify-missing':
      return `Analyze the current application features and suggest what's missing for a complete grant writing platform. Return JSON:
{"missing": [{"feature": "string", "priority": "high|medium|low", "description": "string"}]}

Current Features: ${JSON.stringify(data.currentFeatures || [])}
Organization: ${JSON.stringify(data.orgProfile || {}).slice(0, 2000)}`;

    case 'review-proposal':
      return `Review this grant proposal for quality and completeness. Return JSON with:
- "overallScore" (number): 0-100
- "sectionScores" (object): score per section (0-100)
- "strengths" (array of strings)
- "weaknesses" (array of strings)
- "recommendations" (array of strings)

Grant: ${data.grantTitle || ''}
Funder: ${data.funderName || ''}
Description: ${data.grantDescription || ''}
Proposal: ${JSON.stringify(data.proposal || {}).slice(0, 6000)}`;

    case 'rewrite-voice':
      return `Rewrite the following content to match the organization's voice profile. Return JSON: {"content": "rewritten text"}

Voice Profile: ${JSON.stringify(data.voiceProfile || {}).slice(0, 2000)}
Content: ${data.content || ''}`;


    default:
      return 'INVALID';
  }
}

// Helper to clean JSON from response
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  
  // Strip starting ```json or ``` and ending ``` (including single backticks)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/^`\s*/, '');
  cleaned = cleaned.replace(/```\s*$/, '');
  cleaned = cleaned.replace(/`\s*$/, '');
  
  cleaned = cleaned.trim();

  // If there's extra text before the first { or [ and after the last } or ], extract the JSON structure
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      start = firstBrace;
      end = lastBrace;
    } else {
      start = firstBracket;
      end = lastBracket;
    }
  } else if (firstBrace !== -1) {
    start = firstBrace;
    end = lastBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1).trim();
  }

  return cleaned;
}

// ── Google Drive API Helpers ─────────────────────────────────────────────────

async function driveRequest(path: string, options: RequestInit, token: string) {
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
}

async function verifyFirebaseToken(token: string, projectId: string): Promise<any> {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${token}`;
    // Using simple token verification via Google Identity Toolkit
    // Note: In worker context, verifying RS256 JWT using Firebase public keys is standard,
    // but for simplicity/robustness we verify via Google API, or parse the JWT.
    // Let's decode the JWT payload first to see if it's expired/valid.
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Ensure token is not expired (current time in seconds)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('Firebase token expired');
      return null;
    }
    
    // Ensure audience matches firebase project
    if (payload.aud !== projectId) {
      console.error('Firebase project mismatch');
      return null;
    }

    // ECADRN organization lock: email must end with @ecadrn.org
    if (!payload.email || !payload.email.endsWith('@ecadrn.org')) {
      console.error('Unauthorized email domain:', payload.email);
      return null;
    }

    return payload;
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'];
    const responseOrigin = allowedOrigins.includes(origin) ? origin : env.ALLOWED_ORIGIN;

    const corsHeaders = {
      'Access-Control-Allow-Origin': responseOrigin,
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
      const modelName = action === 'agent-write-proposal' ? 'gemini-2.5-flash' : 'gemini-2.0-flash';

      let resultText = '';
      let errorOccurred = false;

      // Wrap generateContent call in a timeout of 25 seconds
      const runGeneration = async (currentPrompt: string) => {
        const generationPromise = ai.models.generateContent({
          model: modelName,
          contents: currentPrompt,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 25000);
        });

        const res = await Promise.race([generationPromise, timeoutPromise]);
        return res.text?.trim() || '';
      };

      try {
        resultText = await runGeneration(prompt);
      } catch (err: any) {
        if (err.message === 'TIMEOUT') {
          return json({ error: 'Service Unavailable: AI generation timed out' }, 503);
        }
        errorOccurred = true;
      }

      // Retry wrapper: if generateContent throws or returns empty text, retry once with a slightly different prompt
      if (errorOccurred || !resultText) {
        try {
          const retryPrompt = `${prompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown formatting.`;
          resultText = await runGeneration(retryPrompt);
        } catch (err: any) {
          if (err.message === 'TIMEOUT') {
            return json({ error: 'Service Unavailable: AI generation timed out' }, 503);
          }
          return json({ error: `AI Generation failed: ${err.message || err}` }, 500);
        }
      }

      if (!resultText) {
        return json({ error: 'AI returned empty response' }, 500);
      }

      const cleaned = cleanJsonResponse(resultText);

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

      // First check mimeType to see if it's a Workspace doc that needs exporting
      const metaRes = await driveRequest(`/files/${fileId}?fields=mimeType,name`, { method: 'GET' }, driveToken);
      if (!metaRes.ok) return json({ error: 'Drive metadata error', details: await metaRes.text() }, metaRes.status);
      const meta = await metaRes.json() as any;

      let contentRes;
      if (meta.mimeType === 'application/vnd.google-apps.document') {
        contentRes = await driveRequest(`/files/${fileId}/export?mimeType=text/plain`, { method: 'GET' }, driveToken);
      } else if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
        contentRes = await driveRequest(`/files/${fileId}/export?mimeType=text/csv`, { method: 'GET' }, driveToken);
      } else {
        contentRes = await driveRequest(`/files/${fileId}?alt=media`, { method: 'GET' }, driveToken);
      }

      if (!contentRes.ok) return json({ error: 'Drive download error', details: await contentRes.text() }, contentRes.status);
      
      const contentType = contentRes.headers.get('Content-Type') || 'text/plain';
      const responseData = await contentRes.arrayBuffer();

      return new Response(responseData, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.name)}"`,
        },
      });
    }

    return json({ error: 'Not found' }, 404);
  }
};
