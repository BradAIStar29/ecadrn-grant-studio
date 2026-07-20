with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== INSPECTING LINE 2191 CONTEXT ===")
for i in range(2180, 2205):
    print(f"{i+1}: {lines[i]}")
