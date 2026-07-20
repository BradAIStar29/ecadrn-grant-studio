# Let's inspect App.tsx for how it defines/uses callAI
with open('/app/ecadrn-grant-studio/src/App.tsx', 'r') as f:
    text = f.read()

import re
matches = re.finditer(r'function callAI|const callAI\b', text)
for m in matches:
    start_pos = m.start()
    print("Found callAI definition at pos:", start_pos)
    print(text[start_pos:start_pos+800])
