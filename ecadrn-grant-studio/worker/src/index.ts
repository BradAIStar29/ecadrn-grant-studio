import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_FALLBACK?: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  GOOGLE_DRIVE_TOKEN?: string;
  AI_CONFIG?: KVNamespace;
}

// Firebase public keys for JWT signature verification (cached by jose)
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

// ── Model & Temperature Configuration ────────────────────────────────────────
// Gemini 2.5-flash for all actions — native reasoning, better instruction
// following, and superior JSON output vs 2.0-flash.

type ActionCategory = 'research' | 'writing' | 'analysis' | 'chat' | 'utility';

const ACTION_CONFIG: Record<string, { model: string; temperature: number; category: ActionCategory; maxTokens: number; useSearch: boolean }> = {
  'generate-draft':          { model: 'gemini-2.5-flash', temperature: 0.75, category: 'writing',  maxTokens: 16384, useSearch: false },
  'agent-write-proposal':    { model: 'gemini-2.5-flash', temperature: 0.8,  category: 'writing',  maxTokens: 32768, useSearch: false },
  'research-funder':         { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'research', maxTokens: 16384, useSearch: true  },
  'research-grant-url':      { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'research', maxTokens: 16384, useSearch: true  },
  'discover-grants':         { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'research', maxTokens: 16384, useSearch: true  },
  'autopilot-search':        { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'research', maxTokens: 16384, useSearch: true  },
  'find-adr-partners':       { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'research', maxTokens: 16384, useSearch: true  },
  'align-proposal':          { model: 'gemini-2.5-flash', temperature: 0.4,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'align-grant-ecadrn':      { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'analysis', maxTokens: 8192,  useSearch: false },
  'align-to-funder':         { model: 'gemini-2.5-flash', temperature: 0.5,  category: 'analysis', maxTokens: 8192,  useSearch: false },
  'compare-proposals':       { model: 'gemini-2.5-flash', temperature: 0.4,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'review-proposal':         { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'humanize-proposal':       { model: 'gemini-2.5-flash', temperature: 0.6,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'score-alignment':         { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'analysis', maxTokens: 8192,  useSearch: false },
  'analyze-voice':           { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'analysis', maxTokens: 8192,  useSearch: false },
  'analyze-uploaded-grant':  { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'utility',  maxTokens: 8192,  useSearch: false },
  'generate-budget':         { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'writing',  maxTokens: 16384, useSearch: false },
  'generate-justification':  { model: 'gemini-2.5-flash', temperature: 0.4,  category: 'writing',  maxTokens: 4096,  useSearch: false },
  'generate-timeline':        { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'writing',  maxTokens: 8192,  useSearch: false },
  'generate-outreach-email': { model: 'gemini-2.5-flash', temperature: 0.7,  category: 'writing',  maxTokens: 8192,  useSearch: false },
  'chat':                    { model: 'gemini-2.5-flash', temperature: 0.8,  category: 'chat',     maxTokens: 4096,  useSearch: false },
  'rewrite-voice':           { model: 'gemini-2.5-flash', temperature: 0.7,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'identify-missing':        { model: 'gemini-2.5-flash', temperature: 0.5,  category: 'utility',  maxTokens: 8192,  useSearch: false },
  'verify-facts':            { model: 'gemini-2.5-flash', temperature: 0.1,  category: 'analysis', maxTokens: 16384, useSearch: true  },
  'search-grants':           { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'research', maxTokens: 16384, useSearch: true  },
  'refine-section':         { model: 'gemini-2.5-flash', temperature: 0.6,  category: 'writing',  maxTokens: 16384, useSearch: false },
  'pre-submit-check':       { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'analyze-competitors':    { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'research', maxTokens: 16384, useSearch: true  },
  'prioritize-grants':      { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'explain-diff':           { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'analysis', maxTokens: 8192,  useSearch: false },
  'recommend-funders':      { model: 'gemini-2.5-flash', temperature: 0.3,  category: 'analysis', maxTokens: 8192,  useSearch: false },
  'analyze-win-loss':       { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'analysis', maxTokens: 16384, useSearch: false },
  'detect-recurring':       { model: 'gemini-2.5-flash', temperature: 0.2,  category: 'analysis', maxTokens: 8192,  useSearch: true  },
};

const DEFAULT_CONFIG = { model: 'gemini-2.5-flash', temperature: 0.4, category: 'utility' as ActionCategory, maxTokens: 8192, useSearch: false };

// ── AI Model Fallback System ──────────────────────────────────────────────────
// When the primary model hits rate limits, seamlessly falls back to secondary
// models. Uses Cloudflare KV for cross-request state with progressive backoff:
//   1st quota hit → 15 min cooldown, try primary again
//   2nd hit       → 60 min cooldown
//   3rd+ hit      → 24h cooldown (daily revert as requested)
// When primary recovers, state is cleared and everything reverts to normal.

const MODEL_TIERS = [
  { model: 'gemini-2.5-flash',     label: 'Gemini 2.5 Flash' },
  { model: 'gemini-2.0-flash',     label: 'Gemini 2.0 Flash' },
  { model: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' },
];

function isQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status || err?.code;
  return (
    status === 429 || status === '429' ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('resource has been exhausted')
  );
}

async function getActiveModelTier(env: Env): Promise<number> {
  if (!env.AI_CONFIG) return 0;
  try {
    const raw = await env.AI_CONFIG.get('ai_model_state');
    if (!raw) return 0;
    const state = JSON.parse(raw);
    const minutesSince = Math.floor((Date.now() - new Date(state.lastQuotaHit).getTime()) / (1000 * 60));
    if (minutesSince >= state.cooldownMinutes) {
      console.log('⏰ AI Fallback: Cooldown expired, trying primary model again');
      return 0;
    }
    const tier = Math.min(state.tier, MODEL_TIERS.length - 1);
    return tier;
  } catch { return 0; }
}

async function recordModelFallback(env: Env, failedTier: number): Promise<void> {
  if (!env.AI_CONFIG) return;
  try {
    const nextTier = Math.min(failedTier + 1, MODEL_TIERS.length - 1);

    let consecutiveFailures = 0;
    const existing = await env.AI_CONFIG.get('ai_model_state');
    if (existing) {
      const parsed = JSON.parse(existing);
      consecutiveFailures = (parsed.consecutiveFailures || 0) + 1;
    }

    const cooldownMinutes = consecutiveFailures >= 3 ? 24 * 60 :
                           consecutiveFailures >= 2 ? 60 :
                           consecutiveFailures >= 1 ? 15 : 1;

    await env.AI_CONFIG.put('ai_model_state', JSON.stringify({
      tier: nextTier,
      lastQuotaHit: new Date().toISOString(),
      consecutiveFailures,
      cooldownMinutes,
      failedModel: MODEL_TIERS[failedTier].model,
      fallbackModel: MODEL_TIERS[nextTier].model,
    }));
    console.log(`🔄 AI Fallback: ${MODEL_TIERS[failedTier].model} → ${MODEL_TIERS[nextTier].model} (cooldown: ${cooldownMinutes}min, failures: ${consecutiveFailures})`);
  } catch (e) {
    console.error('AI Fallback: KV write error:', e);
  }
}

async function clearModelFallback(env: Env): Promise<void> {
  if (!env.AI_CONFIG) return;
  try {
    await env.AI_CONFIG.delete('ai_model_state');
    console.log('✅ AI Fallback: Primary model working — fallback state cleared');
  } catch {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeTruncateContext(obj: any, maxLen = 4000): string {
  const str = JSON.stringify(obj || {});
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 20) + '...[truncated]}';
}

// ── Prompt builder ──────────────────────────────────────────────────────────

// ECADRN-exclusive preamble injected into EVERY prompt — the AI serves only ECADRN.
const ECADRN_PREAMBLE = `You are the AI grant engine built exclusively for ECADRN (ecadrn.org) — a nonprofit advancing Appropriate Dispute Resolution (ADR): conflict resolution, access to justice, restorative justice, and civic equity.
You serve ONLY ECADRN. Ground everything in the organization data provided; never invent facts; never write on behalf of any other organization. If the request appears to be for a different organization, refuse and state that you serve ECADRN only.

`;

function getPrompt(action: string, data: any): string {
  const actionPrompt = buildActionPrompt(action, data);
  if (actionPrompt === 'INVALID') return actionPrompt;
  return ECADRN_PREAMBLE + actionPrompt;
}

function buildActionPrompt(action: string, data: any): string {
  switch (action) {
    case 'generate-draft':
      const funderIntelSection = data.funderIntelligence
        ? `
FUNDER INTELLIGENCE (from prior web research — use this to tailor the proposal):
Giving Priorities: ${JSON.stringify(data.funderIntelligence.givingPriorities || [])}
What They Fund: ${JSON.stringify(data.funderIntelligence.whatTheyFund || [])}
What They DON'T Fund: ${JSON.stringify(data.funderIntelligence.whatTheyDontFund || [])}
Application Tips: ${JSON.stringify(data.funderIntelligence.applicationTips || [])}
Recommended Approach: ${data.funderIntelligence.recommendedApproach || 'N/A'}
Mission Alignment Rationale: ${data.funderIntelligence.missionAlignmentRationale || 'N/A'}
Key Selection Criteria: ${JSON.stringify(data.funderIntelligence.keySelectionCriteria || [])}
Typical Grantees: ${JSON.stringify(data.funderIntelligence.typicalGrantees || [])}
Recent Grants (from 990s/web): ${JSON.stringify(data.funderIntelligence.recentGrants || [])}
Deadline Info: ${data.funderIntelligence.deadlineInfo || 'N/A'}
Research Confidence: ${data.funderIntelligence.researchConfidence || 'medium'}

IMPORTANT: Use the funder intelligence above to:
- Mirror their giving priorities language directly in each section
- Avoid proposing activities in their "what they don't fund" list
- Follow their application tips explicitly
- Frame the proposal using their recommended approach
- Reference their typical grantees as comparables when relevant
- Address each key selection criterion systematically
- Reference their recent grants to show you understand their giving patterns
- If research confidence is 'low', keep claims general and avoid asserting specific facts about the funder
- If recent grants show a pattern (e.g. preference for community-based programs), emphasize that alignment`
        : '';

      const winningExamplesSection = Array.isArray(data.winningExamples) && data.winningExamples.length > 0
        ? `
WINNING PROPOSAL EXAMPLES (real proposals from this organization that were FUNDED):
${data.winningExamples.map((ex: any, i: number) => `
--- WINNING EXAMPLE ${i + 1}: "${ex.title || 'Untitled'}" (Funder: ${ex.funder || 'Unknown'}, Status: ${ex.status || 'awarded'}) ---
${(ex.sections || []).map((s: any) => `${s?.title || 'Section'}:\n${(s?.content || '').replace(/<[^>]*>/g, '').slice(0, 1200)}`).join('\n\n')}
`).join('\n')}

HOW TO USE THE WINNING EXAMPLES:
- These proposals actually WON funding. Study their structure, argument patterns, evidence density, and specificity.
- Mirror the patterns that made them win: how they open sections, how they quantify outcomes, how they connect programs to funder priorities.
- DO NOT copy text verbatim or reuse the same winning grant's specifics — extract the PATTERNS (rhythm, structure, level of detail) and apply them to this new opportunity.
- If a winning example was funded by the SAME funder, pay extra attention: that funder has already rewarded this organization's style once.`
        : '';

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
${funderIntelSection}
${winningExamplesSection}

VOICE PROFILE:
Tone descriptors: ${data.toneDescriptors}
Characteristic phrases: ${data.keyPhrases}
Writing style rules: ${data.voiceRules}
Sample sentences: ${data.writingSamples}

STRICT REQUIREMENTS:
1. Each section MUST be substantive, specific, and directly address the funder's stated priorities.
2. Ground every claim in the org's actual programs, populations, and work — no vague filler.
3. Apply the voice profile throughout — it must read as written by someone who deeply knows this org.
4. Goals must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound) — include baseline data and target metrics.
5. Evaluation plan must reference concrete metrics, data collection methods, reporting timelines, and accountable staff.
6. Budget narrative must align with project description activities and realistic nonprofit costs — show the math.
7. Executive summary must open with a compelling, specific hook about the community need — not a boilerplate intro or mission restatement.
8. Sustainability section must describe at least 3 concrete revenue diversification strategies beyond the grant period.
9. Need statement must include at least 2 specific data points or statistics with source attribution.
10. Methodology must describe a step-by-step implementation plan with phases and timelines.
11. Organizational capacity must reference the org's ACTUAL track record, staff credentials, and program outcomes.
12. DO NOT use AI clichés: "delve", "tapestry", "testament", "leverage", "robust", "moreover", "it is important to note", "in today's world", "at the heart of", "navigating the landscape", "catalyst for change", "bridging divides", "fostering dialogue".
13. DO NOT use generic nonprofit filler — every sentence should be specific to ECADRN's actual work in ADR, conflict resolution, and civic equity.
14. Use active voice, not passive. "We will train 50 mediators" not "50 mediators will be trained."
15. Include community voice — reference constituent perspectives, partner organizations, or direct quotes where appropriate.

REASONING BEFORE WRITING:
Before writing, internally analyze:
- What are the funder's top 3 stated priorities? How does each ECADRN program map to them?
- What are the strongest outcome metrics ECADRN can credibly claim?
- What is the most compelling hook for the executive summary based on community need?
- What 3 sustainability strategies are most realistic for an early-career ADR network?
Then write the proposal incorporating these decisions.

WORD COUNT GUIDANCE (aim for these ranges):
- executiveSummary: 300-400 words — compelling hook, mission alignment, ask amount, key outcomes
- needStatement: 300-400 words — data-backed, community voice, urgency
- projectDescription: 400-500 words — specific activities, timeline, populations served
- goalsObjectives: 300-400 words — 3-4 SMART goals with measurable targets
- methodology: 400-500 words — evidence-based approach, step-by-step activities
- evaluationPlan: 300-400 words — metrics, data collection, reporting cadence
- sustainability: 250-350 words — diversified revenue, partnerships, long-term vision
- organizationalCapacity: 300-400 words — track record, team, programs, governance
- budgetNarrative: 300-400 words — itemized rationale, cost-effectiveness, match if any

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
      return `You are a nonprofit grants researcher and web analyst with access to web search. The user has provided a grant opportunity name and/or URL.

TASK: Research this grant opportunity thoroughly using web search. Find the REAL program page, actual deadlines, real eligibility requirements, and real award amounts. Do NOT rely solely on training data — search for current information.

SEARCH INSTRUCTIONS:
1. Search for the grant program by name to find its official page
2. Search for recent news or announcements about this grant
3. Search for past recipients to verify it's real and active
4. Verify deadlines and amounts against the official source
5. Search for the funder's 990 filing or annual report for grant history

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
2. Mirror the funder's language and priorities directly in each section — use their exact terminology.
3. Every goal must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound) with baseline data and target metrics.
4. Budget narrative must align exactly with described activities and realistic nonprofit costs — show the math.
5. Apply ECADRN's voice throughout — it must read as written by a human who deeply knows this org.
6. Evaluation plan must name specific metrics, data collection methods, reporting timelines, and accountable staff.
7. Executive summary must open with a compelling, specific hook — not a mission restatement.
8. Need statement must include at least 2 specific data points with source attribution.
9. Methodology must describe a step-by-step implementation plan with phases, timelines, and responsible parties.
10. Sustainability must describe at least 3 concrete revenue diversification strategies.
11. Include community voice — constituent perspectives, partner quotes, or lived-experience references.
12. DO NOT use AI clichés: "delve", "tapestry", "testament", "leverage", "robust", "moreover", "it is important to note", "in today's world", "at the heart of", "navigating the landscape", "catalyst for change", "bridging divides", "fostering dialogue".
13. Use active voice, not passive. "We will train 50 mediators" not "50 mediators will be trained."
14. DO NOT use generic nonprofit filler — every sentence should be specific to ECADRN's ADR, conflict resolution, and civic equity work.

REASONING BEFORE WRITING:
Before writing, internally analyze:
- What are the funder's top 3 priorities and how do ECADRN's programs directly map to each?
- What are the 3 strongest outcome metrics ECADRN can credibly claim?
- What is the most compelling community-need hook for the executive summary?
- What 3 sustainability strategies are most realistic for an early-career ADR network?
- What data points best support the need statement?
- How should the budget narrative align with the methodology activities?
Then write the proposal incorporating these decisions.

WORD COUNT GUIDANCE:
- executiveSummary: 300-400 words — compelling hook, mission alignment, ask amount, key outcomes
- needStatement: 300-400 words — data-backed, community voice, urgency
- projectDescription: 400-500 words — specific activities, timeline, populations served
- goalsObjectives: 300-400 words — 3-4 SMART goals with measurable targets
- methodology: 400-500 words — evidence-based approach, step-by-step activities
- evaluationPlan: 300-400 words — metrics, data collection, reporting cadence
- sustainability: 250-350 words — diversified revenue, partnerships, long-term vision
- organizationalCapacity: 300-400 words — track record, team, programs, governance
- budgetNarrative: 300-400 words — itemized rationale, cost-effectiveness, match if any

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
      return `You are a nonprofit fundraising strategist specializing in foundation research and ADR/conflict resolution sector funding. You have access to web search — USE IT EXTENSIVELY.

TASK: Conduct a DEEP WEB-RESEARCHED intelligence report on the funder below. Search the web for real, current information — do NOT rely on training data alone.

SEARCH INSTRUCTIONS — perform these searches:
1. Search for the funder's official website and their "grant" or "funding" page — read their actual giving priorities, eligibility, and application requirements.
2. Search for the funder's most recent IRS Form 990 or annual report — find their actual grant amounts, grantee names, and total giving.
3. Search for recent news about the funder's strategic priorities, leadership changes, or new initiatives.
4. Search for profiles of this funder on grantcenter.org, candid.org, or charitynavigator.org.
5. Search for nonprofits similar to ECADRN that have received funding from this funder — find past grantees in the ADR, mediation, restorative justice, or access-to-justice space.
6. Search for the funder's application deadlines, LOI requirements, and submission process.
7. Search for any recent RFPs, funding announcements, or giving guidelines published by this funder.
8. Search for the funder's 990-PF filing on ProPublica Nonprofit Explorer or Candid for grant-by-grant breakdowns.
9. Search for "funder name + grants + dispute resolution" or "funder name + grants + mediation" to find ADR-specific funding history.

FUNDER:
Name: ${data.funderName}
Website: ${data.funderWebsite}
Primary contact: ${data.contactName}
Relationship stage: ${data.relationshipStage}
Notes: ${data.funderNotes}

APPLYING ORGANIZATION:
${JSON.stringify(data.orgProfile)}

ECADRN MISSION: Equity Center for Alternative Dispute Resolution & Negotiation — supports early-career ADR professionals through structural equity, trauma-informed mediation, peer networks, access to justice, restorative circle spaces, and professional empowerment.

⚠️ STRICT ANTI-HALLUCINATION RULES:
1. ONLY report information you found via web search or can verify from the funder's official sources.
2. If you cannot find specific data (e.g., exact grant amounts from 990s), state "Not publicly available" rather than guessing.
3. Past grantees must be REAL organizations — do not fabricate grantee names.
4. Application deadlines must be from the funder's official site or known grant databases — do not invent dates.
5. If the funder's website is not accessible or you cannot find reliable info, note this in "funderOverview".

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "funderOverview": "string — 2-3 paragraph summary based on web research, including their mission, history, and current strategic direction",
  "funderType": "Foundation | Corporation | University | Government | Community Foundation",
  "givingPriorities": ["string — actual giving priorities from their website or 990"],
  "typicalGrantees": ["string — REAL past grantees found via web search, especially ADR/mediation/restorative justice orgs"],
  "fundingRanges": "string — actual grant ranges from 990s or website, with source attribution",
  "geographicFocus": "string",
  "applicationProcess": "string — actual process from their website: LOI required? Full proposal? Rolling or cyclical? Deadline dates?",
  "missionAlignmentScore": number,
  "missionAlignmentRationale": "string — 3-4 sentences on specific alignment with ECADRN's ADR mission, citing the funder's actual priorities",
  "recentStrategicShifts": "string — any recent changes in leadership, priorities, or giving patterns found via web search",
  "whatTheyDontFund": ["string — from their website or guidelines"],
  "applicationTips": ["string — 5-8 actionable tips based on research, e.g., 'Emphasize measurable outcomes' or 'LOI due in February'"],
  "recommendedApproach": "string — 3-4 sentence strategy on how ECADRN should approach this funder",
  "recentGrants": [{"grantee": "string — real org name", "amount": "string — real amount if known", "year": "string", "purpose": "string"}],
  "deadlineInfo": "string — upcoming deadlines or application windows, or 'Rolling/No fixed deadline'",
  "researchConfidence": "high | medium | low — based on how much verifiable info was found via web search"
}`;

    case 'discover-grants':
      return `You are a nonprofit grants researcher specializing in ADR, conflict resolution, access to justice, restorative justice, and civic equity funding. You have access to web search — USE IT to find REAL, CURRENT, ACTIVE grant opportunities.

TASK: Search the web to identify up to ${data.count || 5} REAL, VERIFIABLE, CURRENTLY ACTIVE grant opportunities that are a strong mission fit for the organization below.

SEARCH INSTRUCTIONS:
1. Search for current grant opportunities in ADR, conflict resolution, restorative justice, access to justice, mediation, and civic equity
2. Search for foundations and government programs currently accepting applications in this space
3. Search for recent RFPs and NOFAs (Notices of Funding Availability) related to dispute resolution
4. Verify each grant program is real and currently active by checking its official page
5. Search for real deadlines, real award amounts, and real eligibility requirements
6. Prioritize grants with upcoming deadlines or rolling applications
7. Search specifically for: "access to justice grants 2026", "mediation program funding", "restorative justice foundation grants", "conflict resolution nonprofit funding", "ADR grants for nonprofits"
8. Search for state-level justice department grants that include mediation/dispute resolution components
9. Search for bar foundation grants in states relevant to the geographic focus

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
  Surdna Foundation, Woods Fund Chicago, JAMS Foundation, AAA-ICDR Foundation, NIDR, State Bar Foundations,
  Boren Foundation, Mary Reynolds Babcock Foundation, Kate B. Reynolds Charitable Trust,
  Edward W. Hazen Foundation, Public Welfare Foundation, Vera Institute of Justice funders,
  ABA Section of Dispute Resolution grants.

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
    "matchExplanation": "string — ONE sentence: 'Strong: <specific strength — name a program/priority that maps directly>; Watch: <specific gap — budget size, geography, eligibility, or competition level>'",
    "verified": boolean
  }
]`;
    case 'verify-facts':
      return `You are an expert grant reviewer and fact-checker.
Verify the claims in this grant proposal against known facts. Return JSON:
- "verified": array of { "claim": "string", "status": "verified|unverified|false", "note": "string" }
- "missingSources": array of strings (claims that need citation)
- "overallConfidence": number 0-100

Grant Proposal:
${JSON.stringify(data.proposal || data).slice(0, 8000)}`;

    case 'extract-requirements':
      return `You are an expert grant application compliance officer with deep experience reviewing RFPs, grant guidelines, and eligibility criteria for foundation, government, and corporate funding.

TASK: Extract every concrete requirement this organization must satisfy to submit a complete, compliant application for the grant below. Then map it against the organization profile to flag anything they clearly cannot check off today.

GRANT OPPORTUNITY:
Title: ${data.grantTitle || 'N/A'}
Funder: ${data.funderName || 'N/A'}
Description: ${data.grantDescription || 'N/A'}
Eligibility (as stated): ${data.eligibility || 'Not specified'}
Focus areas: ${data.focusAreas || 'Not specified'}
Geographic focus: ${data.geographicFocus || 'Not specified'}
Award range: $${data.amountMin || 0}–$${data.amountMax || 0}
Deadline: ${data.deadline || 'Not specified'}

ORGANIZATION PROFILE:
${safeTruncateContext(data.orgProfile || {}, 2500)}

RULES:
1. Each requirement must be ONE concrete, checkable action or qualification (e.g. "Hold active 501(c)(3) status", "Provide 2 letters of support from community partners", "Submit budget not exceeding $75,000", "Operate within California").
2. Set "isEligibilityGate" true ONLY for hard gates that would disqualify the application outright (legal status, geography, budget cap, deadline registration).
3. Set "orgStatus" to "met", "unmet", or "unknown" based ONLY on what the org profile states. Use "unknown" liberally — do not guess.
4. Derive requirements ONLY from the grant info provided. Do NOT invent requirements not implied by the text.
5. If the grant info is too vague to extract a category of requirements, add a note to "missingInfo" describing what guideline details should be confirmed on the funder's website.

OUTPUT FORMAT — Respond ONLY with this exact JSON. No preamble. No markdown fences.
{
  "requirements": [
    {
      "text": "string — one concrete, checkable requirement",
      "category": "Eligibility | Geography | Budget | Documents | Formatting | Logistics | Reporting",
      "isEligibilityGate": boolean,
      "orgStatus": "met | unmet | unknown",
      "note": "string — brief guidance on how to satisfy it, or '' if obvious"
    }
  ],
  "missingInfo": ["string — guideline details that could not be determined from the info provided"]
}`;

    case 'align-grant-ecadrn':
      return `You are an expert grant writer for ECADRN (Equity Center for Alternative Dispute Resolution & Negotiation). Align the following grant opportunity with ECADRN's mission of advancing ADR, conflict resolution, and civic equity.

Return JSON:
{
  "alignmentScore": number 0-100,
  "matchExplanation": "string — ONE sentence, format: 'Strong: <single biggest specific strength>; Watch: <single biggest specific risk/weakness>' — cite concrete details like program names, locations, budget history, or eligibility constraints",
  "rationale": "string — 2-3 sentences explaining the alignment",
  "suggestedApproach": "string — how ECADRN should frame their application",
  "keyPrograms": ["string — which ECADRN programs fit this grant"]
}

Grant Opportunity:
${safeTruncateContext(data, 4000)}`;

    case 'align-to-funder':
      return `You are a grant alignment expert. Align the following proposal section to match the funder's priorities and language.
Return JSON: { "alignedContent": "string", "changes": ["string — what was changed and why"] }

Funder Priorities: ${data.funderPriorities || 'Not specified'}
Funder Language: ${data.funderLanguage || 'Not specified'}
Proposal Section: ${data.content || ''}`;

    case 'compare-proposals':
      return `You are an expert grant reviewer who evaluates competing proposal drafts and recommends the strongest version.
Return JSON:
{
  "winner": "A | B",
  "reasoning": "string — 3-4 sentences explaining the choice",
  "strengthsA": ["string"], "weaknessesA": ["string"],
  "strengthsB": ["string"], "weaknessesB": ["string"],
  "mergedRecommendation": "string — how to combine the best of both"
}

Proposal A: ${safeTruncateContext(data.proposalA, 4000)}
Proposal B: ${safeTruncateContext(data.proposalB, 4000)}`;

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
${safeTruncateContext(data.documents, 8000)}`;
    case 'autopilot-search':
      return `You are a nonprofit grants researcher specializing in ADR, conflict resolution, access to justice, and civic equity funding. You have access to web search — USE IT to find REAL, CURRENT, ACTIVE grant opportunities.

TASK: Search the web to identify up to ${data.count || 8} REAL, VERIFIABLE, CURRENTLY ACTIVE grant opportunities that are a strong mission fit for the organization below.

SEARCH INSTRUCTIONS:
1. Search for current grant opportunities in ADR, conflict resolution, restorative justice, and access to justice
2. Search for foundations currently accepting applications in the dispute resolution space
3. Verify each program is real and currently active
4. Find real deadlines and award amounts
5. Search for: "access to justice grants 2026", "mediation program funding", "restorative justice foundation grants", "conflict resolution nonprofit funding"
6. Search for state-level justice department grants that include mediation/dispute resolution components
7. Search for bar foundation grants in states relevant to the geographic focus
8. Search for federal grants on grants.gov related to dispute resolution or access to justice

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile || {}).slice(0, 4000)}

SEARCH PARAMETERS:
Focus areas: ${data.focusAreas || 'ADR, conflict resolution, access to justice, restorative justice'}
Geographic scope: ${data.geographicFocus || 'National'}

⚠️ STRICT ANTI-HALLUCINATION RULES — FOLLOW EXACTLY:
1. ONLY include funders that ACTUALLY EXIST and are KNOWN to fund nonprofits in the ADR, conflict resolution, access to justice, or civic equity space.
2. ONLY include grant programs that have ACTUALLY EXISTED or are CURRENTLY ACTIVE. Do NOT invent program names.
3. If you are not certain a grant program exists, DO NOT include it. Fewer results is better than fabrication.
4. Every "title" must be the REAL name of an actual grant program — not a description you made up.
5. Every "funderName" must be a REAL organization with a real website.
6. "url" must be a real URL for the grant or funder — set to null if you are not certain.
7. "deadline" must be null unless you have specific knowledge of a real deadline date.
8. "amountMin" and "amountMax" must reflect ACTUAL known award ranges — do not fabricate numbers.
9. Set "verified": false unless you are highly confident the program is real and currently active.

KNOWN FUNDERS IN THIS SPACE:
Open Society Foundations, Z. Smith Reynolds Foundation, Hewlett Foundation, MacArthur Foundation,
Robert Wood Johnson Foundation, JPMorgan Chase Foundation, Google.org, National Institute of Justice,
Surdna Foundation, Woods Fund Chicago, JAMS Foundation, AAA-ICDR Foundation, NIDR, State Bar Foundations,
Boren Foundation, Mary Reynolds Babcock Foundation, Kate B. Reynolds Charitable Trust,
Public Welfare Foundation, ABA Section of Dispute Resolution grants.

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
[
  {
    "title": "string — real grant program name",
    "funderName": "string — real funder name",
    "funderType": "Foundation | Government | Corporation | Community Foundation | University",
    "description": "string — 2-3 sentences",
    "focusAreas": ["string"],
    "geographicFocus": "string",
    "amountMin": number,
    "amountMax": number,
    "deadline": "YYYY-MM-DD or null",
    "url": "string or null",
    "matchScore": number,
    "alignmentRationale": "string — 2 sentences on ECADRN fit",
    "matchExplanation": "string — ONE sentence: 'Strong: <specific strength — name a program/priority that maps directly>; Watch: <specific gap — budget size, geography, eligibility, or competition level>'",
    "verified": boolean
  }
]`;

    case 'chat':
      return `You are ECADRN's AI grant writing assistant. You help with grant strategy, proposal writing, funder research, and nonprofit fundraising questions. Be specific, actionable, and reference ECADRN's actual programs when relevant.

Respond in JSON format:
{"reply": "your response text"}

Conversation context: ${data.context || ''}
Recent history: ${JSON.stringify(data.history || []).slice(-2000)}
User message: ${data.message || ''}`;

    case 'generate-budget':
      return `You are a nonprofit budget analyst specializing in ADR and civic equity grant budgets.

TASK: Generate a detailed, realistic grant budget based on the project description below. Follow standard federal/foundation budget categories.

PROJECT DESCRIPTION:
${data.description || ''}

REQUIREMENTS:
- Include Personnel costs (program staff time allocation), Fringe Benefits (~20-28% of personnel)
- Include Travel (conference, site visits, training), Equipment (if applicable), Supplies
- Include Indirect/Overhead costs (typically 10-15% for foundations, up to 26% for federal)
- Each line item must have a specific, realistic dollar amount based on market rates
- Justification must explain HOW the amount was calculated (rate × hours, per-person cost, etc.)
- Total budget should be appropriate for a mid-size nonprofit grant ($25K-$150K range)
- Include at least one line item for training materials and one for community outreach

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
[
  {
    "id": "string — unique identifier",
    "category": "Personnel | Fringe Benefits | Travel | Equipment | Supplies | Contractual | Other | Indirect",
    "description": "string — specific line item",
    "amount": number,
    "justification": "string — how the amount was calculated"
  }
]`;

    case 'generate-justification':
      return `Write a budget justification for this line item. Return JSON: {"justification": "string"}

Project Description: ${data.projectDescription || ''}
Line Item: ${data.description || ''}
Amount: $${data.amount || 0}`;

    case 'generate-timeline':
      return `Generate a project timeline with milestones for a grant-funded program. Return a JSON array of milestones:
[{"date": "YYYY-MM-DD", "title": "string", "description": "string"}]

Create 5-8 realistic milestones spanning the project duration. Start dates should be in the near future.
Each milestone should have a clear title and 1-2 sentence description.

Project Description: ${data.description || 'Grant proposal for ADR and conflict resolution programs'}`;

    case 'generate-outreach-email':
      return `Write a professional outreach email for a nonprofit fundraising context. You have access to web search — use it to research the funder if needed.

Email Type: ${data.emailType || 'introduction'}
Funder: ${JSON.stringify(data.funder || {})}
Organization: ${JSON.stringify(data.organization || { name: 'ECADRN (Equity Center for Alternative Dispute Resolution & Negotiation)' })}
${data.proposal ? 'Related Proposal: ' + JSON.stringify(data.proposal) : ''}
${data.voiceProfile ? 'Voice Profile (match this tone): ' + JSON.stringify(data.voiceProfile) : ''}
${data.funderIntelligence ? 'FUNDER INTELLIGENCE (from research): ' + JSON.stringify(data.funderIntelligence) : ''}

EMAIL TYPE GUIDELINES:
- introduction (Cold Intro): 250-300 words. Introduce ECADRN, reference the funder's giving priorities, propose a brief call. Tone: warm but professional.
- loi (Letter of Inquiry): 350-400 words. Formal structure: org intro, program description, alignment to funder priorities, specific ask amount range, next steps.
- followup (Follow-Up): 150-200 words. Reference prior contact, reiterate alignment, suggest next step. Tone: gracious, not pushy.
- thankyou (Thank You): 100-150 words. Express gratitude, mention impact, keep door open for future.

INSTRUCTIONS:
1. If funder intelligence is provided, reference their ACTUAL giving priorities, recent grants, or strategic focus areas — not generic language.
2. Match the organization's voice profile tone if provided.
3. Be specific about ECADRN's programs: early-career ADR professional support, trauma-informed mediation, peer networks, restorative circles, access to justice.
4. Do NOT use generic fundraising cliches ("we are writing to...", "we hope this email finds you well").
5. Include a clear, specific call-to-action appropriate to the email type.
6. If a proposal is referenced, mention its title and how it aligns with the funder.
7. For LOI emails, include a specific dollar ask range based on the funder's typical grant size.

OUTPUT FORMAT — Return ONLY this JSON. No markdown fences.
{"subject": "string — compelling subject line", "body": "string — the email body, with proper paragraph breaks using \\n\\n"}`;

    case 'humanize-proposal':
      return `You are a grant writing editor who specializes in making proposals sound authentic, compelling, and human — not like AI-generated text.

TASK: Review the proposal below and provide specific, actionable feedback to make it more natural and persuasive.

FUNDER: ${data.funderName || 'Unknown'}

PROPOSAL SECTIONS:
${JSON.stringify(data.proposal || {}).slice(0, 6000)}

ANALYZE FOR:
1. AI-sounding phrases ("delve", "tapestry", "testament", "leverage", "robust", "moreover", "it is important to note", "in today's world", "at the heart of", "navigating the landscape", "catalyst for change", "bridging divides", "fostering dialogue")
2. Generic filler that could apply to any nonprofit — flag and suggest org-specific replacements
3. Missing concrete data, specific numbers, named programs, or real outcomes
4. Passive voice where active voice would be stronger
5. Lack of community voice — direct quotes, stories, or constituent perspectives
6. Weak transitions between sections
7. Budget narrative alignment with activities

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
{
  "aiProbabilityScore": number (0-100, probability an AI detector would flag this text as AI-generated),
  "humanScore": number (0-100, how natural and human the text sounds),
  "funderAiCheckRisk": "High" | "Medium" | "Low" (likelihood a funder's AI screening tool would flag this),
  "readabilityGrade": "string — Flesch-Kincaid grade level estimate (e.g. 'Grade 12'),
  "structuralVarianceAdvice": "string — 2-3 sentences on how to vary sentence structure to reduce AI detection",
  "bannedWordsFound": ["string — exact banned/AI-cliché words found in the text"],
  "flaggedPhrases": ["string — exact phrases that sound AI-generated, with the section name"],
  "sectionAverages": [
    {"sectionName": "string — section name", "detectionProbability": number (0-100, AI detection probability for this section)}
  ],
  "verdict": "string — 1-2 sentence overall verdict on the proposal's naturalness",
  "suggestions": ["string — specific, actionable improvement with the exact text to change"],
  "rewrittenSection": "string — a fully rewritten version of the weakest section, showing what natural grant writing looks like"
}`;

    case 'identify-missing':
      return `Analyze the current application features and suggest what's missing for a complete grant writing platform. Return JSON:
{"missing": [{"feature": "string", "priority": "high|medium|low", "description": "string"}]}

Current Features: ${JSON.stringify(data.currentFeatures || [])}
Organization: ${JSON.stringify(data.orgProfile || {}).slice(0, 2000)}`;

    case 'review-proposal':
      return `You are a senior grant reviewer with experience on foundation and government review panels.

Review this grant proposal for quality and completeness.

GRANT: ${data.grantTitle || ''}
FUNDER: ${data.funderName || ''}
DESCRIPTION: ${data.grantDescription || ''}

PROPOSAL:
${JSON.stringify(data.proposal || {}).slice(0, 6000)}

Evaluate against these criteria:
1. Clarity and specificity — does every section contain concrete details?
2. Funder alignment — does the proposal mirror the funder's priorities?
3. SMART goals — are goals specific, measurable, achievable, relevant, time-bound?
4. Budget narrative — does it align with activities and show the math?
5. Community voice — are constituent perspectives included?
6. Sustainability — are there 3+ concrete revenue strategies?
7. AI clichés — flag any AI-sounding phrases

Return JSON with:
- "overallScore" (number): 0-100
- "sectionScores" (object): score per section (0-100), keys: executiveSummary, needStatement, projectDescription, goalsObjectives, methodology, evaluationPlan, sustainability, organizationalCapacity, budgetNarrative
- "strengths" (array of strings): specific strengths
- "weaknesses" (array of strings): specific weaknesses with the section name
- "recommendations" (array of strings): actionable improvements
- "aiClichesFound" (array of strings): AI-sounding phrases detected`;

    case 'rewrite-voice':
      return `Rewrite the following content to match the organization's voice profile. Maintain all factual content but adjust tone, word choice, and sentence structure. Return JSON: {"content": "rewritten text"}

Voice Profile: ${JSON.stringify(data.voiceProfile || {}).slice(0, 2000)}
Content: ${data.content || ''}`;
    case 'find-adr-partners':
      return `You are a research specialist in Alternative Dispute Resolution (ADR) organizations, university programs, and educational institutions in the United States. You have access to web search — USE IT EXTENSIVELY to find REAL organizations.

TASK: Search the web to identify REAL, VERIFIABLE organizations, school programs, and schools in the US that have donated to, sponsored, or partnered with nonprofits like ECADRN. Focus on finding potential funding partners and collaboration opportunities.

SEARCH INSTRUCTIONS — perform these searches:
1. Search for "university dispute resolution program funding nonprofit" and "law school ADR clinic community partnership"
2. Search for "community mediation center grant funding" and "bar association dispute resolution section nonprofit support"
3. Search for foundations that specifically fund ADR, restorative justice, or conflict resolution work
4. Search for "alternative dispute resolution education program donation" and "restorative justice university program funding"
5. Search for state-level ADR offices and government programs that support community mediation
6. Search for professional associations (ACR, ABA Section of Dispute Resolution, etc.) that offer grants or partnerships
7. For each result, search for their specific funding/partnership history with nonprofits
8. Search for "ADR nonprofit funding sources" and "conflict resolution organization grants"

SEARCH PARAMETERS:
Organization profile: ${JSON.stringify(data.orgProfile || {}).slice(0, 3000)}
Focus areas: ${data.focusAreas || 'ADR, conflict resolution, restorative justice, access to justice, mediation, peer mediation'}
Geographic scope: ${data.geographicScope || 'United States'}
Partner type: ${data.partnerType || 'all'}
Search mode: ${data.searchMode || 'all'} — ${data.searchModeLabel || 'Find all types of partners'}

If searchMode is 'funders', PRIORITIZE organizations with a known history of donating to or funding ADR nonprofits.
If searchMode is 'schools', PRIORITIZE universities, law schools, and educational programs that have sponsored or partnered with ADR nonprofits.
If searchMode is 'partnerships', PRIORITIZE organizations open to program collaboration, in-kind support, and research partnerships.

ECADRN MISSION: Equity Center for Alternative Dispute Resolution & Negotiation — supports early-career ADR professionals through structural equity, trauma-informed mediation, peer networks, access to justice, restorative circle spaces, and professional empowerment.

⚠️ STRICT ANTI-HALLUCINATION RULES:
1. ONLY include organizations that ACTUALLY EXIST and can be verified via web search. Include real names, real websites, real programs.
2. Do NOT invent organizations or programs. If you are not certain an organization exists, exclude it.
3. Include REAL contact information found via web search — websites, email addresses, phone numbers, program directors if known.
4. Focus on US-based institutions: universities with ADR/mediation clinics, law schools with dispute resolution programs, community mediation centers, bar association dispute resolution sections, state ADR offices, and foundations that fund ADR work.
5. For each result, explain HOW they could support ECADRN — funding, partnership, in-kind support, program collaboration, internship hosting, research collaboration.
6. Include specific details about past funding or partnerships with ADR nonprofits if found via web search.
7. Prioritize organizations that have a HISTORY of donating to or funding nonprofits in the ADR/conflict resolution space.

OUTPUT FORMAT — Respond ONLY with this exact JSON (strictly valid, no markdown fences):
[
  {
    "name": "string — real organization/school/program name",
    "type": "University | Law School | Community Organization | Bar Association | Government Office | Foundation | Professional Association",
    "website": "string — real URL verified via web search",
    "location": "string — city, state",
    "programOrDepartment": "string — specific ADR/dispute resolution program or department name",
    "adrFocus": ["string — ADR-related focus areas"],
    "fundingHistory": "string — known history of funding or supporting ADR nonprofits found via web search, or 'No public funding history found'",
    "contactInfo": "string — email, phone, or contact page URL if known from web search",
    "partnershipPotential": "string — 2-3 sentences on how ECADRN could partner with or seek funding from this organization",
    "alignmentScore": number — 0-100 how well aligned with ECADRN mission,
    "verified": boolean,
    "fundingType": "string — 'Direct Grant' | 'Sponsorship' | 'Partnership' | 'In-kind Support' | 'Program Collaboration' | 'Internship/Training' | 'Unknown'",
    "estimatedFundingRange": "string — estimated or known funding range, e.g., '$5,000-$25,000' or 'Unknown'"
  }
]`;

// ── New AI Actions (Phase 2) ─────────────────────────────────────────────

    case 'refine-section':
      return `You are an expert nonprofit grant writer specializing in ADR, conflict resolution, and civic equity funding.

TASK: Refine a single section of a grant proposal based on the user's specific feedback. Keep everything that works — only change what the user asked for. Maintain the organization's voice profile throughout.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile || {}).slice(0, 2000)}

VOICE PROFILE:
Tone: ${data.toneDescriptors || 'professional, mission-driven'}
Key phrases: ${data.keyPhrases || ''}
Voice rules: ${data.voiceRules || ''}

GRANT CONTEXT:
Title: ${data.grantTitle || ''}
Funder: ${data.funderName || ''}
Funder priorities: ${data.funderPriorities || ''}

CURRENT SECTION:
Section name: ${data.sectionName || ''}
Current content:
${data.currentContent || ''}

USER FEEDBACK (what to change):
${data.feedback || 'Improve this section.'}

OTHER SECTIONS (for context — do NOT modify these, use only to ensure consistency):
${JSON.stringify(data.otherSections || {}).slice(0, 3000)}

RULES:
1. Return ONLY the refined section content — no explanation, no preamble.
2. Maintain factual accuracy — do not invent new programs, data, or outcomes.
3. Keep the voice profile consistent with the original.
4. If the user asks to shorten, cut filler not substance.
5. If the user asks to add data, use placeholders like [INSERT: specific statistic about X] for data the org would need to verify.
6. DO NOT use AI clichés: "delve", "tapestry", "testament", "leverage", "robust", "moreover", "it is important to note".
7. Use active voice.

OUTPUT FORMAT — Respond ONLY with this exact JSON. No markdown fences.
{
  "content": "string — the refined section content",
  "changes": ["string — brief description of each change made"],
  "wordCount": number
}`;

    case 'pre-submit-check':
      return `You are a senior grant reviewer performing a final pre-submission quality gate check. This is the last check before the proposal goes to the funder.

TASK: Perform a comprehensive quality assessment combining structural review, AI-detection analysis, and fact verification into a single go/no-go recommendation.

GRANT: ${data.grantTitle || ''}
FUNDER: ${data.funderName || ''}
FUNDER PRIORITIES: ${data.funderPriorities || 'Not specified'}

PROPOSAL SECTIONS:
${JSON.stringify(data.proposal || {}).slice(0, 8000)}

CHECK THESE DIMENSIONS:
1. COMPLETENESS — Are all required sections present and substantive (not placeholders)?
2. FUNDER ALIGNMENT — Does the proposal mirror the funder's stated priorities and language?
3. SMART GOALS — Are goals specific, measurable, achievable, relevant, time-bound?
4. BUDGET ALIGNMENT — Does the budget narrative match the described activities?
5. COMMUNITY VOICE — Are constituent perspectives, quotes, or lived-experience references included?
6. SUSTAINABILITY — Are there 3+ concrete revenue diversification strategies?
7. DATA CITATION — Are statistics and claims sourced? Flag unsourced claims.
8. AI CLICHÉS — Flag any AI-sounding phrases: "delve", "tapestry", "testament", "leverage", "robust", "moreover", "it is important to note", "in today's world", "at the heart of", "navigating the landscape", "catalyst for change", "bridging divides", "fostering dialogue"
9. ACTIVE VOICE — Flag instances of passive voice that should be active.
10. WORD COUNTS — Are sections within reasonable ranges?

OUTPUT FORMAT — Respond ONLY with this exact JSON. No markdown fences.
{
  "recommendation": "go | no-go | revise",
  "overallScore": number 0-100,
  "mustFix": ["string — critical issues that MUST be resolved before submission"],
  "shouldFix": ["string — important improvements that would strengthen the proposal"],
  "niceToHave": ["string — optional polish items"],
  "sectionIssues": {
    "executiveSummary": ["string — issues found, or empty array if clean"],
    "needStatement": ["string"],
    "projectDescription": ["string"],
    "goalsObjectives": ["string"],
    "methodology": ["string"],
    "evaluationPlan": ["string"],
    "sustainability": ["string"],
    "organizationalCapacity": ["string"],
    "budgetNarrative": ["string"]
  },
  "aiClichesFound": ["string — exact AI-sounding phrases detected"],
  "unsourcedClaims": ["string — specific claims that need citation"],
  "passiveVoiceInstances": ["string — specific instances with suggested active rewrite"],
  "summary": "string — 3-4 sentence overall assessment"
}`;

    case 'analyze-competitors':
      return `You are a nonprofit grants strategist specializing in ADR and conflict resolution funding. You have access to web search — USE IT EXTENSIVELY.

TASK: Research organizations that have previously received funding from this funder or for this specific grant program. Analyze what made their proposals successful and provide actionable intelligence for ECADRN's application.

SEARCH INSTRUCTIONS:
1. Search for past recipients of this specific grant program
2. Search for the funder's recent 990 filings or annual reports listing grantees
3. Search for press releases or announcements of past award winners
4. Search for "funder name + grant recipients" and "funder name + awarded"
5. For each competitor found, search for their website to understand their programs and approach
6. Search for any publicly available winning proposals or summaries

FUNDER: ${data.funderName || ''}
GRANT PROGRAM: ${data.grantTitle || ''}
FUNDER WEBSITE: ${data.funderUrl || 'Not provided'}

APPLYING ORGANIZATION — ECADRN:
Mission: Supports early-career ADR professionals through structural equity, trauma-informed mediation, peer networks, access to justice, restorative circle spaces, and professional empowerment.
Programs: ADR Fellowship, Peer Mediation Circles, Justice Access Lab, Early Career Mentorship Network.

⚠️ ANTI-HALLUCINATION RULES:
1. ONLY include organizations you can verify via web search actually received funding.
2. Do NOT fabricate competitor names or award amounts.
3. If you cannot find past recipients, state that clearly.

OUTPUT FORMAT — Respond ONLY with this exact JSON. No markdown fences.
{
  "similarOrganizations": [
    {
      "name": "string — real organization name",
      "website": "string or null",
      "yearAwarded": "string",
      "amount": "string or null",
      "strength": "string — 1-2 sentences on what likely made their proposal competitive",
      "overlap": "string — 1 sentence on how their work overlaps with ECADRN's mission"
    }
  ],
  "commonWinningElements": ["string — patterns across successful proposals"],
  "differentiators": ["string — ECADRN's unique strengths vs. competitors"],
  "gaps": ["string — areas where competitors are stronger and ECADRN should address"],
  "recommendation": "string — 4-5 sentence strategy for how ECADRN should position against these competitors",
  "researchConfidence": "high | medium | low"
}`;

    case 'prioritize-grants':
      return `You are a nonprofit grant strategy advisor. Analyze the grant pipeline and recommend which grants to pursue first.

TASK: Given a list of grant opportunities with deadlines, alignment scores, and award amounts, produce a prioritized ranking with reasoning.

GRANT PIPELINE:
${JSON.stringify(data.grants || []).slice(0, 10000)}

ORGANIZATION CONTEXT:
${JSON.stringify(data.orgProfile || {}).slice(0, 2000)}

CURRENT PROPOSAL COUNT: ${data.activeProposalCount || 0}
TEAM CAPACITY: ${data.teamCapacity || 'small team, 1-2 grant writers'}

PRIORITIZATION FACTORS:
1. Deadline urgency — how soon is the deadline? Can the proposal be written in time?
2. Mission alignment — how well does this grant fit ECADRN's programs?
3. Award amount — is the effort justified by the potential funding?
4. Competition level — how competitive is this grant? (lower competition = higher priority)
5. Effort estimate — how much work will the proposal require?
6. Win probability — given alignment and capacity, how likely is ECADRN to win?

OUTPUT FORMAT — Respond ONLY with this exact JSON. No markdown fences.
{
  "topPicks": [
    {
      "title": "string — grant title",
      "funderName": "string",
      "rank": number,
      "priority": "critical | high | medium | low | skip",
      "reason": "string — 2-3 sentences explaining this ranking",
      "estimatedEffort": "string — 'low' | 'medium' | 'high'",
      "estimatedEffortHours": number,
      "winProbability": number 0-100,
      "deadlineUrgency": "string — 'urgent (≤2 weeks)' | 'near (≤1 month)' | 'comfortable (≤3 months)' | 'distant (>3 months)'",
      "recommendedAction": "string — specific next step"
    }
  ],
  "strategy": "string — 3-4 sentence strategic overview of the pipeline",
  "topPick": "string — grant title of the #1 recommendation",
  "deprioritize": ["string — grants to skip and why"]
}`;

    case 'explain-diff':
      return `You are a grant writing editor. Compare two versions of a proposal section and explain what changed, whether the changes are improvements, and any concerns.

Return JSON:
{
  "changes": [{"type": "addition | deletion | modification | move", "description": "string", "assessment": "improvement | neutral | regression"}],
  "overallAssessment": "string — 2-3 sentences on whether the new version is better overall",
  "concerns": ["string — any issues introduced by the changes"],
  "recommendation": "string — keep new version | revert | merge"
}

Section name: ${data.sectionName || ''}
Old version:
${data.oldContent || ''}

New version:
${data.newContent || ''}`;

    case 'recommend-funders':
      return `You are a nonprofit fundraising strategist for ECADRN. Analyze the organization's funder database and grant pipeline to recommend which funders ECADRN should pursue next, based on their giving cycles, past relationship history, and mission alignment.

CURRENT FUNDER DATABASE:
${JSON.stringify(data.funders || []).slice(0, 8000)}

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile || {}).slice(0, 2000)}

RECENT GRANT PIPELINE:
${JSON.stringify(data.grants || []).slice(0, 3000)}

TASK: Recommend the top 5 funders ECADRN should engage with next, considering:
1. Relationship stage — warm contacts should be prioritized over cold
2. Giving cycle timing — are they likely accepting applications now or soon?
3. Mission alignment — how well do their priorities match ECADRN's programs?
4. Funding history — have they funded ADR/mediation work before?
5. Gap analysis — are there funders in the database that ECADRN hasn't approached yet?

OUTPUT FORMAT — Respond ONLY with this exact JSON. No markdown fences.
{
  "recommendations": [
    {
      "funderName": "string",
      "priority": "critical | high | medium | low",
      "reasoning": "string — 2-3 sentences explaining why this funder should be prioritized",
      "suggestedAction": "string — specific next step: 'Send LOI' | 'Schedule intro call' | 'Submit full proposal' | 'Research deadlines' | 'Send outreach email'",
      "estimatedAskRange": "string — suggested ask amount based on their typical grant size",
      "timing": "string — 'now' | 'within 1 month' | 'within 3 months' | 'long-term'"
    }
  ],
  "untouchedFunders": ["string — funders in the database with no relationship activity yet"],
  "warmFollowUps": ["string — funders with prior contact who need a follow-up"],
  "summary": "string — 3-4 sentence strategic overview"
}`;


    case 'analyze-win-loss': {
      const proposal = data.proposal || {};
      const funder = data.funder || {};
      const voiceProfile = data.voiceProfile || {};
      const outcome = data.outcome || 'unknown';
      const awarded = outcome === 'awarded';

      return `You are a fundraising strategist analyzing ${awarded ? 'a WINNING' : 'a REJECTED'} grant proposal to extract lessons for future applications.

## Proposal Details
- Title: ${proposal.title || 'Unknown'}
- Funder: ${funder.funderName || funder.name || 'Unknown'}
- Funder Type: ${funder.funderType || 'Unknown'}
- Requested Amount: ${proposal.budgetTotal || proposal.amount || 'Unknown'}
- Voice Profile Used: ${voiceProfile.name || 'Default'}
- Outcome: ${outcome}

## Proposal Content
${(proposal.sections || []).map((s: any) => '### ' + s.title + '\n' + (s.content || '')).join('\n\n') || 'No content provided'}

## Funder Intelligence
${funder.intelligence || 'No intelligence data available'}

## Analysis Required
Analyze ${awarded ? 'why this proposal WON' : 'why this proposal was REJECTED'} and extract actionable insights.

Return JSON:
{
  "outcome": "${outcome}",
  "analysis": {
    "strengths": ["string — 3-5 things that worked well"],
    "weaknesses": ["string — 3-5 things that didn't work or were missing"],
    "funderFit": "string — 0-100 score on how well the proposal matched the funder's priorities",
    "voiceAlignment": "string — 0-100 score on voice/tone match",
    "budgetAccuracy": "string — 0-100 score on budget appropriateness",
    "keyFactors": ["string — the 3 biggest factors that influenced the outcome"]
  },
  "lessonsLearned": {
    "dos": ["string — 3-5 recommendations for future proposals to this funder type"],
    "donts": ["string — 3-5 things to avoid in future proposals"],
    "bestPractices": ["string — 2-3 reusable patterns that worked"]
  },
  "funderSpecificInsights": "string — specific intelligence about this funder's preferences for future applications",
  "recommendedVoiceProfile": "string — which voice profile characteristics worked best, or what to try next time",
  "confidenceScore": "number — 0-100 how confident the AI is in this analysis",
  "summary": "string — 2-3 sentence executive summary"
}`;
    }

    case 'detect-recurring': {
      const grant = data.grant || {};
      return `You are a grants research analyst. Analyze this grant opportunity to determine if it is a recurring grant (annual, biannual, quarterly, or cyclical).

## Grant Details
- Title: ${grant.title || 'Unknown'}
- Funder: ${grant.funderName || grant.funder || 'Unknown'}
- Deadline: ${grant.deadline || 'Unknown'}
- URL: ${grant.url || grant.source || 'Unknown'}
- Description: ${grant.description || grant.eligibility || 'No description'}

Use web search to verify if this funder offers this grant on a recurring basis. Look for phrases like "annual", "yearly", "cycle", "recurring", "rolling", "next round", "previous cycle".

Return JSON:
{
  "isRecurring": boolean,
  "cycle": "annual" | "biannual" | "quarterly" | "monthly" | "one-time" | "unknown",
  "estimatedNextCycle": "string — ISO date or human-readable estimate of when the next cycle opens",
  "confidenceScore": number,
  "notes": "string — details about the recurring pattern, if found",
  "historicalData": ["string — past award dates or cycle dates if found via search"]
}`;
    }

    default:
      return 'INVALID';
  }
}

// ── Response Validation ──────────────────────────────────────────────────────

function validateResponse(action: string, parsed: any): { valid: boolean; error?: string } {
  if (parsed === null || parsed === undefined) return { valid: false, error: 'Null response' };
  if (typeof parsed !== 'object') return { valid: false, error: 'Expected object or array' };

  const arrayActions = ['discover-grants', 'autopilot-search', 'find-adr-partners', 'generate-budget', 'generate-timeline'];
  if (arrayActions.includes(action)) {
    if (!Array.isArray(parsed)) return { valid: false, error: 'Expected array response' };
    return { valid: true };
  }

  const requiredKeys: Record<string, string[]> = {
    'generate-draft': ['executiveSummary', 'needStatement', 'projectDescription', 'methodology'],
    'agent-write-proposal': ['executiveSummary', 'needStatement', 'projectDescription', 'methodology'],
    'research-funder': ['funderOverview', 'missionAlignmentScore'],
    'research-grant-url': ['grantTitle', 'funderName'],
    'score-alignment': ['overallScore', 'dimensionScores'],
    'review-proposal': ['overallScore', 'sectionScores'],
    'humanize-proposal': ['aiProbabilityScore', 'humanScore'],
    'generate-outreach-email': ['subject', 'body'],
    'chat': ['reply'],
    'refine-section': ['content'],
    'pre-submit-check': ['recommendation', 'overallScore'],
    'analyze-competitors': ['similarOrganizations'],
    'prioritize-grants': ['topPicks'],
    'explain-diff': ['changes'],
    'recommend-funders': ['recommendations'],
    'align-grant-ecadrn': ['alignmentScore', 'rationale', 'suggestedApproach'],
    'align-to-funder': ['alignedContent', 'changes'],
    'compare-proposals': ['winner', 'comparison'],
    'generate-justification': ['justification'],
    'analyze-voice': ['toneDescriptors', 'keyPhrases'],
    'rewrite-voice': ['content'],
    'identify-missing': ['missing'],
    'analyze-win-loss': ['winProbability', 'keyFactors'],
    'detect-recurring': ['recurringGrants'],
    'analyze-uploaded-grant': ['grantTitle', 'funderName'],
    'generate-budget': [],
    'generate-timeline': [],
  };

  const keys = requiredKeys[action];
  if (keys) {
    for (const key of keys) {
      if (!(key in parsed)) return { valid: false, error: `Missing required field: ${key}` };
    }
  }

  return { valid: true };
}

// Helper to clean JSON from response (fallback if native JSON mode isn't available)
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/^`\s*/, '');
  cleaned = cleaned.replace(/```\s*$/, '');
  cleaned = cleaned.replace(/`\s*$/, '');
  cleaned = cleaned.trim();

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
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers,
  });
}

async function verifyFirebaseToken(token: string, projectId: string): Promise<any> {
  try {
    // Use jose to cryptographically verify the JWT signature against Google's public keys
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    // ECADRN organization lock: email must end with @ecadrn.org
    if (!payload.email || typeof payload.email !== 'string' || !payload.email.endsWith('@ecadrn.org')) {
      console.error('Unauthorized email domain:', payload.email);
      return null;
    }

    return payload;
  } catch (err: any) {
    console.error('Token verification error:', err?.message || err);
    return null;
  }
}

// ── AI Generation Engine ──────────────────────────────────────────────────────

async function runGeneration(
  ai: GoogleGenAI,
  prompt: string,
  config: { model: string; temperature: number; maxTokens: number; useSearch: boolean },
  useJsonMode: boolean
): Promise<string> {
  const generationConfig: any = {
    model: config.model,
    contents: prompt,
    config: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
  };

  // Native JSON mode — Gemini guarantees valid JSON output
  // Cannot use responseMimeType with googleSearch tool, so only for non-search actions
  if (useJsonMode && !config.useSearch) {
    generationConfig.config.responseMimeType = 'application/json';
  }

  // Add Google Search tool for research actions
  if (config.useSearch) {
    generationConfig.config.tools = [{ googleSearch: {} }];
  }

  const generationPromise = ai.models.generateContent(generationConfig);
  generationPromise.catch((err: any) => console.warn('Background generation completed/failed after timeout:', err?.message || err));

  const timeoutMs = config.useSearch ? 45000 : 30000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
  });

  const res = await Promise.race([generationPromise, timeoutPromise]);
  return res.text?.trim() || '';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'];
    const responseOrigin = allowedOrigins.includes(origin) ? origin : env.ALLOWED_ORIGIN;

    const corsHeaders = {
      'Access-Control-Allow-Origin': responseOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Drive-Token, X-Google-Token',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const json = (data: any, status = 200, extraHeaders: Record<string, string> = {}) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
      });

    try {
    // Validate essential environment configuration
    if (!env.GEMINI_API_KEY) {
      return json({ error: 'Server misconfiguration: GEMINI_API_KEY missing' }, 500);
    }
    if (!env.FIREBASE_PROJECT_ID) {
      return json({ error: 'Server misconfiguration: FIREBASE_PROJECT_ID missing' }, 500);
    }

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

      // Health check endpoint — reports current model tier status
      if (action === 'health') {
        const activeTier = await getActiveModelTier(env);
        let kvState: any = null;
        if (env.AI_CONFIG) {
          const raw = await env.AI_CONFIG.get('ai_model_state');
          if (raw) kvState = JSON.parse(raw);
        }
        return json({
          status: 'ok',
          activeModel: MODEL_TIERS[activeTier].model,
          activeTier,
          isFallback: activeTier > 0,
          availableModels: [...MODEL_TIERS.map(m => ({ model: m.model, label: m.label })), { model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (opt-in max quality)' }],
          userSelectable: ['auto', ...MODEL_TIERS.map(m => m.model), 'gemini-2.5-pro'],
          fallbackState: kvState ? {
            activatedAt: kvState.lastQuotaHit,
            cooldownMinutes: kvState.cooldownMinutes,
            consecutiveFailures: kvState.consecutiveFailures,
            failedModel: kvState.failedModel,
            fallbackModel: kvState.fallbackModel,
          } : null,
        });
      }

      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

      let body: any;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON payload in request body' }, 400);
      }
      if (!body || typeof body !== 'object') {
        return json({ error: 'Request body must be a JSON object' }, 400);
      }
      const prompt = getPrompt(action, body);
      if (prompt === 'INVALID') return json({ error: `Unknown action: ${action}` }, 400);

      const config = ACTION_CONFIG[action] || DEFAULT_CONFIG;
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const fallbackAi = env.GEMINI_API_KEY_FALLBACK
        ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY_FALLBACK })
        : null;

      // ── Model Fallback Loop ──────────────────────────────────────────────
      // Try models in order: primary → secondary → lite
      // Per model: attempt 1 = JSON mode, attempt 2 = non-JSON with explicit instruction
      // On quota error: switch to next model tier and record in KV
      // User preference (body.model): 'auto' = smart chain; a specific model id
      // starts at that tier; 'gemini-2.5-pro' gets one quality-first attempt
      // before falling back to the normal chain.
      const QUALITY_MODEL = 'gemini-2.5-pro';
      const prefModel = typeof body.model === 'string' ? body.model.trim() : '';
      let startTier = await getActiveModelTier(env);
      if (prefModel && prefModel !== 'auto' && MODEL_TIERS.some(t => t.model === prefModel)) {
        startTier = MODEL_TIERS.findIndex(t => t.model === prefModel);
      }

      let resultText = '';
      if (prefModel === QUALITY_MODEL) {
        // Quality-first: try 2.5 Pro before the standard chain
        for (let attempt = 0; attempt < 2 && !resultText; attempt++) {
          const attemptPrompt = attempt === 0
            ? prompt
            : `${prompt}\n\nCRITICAL: Respond with ONLY valid JSON. No markdown, no code fences, no preamble. Start with { or [ and end with } or ].`;
          try {
            const proText = await runGeneration(ai, attemptPrompt, { ...config, model: QUALITY_MODEL }, attempt === 0);
            if (proText) {
              resultText = proText;
              await clearModelFallback(env);
            }
          } catch (err: any) {
            if (err.message === 'TIMEOUT') {
              return json({ error: 'The AI is taking longer than expected. Please try again.' }, 503);
            }
            console.error(`Quality model (${QUALITY_MODEL}) attempt ${attempt + 1} failed for "${action}": ${err.message}`);
            if (!isQuotaError(err)) break;
          }
        }
        if (!resultText) {
          console.log(`⤵️ Pro failed — falling back to standard chain for "${action}"`);
        }
      }

      let lastError = '';
      let lastErrorIsQuota = false;
      let activeTier = startTier;
      let usedFallback = false;

      for (let tier = startTier; tier < MODEL_TIERS.length && !resultText; tier++) {
        const tierConfig = { ...config, model: MODEL_TIERS[tier].model };
        const tierAi = (tier >= 1 && fallbackAi) ? fallbackAi : ai;
        let tierSucceeded = false;

        // Two attempts per tier: JSON mode, then explicit-instruction mode
        for (let attempt = 0; attempt < 2; attempt++) {
          const useJsonMode = attempt === 0;
          let attemptPrompt = prompt;
          if (attempt === 1) {
            attemptPrompt = `${prompt}\n\nCRITICAL: Respond with ONLY valid JSON. No markdown, no code fences, no preamble. Start with { or [ and end with } or ].`;
          }

          try {
            resultText = await runGeneration(tierAi, attemptPrompt, tierConfig, useJsonMode);
            if (resultText) {
              tierSucceeded = true;
              activeTier = tier;
              usedFallback = tier > 0;
              break;
            }
          } catch (err: any) {
            if (err.message === 'TIMEOUT') {
              return json({ error: 'The AI is taking longer than expected. Please try again.' }, 503);
            }
            if (isQuotaError(err)) {
              // Rate-limited — record fallback and try next model tier
              console.error(`AI quota hit on ${MODEL_TIERS[tier].model} for "${action}": ${err.message}`);
              await recordModelFallback(env, tier);
              lastError = `${MODEL_TIERS[tier].model}: rate limited`;
              lastErrorIsQuota = true;
              break; // Break inner loop → outer loop tries next tier
            }
            // Non-quota error — try second attempt mode, or give up
            lastError = err.message || String(err);
            lastErrorIsQuota = false;
            console.error(`AI attempt ${attempt + 1} failed on ${MODEL_TIERS[tier].model} for "${action}": ${lastError}`);
          }
        }

        if (tierSucceeded) break;

        // For non-quota errors, don't bother trying next model — it won't help
        if (!lastErrorIsQuota) break;
      }

      if (!resultText) {
        if (lastErrorIsQuota) {
          return json({ error: 'All AI models are currently at capacity. The system will automatically retry with the primary model later. Please try again in a few minutes.' }, 503);
        }
        return json({ error: lastError || 'AI generation failed. Please try again.' }, 500);
      }

      // If primary model worked, clear any stale fallback state
      if (activeTier === 0) {
        await clearModelFallback(env);
      }

      const cleaned = cleanJsonResponse(resultText);

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error(`JSON parse failed for action "${action}". Raw length: ${cleaned.length}`);
        return json({ raw: cleaned, error: 'AI response was not valid JSON' }, 422);
      }

      // Validate the response structure
      const validation = validateResponse(action, parsed);
      if (!validation.valid) {
        console.error(`Validation failed for action "${action}": ${validation.error}`);
        return json({ error: `AI response schema invalid: ${validation.error}`, parsed }, 422);
      }

      // Include which model was used in response headers for frontend status display
      const aiHeaders: Record<string, string> = {
        'X-AI-Model': MODEL_TIERS[activeTier].model,
        'X-AI-Fallback': usedFallback ? 'true' : 'false',
        'X-AI-Tier': String(activeTier),
        'Access-Control-Expose-Headers': 'X-AI-Model, X-AI-Fallback, X-AI-Tier',
      };
      return json(parsed, 200, aiHeaders);
    }

    // ── Google Drive Routes ────────────────────────────────────────────────
    const driveToken = request.headers.get('X-Drive-Token') || request.headers.get('X-Google-Token');

    // ── Gmail Routes (per-user Google connection) ───────────────────────────
    if (path === '/gmail/send' && request.method === 'POST') {
      if (!driveToken) return json({ error: 'Google connection required. Connect your Google account in Settings.' }, 400);
      const body = await request.json() as any;
      const to = String(body?.to || '').trim();
      const messageBody = String(body?.body || '').trim();
      if (!to || !messageBody) return json({ error: 'to, subject, and body are required' }, 400);
      // Basic email validation
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: 'Invalid recipient email address' }, 400);

      // Build a simple RFC 2822 MIME message
      // Hardening: strip CR/LF from header fields to prevent MIME header injection
      const subject = String(body?.subject || '').replace(/[\r\n]+/g, ' ').trim();
      if (!subject) return json({ error: 'to, subject, and body are required' }, 400);
      const from = String(body?.from || user.email || '').replace(/[\r\n]+/g, ' ').trim();
      const lines = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        '',
        messageBody,
      ].join('\r\n');
      const b64 = btoa(unescape(encodeURIComponent(lines)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: b64 }),
      });
      if (!res.ok) {
        const details = await res.text();
        return json({ error: 'Gmail API error', details: details.slice(0, 400) }, res.status);
      }
      const result = await res.json() as any;
      return json({ success: true, messageId: result?.id || null, threadId: result?.threadId || null });
    }

    if (path === '/gmail/inbox' && request.method === 'GET') {
      if (!driveToken) return json({ error: 'Google connection required. Connect your Google account in Settings.' }, 400);
      const max = Math.min(Math.max(parseInt(url.searchParams.get('max') || '20'), 1), 50);
      const q = (url.searchParams.get('q') || '').slice(0, 200);
      const params = new URLSearchParams({ maxResults: String(max), labelIds: 'INBOX' });
      if (q) params.set('q', q);
      const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
        headers: { 'Authorization': `Bearer ${driveToken}` },
      });
      if (!listRes.ok) return json({ error: 'Gmail API error', details: (await listRes.text()).slice(0, 400) }, listRes.status);
      const list = await listRes.json() as any;
      const messages: any[] = [];
      const ids: string[] = (list.messages || []).map((m: any) => m.id).slice(0, max);
      const BATCH = 8;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (id) => {
          const mRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { 'Authorization': `Bearer ${driveToken}` } }
          );
          if (!mRes.ok) return null;
          const m = await mRes.json() as any;
          const headers = (m.payload?.headers || []);
          const get = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name)?.value || '';
          const fromRaw = get('from');
          const match = fromRaw.match(/<([^>]+)>/);
          return {
            id,
            from: fromRaw,
            fromEmail: match ? match[1] : fromRaw,
            subject: get('subject') || '(no subject)',
            date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : get('date'),
            snippet: m.snippet || '',
            unread: (m.labelIds || []).includes('UNREAD'),
          };
        }));
        for (const r of results) if (r) messages.push(r);
      }
      return json({ messages, total: (list.resultSizeEstimate || messages.length) });
    }

    if (path.match(/^\/gmail\/message\/[^/]+$/) && request.method === 'GET') {
      if (!driveToken) return json({ error: 'Google connection required. Connect your Google account in Settings.' }, 400);
      const messageId = path.split('/')[3];
      const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
        headers: { 'Authorization': `Bearer ${driveToken}` },
      });
      if (!mRes.ok) return json({ error: 'Gmail API error', details: (await mRes.text()).slice(0, 400) }, mRes.status);
      const m = await mRes.json() as any;
      const headers = (m.payload?.headers || []);
      const get = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name)?.value || '';
      // Extract body text (traverse parts for text/plain)
      let body = '';
      const extractText = (part: any): void => {
        if (!part) return;
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (Array.isArray(part.parts)) part.parts.forEach(extractText);
      };
      extractText(m.payload);
      if (!body && m.payload?.body?.data) body = atob(m.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      const fromRaw = get('from');
      const match = fromRaw.match(/<([^>]+)>/);
      return json({
        id: messageId,
        from: fromRaw,
        fromEmail: match ? match[1] : fromRaw,
        subject: get('subject') || '(no subject)',
        date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : get('date'),
        body: body.slice(0, 20000),
      });
    }

    if (path === '/drive/files' && request.method === 'POST') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);
      const body = await request.json() as any;

      const escapeDriveQuery = (str: string) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      let q = "trashed=false";
      if (body.folderId) q += ` and '${escapeDriveQuery(body.folderId)}' in parents`;
      if (body.query) {
        const safeQuery = escapeDriveQuery(body.query);
        q += ` and (name contains '${safeQuery}' or fullText contains '${safeQuery}')`;
      }
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

    if (path === '/drive/folders' && request.method === 'GET') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);

      const params = new URLSearchParams({
        q: "trashed=false and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id,name)',
        pageSize: '50',
      });

      const res = await driveRequest(`/files?${params}`, { method: 'GET' }, driveToken);
      if (!res.ok) return json({ error: 'Drive API error', details: await res.text() }, res.status);
      const data = await res.json() as any;
      return json({ folders: data.files || [] });
    }

    if (path === '/drive/export' && request.method === 'POST') {
      if (!driveToken) return json({ error: 'Drive token required' }, 400);
      const body = await request.json() as any;

      const createRes = await driveRequest(`/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: body.title,
          mimeType: 'application/vnd.google-apps.document',
          ...(body.folderId ? { parents: [body.folderId] } : {}),
        }),
      }, driveToken);

      if (!createRes.ok) return json({ error: 'Failed to create document', details: await createRes.text() }, createRes.status);
      const created = await createRes.json() as any;

      let docContent = '';
      if (body.sections) {
        for (const section of body.sections) {
          docContent += `${section.title}\n\n${section.content}\n\n`;
          if (section.budget) {
            docContent += `Budget:\n${JSON.stringify(section.budget, null, 2)}\n\n`;
          }
        }
      }

      const docsRes = await fetch(`https://docs.googleapis.com/v1/documents/${created.id}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${driveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: docContent,
              },
            },
          ],
        }),
      });

      if (!docsRes.ok) return json({ error: 'Failed to write document content', details: await docsRes.text() }, docsRes.status);

      return json({ fileId: created.id, webViewLink: `https://docs.google.com/document/d/${created.id}/edit` });
    }

    } catch (err: any) {
      console.error('Unhandled top-level error:', err?.stack || err);
      return json({ error: 'An internal server error occurred. Please try again later.' }, 500);
    }

    return json({ error: 'Not found' }, 404);
  }
};
