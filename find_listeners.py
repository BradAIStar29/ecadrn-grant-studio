with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== CHECKING ALL INSTANCES OF addEventListener ===")
for idx, line in enumerate(lines):
    if "addEventListener" in line:
        print(f"Line {idx+1}: {line.strip()}")
