import re

with open('/app/ecadrn-grant-studio/worker/src/index.ts', 'r') as f:
    text = f.read()

# Let's count backticks in index.ts
backticks = [m.start() for m in re.finditer(r'`', text)]
print(f"Total backticks in file: {len(backticks)}")

# Let's write a check for each case to see if there is any unclosed backtick within its scope.
# The structure is:
# case 'action':
#   return `...`;
#
# Let's find cases and extract their return statements or contents.
cases = re.findall(r"case\s+'([^']+)'\s*:", text)
print("Found cases:", cases)

# Let's verify each case returns a validly quoted template literal or string
for c in cases:
    # Find case position
    pos = text.find(f"case '{c}':")
    # Let's find the next case or switch end
    next_case_pos = len(text)
    for oc in cases:
        if oc != c:
            opos = text.find(f"case '{oc}':")
            if opos > pos and opos < next_case_pos:
                next_case_pos = opos
    opos_default = text.find("default:")
    if opos_default > pos and opos_default < next_case_pos:
        next_case_pos = opos_default
        
    case_body = text[pos:next_case_pos]
    
    # Check if this case body has matching backticks
    cb_backticks = case_body.count('`')
    print(f"Case '{c}': backtick count = {cb_backticks}")
    if cb_backticks % 2 != 0:
        print(f"  --> ALERT: Odd backtick count in case '{c}'!")
