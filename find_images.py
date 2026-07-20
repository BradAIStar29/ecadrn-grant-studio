import re

def find_images():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        content = f.read()

    lines = content.split('\n')
    line_offsets = []
    offset = 0
    for line in lines:
        line_offsets.append(offset)
        offset += len(line) + 1
        
    def get_line_num(char_idx):
        for i, o in enumerate(line_offsets):
            if char_idx < o:
                return i
        return len(lines)

    # Let's search for <img
    pattern = re.compile(r'<img\b', re.IGNORECASE)
    findings = []
    for match in pattern.finditer(content):
        start_pos = match.start()
        line_num = get_line_num(start_pos)
        
        # Find closing tag '>'
        curr = start_pos
        while curr < len(content) and content[curr] != '>':
            curr += 1
        tag_str = content[start_pos:curr+1]
        
        findings.append({
            'line': line_num,
            'tag': tag_str
        })
        
    print(f"Total img tags: {len(findings)}")
    for f in findings:
        print(f"Line {f['line']}: {f['tag']}")

find_images()
