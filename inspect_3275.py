with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== INSPECTING LINE 3275 CONTEXT ===")
for i in range(3265, 3290):
    print(f"{i+1}: {lines[i]}")
