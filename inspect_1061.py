with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== INSPECTING LINE 1061 CONTEXT ===")
for i in range(1050, 1075):
    print(f"{i+1}: {lines[i]}")
