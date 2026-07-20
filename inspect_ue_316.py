with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

# Let's inspect the useEffect on line 316-434
print("=== INSPECTING useEffect 316-434 ===")
for i in range(315, 435):
    print(f"{i+1}: {lines[i]}")
