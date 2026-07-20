import re

def build_markdown_table():
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

    pattern = re.compile(r'<((?:button|input|select|a))\b', re.IGNORECASE)
    
    findings = []
    for match in pattern.finditer(content):
        start_pos = match.start()
        tag_name = match.group(1)
        
        curr = start_pos
        in_double_quote = False
        in_single_quote = False
        in_curly = 0
        tag_content = []
        while curr < len(content):
            char = content[curr]
            tag_content.append(char)
            if char == '"' and not in_single_quote:
                in_double_quote = not in_double_quote
            elif char == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
            elif char == '{':
                in_curly += 1
            elif char == '}':
                in_curly -= 1
            elif char == '>' and not in_double_quote and not in_single_quote and in_curly == 0:
                break
            curr += 1
            
        tag_str = "".join(tag_content)
        
        if tag_name == 'a' and ('href' not in tag_str and 'onClick' not in tag_str and 'className' not in tag_str):
            continue
            
        line_num = get_line_num(start_pos)
        
        # skip comment lines
        line_start_offset = line_offsets[line_num - 1]
        prefix = content[line_start_offset:start_pos]
        if '//' in prefix:
            continue
            
        has_aria = 'aria-label' in tag_str or 'aria-description' in tag_str
        
        if not has_aria:
            # get inner text
            close_tag = f"</{tag_name}>"
            close_idx = content.find(close_tag, curr)
            inner_text = ""
            if close_idx != -1 and (close_idx - curr) < 300:
                inner_raw = content[curr+1:close_idx]
                inner_text = re.sub(r'<[^>]+>', '', inner_raw).strip()
                inner_text = re.sub(r'\{[^}]+\}', '', inner_text).strip()
                inner_text = " ".join(inner_text.split())
            
            tag_snippet = tag_str.replace('\n', ' ').strip()
            if len(tag_snippet) > 60:
                tag_snippet = tag_snippet[:57] + "..."
                
            findings.append({
                'line': line_num,
                'tag': tag_name,
                'inner_text': inner_text if inner_text else "Icon / Nested content",
                'snippet': tag_snippet
            })
            
    print(f"Total elements: {len(findings)}")
    # Output markdown format
    for f in findings:
        print(f"| {f['line']} | `{f['tag']}` | {f['inner_text']} | `{f['snippet']}` |")

build_markdown_table()
