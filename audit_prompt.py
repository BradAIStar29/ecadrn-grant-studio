# Let's inspect getPrompt switch-case more deeply for backticks
with open('/app/ecadrn-grant-studio/worker/src/index.ts', 'r') as f:
    text = f.read()

import re

# Find getPrompt
start = text.find('function getPrompt')
end = text.find('function cleanJsonResponse')
get_prompt_body = text[start:end]

# Let's count backticks in getPrompt
print("getPrompt backticks:", get_prompt_body.count('`'))

# Let's find any backtick in get_prompt_body
indices = [m.start() for m in re.finditer(r'`', get_prompt_body)]
print("Positions of backticks in getPrompt:", indices)

# Print lines around each backtick to check if they are closed properly
lines = get_prompt_body.split('\n')
for i, line in enumerate(lines):
    if '`' in line:
        print(f"Line {i+13}: {line}")
