with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== CHECKING FOR non-null assertions on auth.currentUser ===")
for idx, line in enumerate(lines):
    if "auth.currentUser!" in line:
        print(f"Line {idx+1}: {line.strip()}")
