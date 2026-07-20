with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== CHECKING ALL INSTANCES OF templates IN FIRESTORE OR WRITES ===")
for idx, line in enumerate(lines):
    if "templates" in line and ("doc(" in line or "collection(" in line or "addDoc(" in line or "setDoc(" in line or "db" in line):
        print(f"Line {idx+1}: {line.strip()}")
