import re

with open('/app/ecadrn-grant-studio/worker/src/index.ts') as f:
    lines = f.readlines()

print("=== CHECK 1b: .slice() ON JSON.stringify IN PROMPTS ===")
for i, line in enumerate(lines, 1):
    if i >= 70 and i <= 1165:
        if '.slice(' in line:
            print(f"Line {i}: {line.strip()}")
