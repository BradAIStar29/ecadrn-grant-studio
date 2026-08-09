import re

with open('/app/ecadrn-grant-studio/worker/src/index.ts') as f:
    lines = f.readlines()

print("=== CHECK 3: RETRY LOGIC ===")
for i, line in enumerate(lines[1380:1450], 1381):
    print(f"Line {i}: {line.rstrip()}")
