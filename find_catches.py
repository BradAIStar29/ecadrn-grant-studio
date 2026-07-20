import re

def find_catch_blocks():
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

    # We want to find catch (error) or catch (err) or catch { ... }
    # Let's find all occurrences of catch and get the block.
    pattern = re.compile(r'\bcatch\b\s*(\([^)]*\))?\s*\{', re.IGNORECASE)
    
    findings = []
    for match in pattern.finditer(content):
        start_pos = match.start()
        line_num = get_line_num(start_pos)
        
        # Now find the matching closing curly brace
        # We need to trace braces
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
        
        findings.append({
            'line': line_num,
            'block': block_str,
            'match_str': match.group(0)
        })
        
    print(f"Total catch blocks: {len(findings)}")
    for f in findings:
        print(f"--- Line {f['line']} ---")
        lines_block = f['block'].split('\n')
        for l in lines_block[:5]:
            print("  " + l)
        if len(lines_block) > 5:
            print("  ...")

find_catch_blocks()
