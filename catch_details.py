import re

def get_catch_details():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        content = f.read()

    lines = content.split('\n')
    line_offsets = []
    offset = 0
    for line in lines:
        line_offsets.append(offset)
        offset += len(line) + 1 # +1 for newline
        
    def get_line_num(char_idx):
        for i, o in enumerate(line_offsets):
            if char_idx < o:
                return i
        return len(lines)

    # Let's find catch blocks
    pattern = re.compile(r'\bcatch\b\s*(\([^)]*\))?\s*\{', re.IGNORECASE)
    
    findings = []
    for match in pattern.finditer(content):
        start_pos = match.start()
        line_num = get_line_num(start_pos)
        
        brace_count = 1
        curr = content.find('{', start_pos) + 1
        length = len(content)
        block_chars = []
        
        while curr < length and brace_count > 0:
            char = content[curr]
            block_chars.append(char)
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
            curr += 1
            
        block_str = "".join(block_chars)
        findings.append((line_num, match.group(0) + "{" + block_str))
        
    for line_num, code in findings:
        print(f"=== LINE {line_num} ===")
        print(code)
        print("======================\n")

get_catch_details()
