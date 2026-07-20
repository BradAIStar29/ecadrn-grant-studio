# Check index.ts for how JSON parsing is handled and for potential crashes
with open('/app/ecadrn-grant-studio/worker/src/index.ts', 'r') as f:
    text = f.read()

import re
matches = re.finditer(r'JSON\.parse', text)
print("JSON.parse occurrences in worker index.ts:")
for m in matches:
    pos = m.start()
    line_no = text[:pos].count('\n') + 1
    # Print 5 lines around it
    line_start = text.rfind('\n', 0, pos) + 1
    line_end = text.find('\n', pos)
    print(f"Line {line_no:04d}: {text[line_start:line_end].strip()}")
