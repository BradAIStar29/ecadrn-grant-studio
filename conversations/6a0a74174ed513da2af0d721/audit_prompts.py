import re

with open('/app/ecadrn-grant-studio/worker/src/index.ts') as f:
    lines = f.readlines()

cases = []
current_action = None
start_line = 0

for i, line in enumerate(lines, 1):
    m = re.search(r"case\s+'([a-zA-Z0-9_-]+)':", line)
    if m:
        if current_action:
            cases.append((current_action, start_line, i-1))
        current_action = m.group(1)
        start_line = i

if current_action:
    cases.append((current_action, start_line, 1165))

array_actions = ['discover-grants', 'autopilot-search', 'find-adr-partners', 'generate-budget', 'generate-timeline']

required_keys = {
    'generate-draft': ['executiveSummary', 'needStatement', 'projectDescription', 'methodology'],
    'agent-write-proposal': ['executiveSummary', 'needStatement', 'projectDescription', 'methodology'],
    'research-funder': ['funderOverview', 'missionAlignmentScore'],
    'research-grant-url': ['grantTitle', 'funderName'],
    'score-alignment': ['overallScore', 'dimensionScores'],
    'review-proposal': ['overallScore', 'sectionScores'],
    'humanize-proposal': ['score', 'suggestions'],
    'generate-outreach-email': ['subject', 'body'],
    'chat': ['reply'],
    'refine-section': ['content'],
    'pre-submit-check': ['recommendation', 'overallScore'],
    'analyze-competitors': ['competitors'],
    'prioritize-grants': ['rankings'],
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
}

print("=== CHECK 1 & 5: PROMPT VS VALIDATERESPONSE ===")
for act, start, end in cases:
    case_text = "".join(lines[start-1:end])
    
    # Check if in arrayActions or requiredKeys
    in_array = act in array_actions
    in_req = act in required_keys
    
    print(f"\n--- {act} (lines {start}-{end}) ---")
    if not in_array and not in_req:
        print(f"  [CRITICAL MISSING VALIDATION]: Action '{act}' is missing from BOTH arrayActions and requiredKeys!")
    elif in_array:
        print(f"  Returns Array (in arrayActions)")
    else:
        req = required_keys[act]
        print(f"  Returns Object, requiredKeys: {req}")
        for rk in req:
            if rk not in case_text:
                print(f"    [MISMATCH]: Required key '{rk}' NOT FOUND in prompt text!")

