import re

with open('/app/ecadrn-grant-studio/src/App.tsx', 'r') as f:
    text = f.read()

# Let's find all occurrences of callAI('action', ...)
# Matches like callAI('generate-draft', ...), callAI( 'generate-draft' , ...), etc.
matches = re.finditer(r'callAI\s*\(\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]', text)

print("All callAI calls in App.tsx:")
for m in matches:
    action = m.group(1)
    start_pos = m.start()
    line_no = text[:start_pos].count('\n') + 1
    # Extract line
    line_start = text.rfind('\n', 0, start_pos) + 1
    line_end = text.find('\n', start_pos)
    line = text[line_start:line_end].strip()
    print(f"Line {line_no:04d}: action='{action}' | Code: {line}")
