with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== INSPECTING useEffect 2079-2123 ===")
for i in range(2078, 2124):
    print(f"{i+1}: {lines[i]}")
