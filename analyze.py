import re

def analyze_file():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        content = f.read()

    lines = content.split('\n')
    
    # Let's find opening tags for button, input, select, a.
    # A JSX tag can span multiple lines.
    # Let's walk the file char by char to find the opening tags correctly.
    # We need to handle strings, comments, etc., but a simple parser is usually enough if we are careful.
    
    idx = 0
    length = len(content)
    
    findings = []
    
    # We will find positions of characters and map them to line numbers.
    line_offsets = []
    offset = 0
    for line in lines:
        line_offsets.append(offset)
        offset += len(line) + 1 # +1 for newline
        
    def get_line_num(char_idx):
        # binary search or simple search
        for i, o in enumerate(line_offsets):
            if char_idx < o:
                return i # line index starts at 0, so line number is i
        return len(lines)
        
    # We want to find: <button, <input, <select, <a
    # followed by space, newline, or >
    # Let's use regex to find all opening tags.
    # Pattern to find: <(button|input|select|a)(?:\s|/|>|$)
    # We must make sure it's not part of another word (like <area or <address or <button-group).
    # Since we are inside TSX, <a can be part of generics like <any> but inside JSX it is used as a tag.
    # Let's find all matches of the opening tag.
    
    pattern = re.compile(r'<((?:button|input|select|a))\b', re.IGNORECASE)
    
    for match in pattern.finditer(content):
        start_pos = match.start()
        tag_name = match.group(1)
        
        # Now find the end of this opening tag (the closing '>')
        # We need to be careful with strings inside the tag (e.g. attr=">") and curly braces
        # Let's walk from start_pos
        curr = start_pos
        in_double_quote = False
        in_single_quote = False
        in_template_literal = False
        in_curly = 0
        tag_content = []
        found_end = False
        
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
            # Check if this tag has aria-label or aria-description
            has_aria_label = 'aria-label' in tag_str
            has_aria_desc = 'aria-description' in tag_str
            
            line_num = get_line_num(start_pos)
            
            # Let's filter out false positives:
            # - <a that is not a JSX tag (e.g. generic type in typescript)
            # - tag inside comments
            # Let's check if the tag_str looks like a valid JSX tag
            # If it is a generic type like <any>, it won't have attributes or it might be followed by a closing tag or we can see from context
            if tag_name == 'a' and ('href' not in tag_str and 'onClick' not in tag_str and 'className' not in tag_str):
                # Probably not a link tag, could be a TS generic or comparison
                continue
                
            # Check if it is inside a multiline comment /* ... */ or single line comment //
            # Let's look at the line text before start_pos
            line_start_offset = line_offsets[line_num - 1]
            prefix = content[line_start_offset:start_pos]
            if '//' in prefix:
                continue
                
            findings.append({
                'line': line_num,
                'tag': tag_name,
                'content': tag_str.replace('\n', ' '),
                'has_aria_label': has_aria_label,
                'has_aria_desc': has_aria_desc
            })
            
    print(f"Total found: {len(findings)}")
    missing = [f for f in findings if not f['has_aria_label'] and not f['has_aria_desc']]
    print(f"Missing aria: {len(missing)}")
    for m in missing[:50]:
        print(f"Line {m['line']}: <{m['tag']}> -> {m['content'][:100]}")

analyze_file()
