import re

def parse_inner_text(element_content, start_idx, full_content):
    # This function extracts text from a JSX element's children.
    # But since it's a bit complex, let's just grab a quick snippet of the text inside the element if it's a button/link.
    # Let's find the closing tag for this element.
    pass

def analyze_more():
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

    # Regex to find opening tags
    pattern = re.compile(r'<((?:button|input|select|a))\b', re.IGNORECASE)
    
    findings = []
    for match in pattern.finditer(content):
        start_pos = match.start()
        tag_name = match.group(1)
        
        # Parse opening tag up to closing '>'
        curr = start_pos
        in_double_quote = False
        in_single_quote = False
        in_template_literal = False
        in_curly = 0
        tag_content = []
        found_end = False
        length = len(content)
        
        while curr < length:
            char = content[curr]
            tag_content.append(char)
            if char == '"' and not in_single_quote and not in_template_literal:
                in_double_quote = not in_double_quote
            elif char == "'" and not in_double_quote and not in_template_literal:
                in_single_quote = not in_single_quote
            elif char == '`' and not in_double_quote and not in_single_quote:
                in_template_literal = not in_template_literal
            elif char == '{' and not in_double_quote and not in_single_quote and not in_template_literal:
                in_curly += 1
            elif char == '}' and not in_double_quote and not in_single_quote and not in_template_literal:
                in_curly -= 1
            elif char == '>' and not in_double_quote and not in_single_quote and not in_template_literal and in_curly == 0:
                found_end = True
                break
            curr += 1
            
        if found_end:
            tag_str = "".join(tag_content)
            
            # Filter out non-JSX links/tags
            if tag_name == 'a' and ('href' not in tag_str and 'onClick' not in tag_str and 'className' not in tag_str):
                continue
                
            line_num = get_line_num(start_pos)
            # Check comment
            line_start_offset = line_offsets[line_num - 1]
            prefix = content[line_start_offset:start_pos]
            if '//' in prefix:
                continue
                
            has_aria_label = 'aria-label' in tag_str
            has_aria_desc = 'aria-description' in tag_str
            
            # Let's get the inner text or a snippet of what follows
            # Let's read 150 chars after the tag end
            post_content = content[curr+1:curr+150]
            # Try to see if there's a simple text before closing tag
            # e.g., <button>Login</button>
            # Let's find </button> or </input> etc.
            close_tag = f"</{tag_name}>"
            close_idx = content.find(close_tag, curr)
            inner_text = ""
            if close_idx != -1 and (close_idx - curr) < 300:
                inner_raw = content[curr+1:close_idx]
                # strip html tags and whitespace
                inner_text = re.sub(r'<[^>]+>', '', inner_raw).strip()
                # remove curly braces etc.
                inner_text = re.sub(r'\{[^}]+\}', '', inner_text).strip()
            
            findings.append({
                'line': line_num,
                'tag': tag_name,
                'tag_str': tag_str,
                'inner_text': inner_text,
                'has_aria': has_aria_label or has_aria_desc
            })
            
    missing_aria = [f for f in findings if not f['has_aria']]
    print(f"Total missing aria: {len(missing_aria)}")
    for m in missing_aria:
        # Format the description
        desc = m['inner_text'] if m['inner_text'] else "Icon/Nested element"
        # truncate details
        tag_snippet = m['tag_str'].replace('\n', ' ').strip()
        if len(tag_snippet) > 80:
            tag_snippet = tag_snippet[:77] + "..."
        print(f"{m['line']}|{m['tag']}|{desc}|{tag_snippet}")

analyze_more()
