/**
 * E2E draft-creation regression test — replays the deployed worker's exact
 * pipeline outside the browser:
 *   getPrompt() (same source the worker uses) → Gemini (same 6-tier model
 *   chain, temp, token limits, JSON mode) → the same JSON-cleaning → the
 *   same shape the frontend saves to Firestore.
 *
 * No secrets in this file — the API key comes from GEMINI_API_KEY env.
 * Run from the worker directory:  GEMINI_API_KEY=... npx tsx e2e/draft-e2e.ts
 */
import { GoogleGenAI } from '@google/genai';
import { getPrompt } from '../src/index';

// ── Same model chain as the worker ─────────────────────────────────────────
const MODEL_TIERS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY env missing'); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: KEY });

// ── Same JSON cleaning as the worker ────────────────────────────────────────
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
  let start = -1, end = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) { start = firstBrace; end = lastBrace; }
    else { start = firstBracket; end = lastBracket; }
  } else if (firstBrace !== -1) { start = firstBrace; end = lastBrace; }
  else if (firstBracket !== -1) { start = firstBracket; end = lastBracket; }
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.substring(start, end + 1).trim();
  return cleaned;
}

// ── Same generation call as runGeneration() (writing category defaults) ────
async function generate(prompt: string, opts: { temperature: number; maxTokens: number; jsonMode: boolean }): Promise<string> {
  let lastErr: any = null;
  for (const model of MODEL_TIERS) {
    const cfg: any = {
      model,
      contents: prompt,
      config: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
      },
    };
    if (opts.jsonMode) cfg.config.responseMimeType = 'application/json';
    try {
      const res = await ai.models.generateContent(cfg);
      const text = res.text?.trim() || '';
      if (text) return text;
      lastErr = new Error('empty response');
    } catch (e: any) {
      lastErr = e;
      console.log(`  ↳ ${model} failed: ${(e?.message || '').slice(0, 100)}`);
    }
  }
  throw lastErr || new Error('all models failed');
}

// ── Validation ──────────────────────────────────────────────────────────────
const SECTION_RANGES: Record<string, [number, number]> = {
  executiveSummary: [300, 400], needStatement: [300, 400], projectDescription: [400, 500],
  goalsObjectives: [300, 400], methodology: [400, 500], evaluationPlan: [300, 400],
  sustainability: [250, 350], organizationalCapacity: [300, 400], budgetNarrative: [300, 400],
};
const CLICHES = ['delve', 'tapestry', 'testament', 'leverage', 'robust', 'moreover',
  'it is important to note', "in today's world", 'at the heart of', 'navigating the landscape',
  'catalyst for change', 'bridging divides', 'fostering dialogue'];

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function run() {
  console.log('════ E2E DRAFT CREATION TEST ════');
  console.log(`Start: ${new Date().toISOString()}`);

  // Realistic ECADRN request — the same shape App.tsx sends to callAI
  const req = {
    orgProfile: {
      name: 'Early Career ADR Network (ECADRN)',
      mission: 'ECADRN empowers emerging ADR professionals from diverse racial, religious, economic, sexual orientation, and educational backgrounds through mentorship, training, and community-building. We are a connector and pipeline-builder — the on-ramp to the ADR highway.',
      profileText: 'National 501(c)(3) based in Torrance, CA. Programs: Intern Program (remote ~10-week cohorts, Spring/Fall high school students weekly, Summer undergrad/grad biweekly), Career Advising (1:1 pairing with seasoned ADR practitioners, launching soon), Resource Hub (education guides, national ADR Job Board, networking events, ADR Organization Directory), fundraising events. All-volunteer board. Donations cover registration, insurance, virtual tools, and program development.',
      website: 'ecadrn.org',
    },
    grantTitle: 'Access to Justice Mediation Program Grant',
    funderName: 'JAMS Foundation',
    funderType: 'Foundation',
    grantDescription: 'Funds programs that expand access to mediation and dispute resolution services for underserved communities, with emphasis on training new practitioners and building sustainable community capacity.',
    focusAreas: 'Access to justice, mediation training, underserved communities, conflict resolution education',
    amountMin: 25000,
    amountMax: 50000,
    eligibility: '501(c)(3) nonprofits',
    geographicFocus: 'National',
    toneDescriptors: 'confident, warm, grounded, community-first',
    keyPhrases: 'the on-ramp to the ADR highway, early-career is an experience not an age, connector and pipeline-builder',
    voiceRules: 'Use active voice; lead with community need; ground claims in actual programs; no corporate jargon',
    writingSamples: 'ECADRN opens doors for the next generation of peacemakers. Our fellows walk into their first mediation with real practice behind them.',
    winningExamples: null,
    lengthPreference: 'standard',
    funderIntelligence: {
      givingPriorities: ['Access to justice', 'ADR education and training', 'Innovation in dispute resolution'],
      whatTheyFund: ['Mediation programs for underserved populations', 'Practitioner training', 'Systemic change initiatives'],
      whatTheyDontFund: ['General operating support without a clear program', 'For-profit ventures'],
      applicationTips: ['Emphasize measurable community impact', 'Show partnerships with established ADR institutions'],
      recommendedApproach: 'Frame the project as building capacity in the ADR field while serving a specific underserved population.',
      missionAlignmentRationale: 'ECADRN develops the next generation of diverse ADR practitioners, directly expanding access to justice.',
      keySelectionCriteria: ['Community impact', 'Sustainability', 'Organizational capacity'],
      typicalGrantees: ['University dispute resolution centers', 'Community mediation nonprofits'],
      recentGrants: ['University law school dispute resolution program ($45K)', 'Community mediation center expansion ($38K)'],
      deadlineInfo: 'Letter of inquiry due quarterly; full proposal by invitation.',
      researchConfidence: 'medium',
    },
  };

  // ── Leg 1: generate-draft ──────────────────────────────────────────────────
  console.log('\n── Leg 1: generate-draft (9-section proposal) ──');
  const prompt = getPrompt('generate-draft', req);
  check(prompt.includes('JAMS Foundation'), 'prompt contains funder name');
  check(prompt.includes('WORD COUNT GUIDANCE (STANDARD LENGTH'), 'prompt includes word-count guide');
  check(prompt.length > 3000, 'prompt is substantive', `${prompt.length} chars`);

  const raw = await generate(prompt, { temperature: 0.75, maxTokens: 16384, jsonMode: true });
  console.log(`  ↳ model output: ${raw.length} chars`);
  check(!/^```/.test(raw.trim()), 'no markdown fences in raw output');

  let draft: any = null;
  try { draft = JSON.parse(cleanJsonResponse(raw)); } catch { /* retry once, as the worker does */ }
  if (!draft) {
    console.log('  ↳ JSON parse failed, retrying once (worker behavior)');
    const retry = await generate(prompt, { temperature: 0.75, maxTokens: 16384, jsonMode: true });
    draft = JSON.parse(cleanJsonResponse(retry));
  }

  console.log('\n  Section validation:');
  let totalWords = 0;
  for (const [key, [lo, hi]] of Object.entries(SECTION_RANGES)) {
    const val = typeof draft[key] === 'string' ? draft[key] : '';
    const words = val ? val.trim().split(/\s+/).length : 0;
    totalWords += words;
    check(val.length > 0, `${key} present`, `${words} words (target ${lo}-${hi})`);
    check(words >= Math.round(lo * 0.5) && words <= Math.round(hi * 1.6), `${key} word count in range`, `${words} vs ${lo}-${hi}`);
  }
  console.log(`  ↳ total: ${totalWords} words`);

  const allText = Object.values(draft).join(' ').toLowerCase();
  const found = CLICHES.filter(c => allText.includes(c.toLowerCase()));
  check(found.length === 0, 'no banned AI clichés', found.length ? `found: ${found.join(', ')}` : '');

  const extraKeys = Object.keys(draft).filter(k => !(k in SECTION_RANGES));
  check(extraKeys.length === 0, 'no unexpected extra keys', extraKeys.join(', ') || 'none');

  // ── Leg 2: generate-budget ─────────────────────────────────────────────────
  console.log('\n── Leg 2: generate-budget ──');
  const budgetPrompt = getPrompt('generate-budget', { description: req.grantDescription });
  const rawBudget = await generate(budgetPrompt, { temperature: 0.4, maxTokens: 8192, jsonMode: true });
  const budget = JSON.parse(cleanJsonResponse(rawBudget));
  check(Array.isArray(budget), 'budget is an array', `${Array.isArray(budget) ? budget.length : 0} line items`);
  const validCats = ['Personnel', 'Fringe Benefits', 'Travel', 'Equipment', 'Supplies', 'Contractual', 'Other', 'Indirect'];
  const badItems = (Array.isArray(budget) ? budget : []).filter(it =>
    !it || typeof it.description !== 'string' || typeof it.amount !== 'number' ||
    !validCats.includes(it.category) || typeof it.justification !== 'string' || !it.id);
  check(badItems.length === 0, 'all line items valid (id/category/description/amount/justification)',
    badItems.length ? `${badItems.length} malformed` : '');
  const total = (Array.isArray(budget) ? budget : []).reduce((s: number, it: any) => s + (it.amount || 0), 0);
  check(total >= 25000 && total <= 150000, 'budget total in plausible range', `$${total.toLocaleString()}`);

  // ── Result ────────────────────────────────────────────────────────────────
  console.log(`\n════ ${failures === 0 ? 'ALL CHECKS PASSED ✓' : `${failures} CHECK(S) FAILED ✗`} ════`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(e => { console.error('E2E test crashed:', e); process.exit(1); });
