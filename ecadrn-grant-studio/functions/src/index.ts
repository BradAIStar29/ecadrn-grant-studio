import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';

admin.initializeApp();
setGlobalOptions({ region: 'us-east1' });

const ALLOWED_ORIGIN = 'https://bradaistar29.github.io';

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

VOICE PROFILE (apply consistently across all 9 sections):
Tone descriptors: ${data.toneDescriptors}
Characteristic phrases: ${data.keyPhrases}
Writing style rules: ${data.voiceRules}
Sample sentences for style reference: ${data.writingSamples}

REQUIREMENTS:
- Each section MUST be substantive, specific, and directly address the funder's stated priorities
- Ground every claim in the org's actual programs, populations, and work
- Apply the voice profile throughout
- NEVER use vague filler
- Goals must be SMART; Evaluation plan must reference concrete metrics
- Budget narrative must align with project description activities

OUTPUT FORMAT — Respond ONLY with this exact JSON structure. No preamble. No markdown fences.

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

OUTPUT FORMAT — Respond ONLY with this exact JSON structure. No preamble. No markdown fences.

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
      return `You are a nonprofit grants researcher specializing in Alternative Dispute Resolution, conflict resolution, access to justice, restorative justice, and civic equity funding.

TASK: Identify ${data.count || 5} active grant opportunities that are a strong mission fit for the organization below.

ORGANIZATION PROFILE:
${JSON.stringify(data.orgProfile)}

SEARCH PARAMETERS:
Focus areas to prioritize: ${data.focusAreas}
Geographic scope: ${data.geographicFocus}
Preferred award range: $${data.amountMin}–$${data.amountMax}
Additional guidance: ${data.searchQuery}

OUTPUT FORMAT — Respond ONLY with a valid JSON array. No preamble. No markdown fences.

[
  {
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
  }
]`;

    case 'review-proposal':
      return `You are a senior grants review officer with expertise evaluating nonprofit proposals.

TASK: Conduct a comprehensive fundability audit of the grant proposal below.

GRANT OPPORTUNITY:
Title: ${data.grantTitle}
Funder: ${data.funderName}
Funder priorities: ${data.grantDescription}

PROPOSAL:
${JSON.stringify(data.proposal)}

OUTPUT FORMAT — Respond ONLY with this exact JSON structure. No preamble. No markdown fences.

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

OUTPUT FORMAT — Respond ONLY with this exact JSON structure. No preamble. No markdown fences.

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

[
  {
    "category": "string",
    "description": "string",
    "amount": number,
    "justification": "string"
  }
]`;

    default:
      return 'INVALID';
  }
}

export const ai = onRequest(
  {
    cors: [ALLOWED_ORIGIN],
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Verify Firebase Auth token — @ecadrn.org only
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const email = decoded.email || '';
      if (!email.endsWith('@ecadrn.org')) {
        res.status(403).json({ error: 'Access restricted to @ecadrn.org accounts' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Invalid auth token' });
      return;
    }

    const action = req.path.split('/').filter(Boolean).pop() || '';
    const data = req.body;

    const promptText = getPrompt(action, data);
    if (promptText === 'INVALID') {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const isJson = action !== 'chat';

    try {
      const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
          res.json(JSON.parse(text));
        } catch {
          res.status(500).json({ error: 'Invalid JSON from AI', raw: text });
        }
      } else {
        res.send(text);
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);
