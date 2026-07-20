import re

with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

print("=== CHECKING FOR MAP/FILTER WITHOUT GUARDS ===")
# Pattern: something like variable.map( or variable.filter(
# We want to identify the variable name and see if there is no ? before .map/filter, and no || [] / guards.
# E.g., not matching '?.' and not matching '|| []'
# Let's write a regex that matches \b\w+\.(map|filter)\( and see what we get.
for idx, line in enumerate(lines):
    match = re.search(r'\b([a-zA-Z_]\w*)\.(map|filter)\(', line)
    if match:
        var_name = match.group(1)
        op = match.group(2)
        # Check if line contains "?." or if there is a preceding check
        has_optional_chaining = "?." + op in line
        # Let's inspect the surrounding code/line
        print(f"Line {idx+1}: {line.strip()} (Var: {var_name}, Op: {op}, OptionalChaining: {has_optional_chaining})")
