# Search for callAI in App.tsx generally
with open('/app/ecadrn-grant-studio/src/App.tsx', 'r') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'callAI', text)]
print(f"Total callAI occurrences in App.tsx: {len(matches)}")

# Let's print around the first occurrence of callAI to see how it's defined or imported
if matches:
    first = matches[0]
    print("=== FIRST OCCURRENCE ===")
    print(text[max(0, first-200):first+500])
