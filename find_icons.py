import re

def find_icons():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        content = f.read()

    # Let's extract all imports from 'lucide-react'
    # From lines 7-65
    # Let's find the import block from 'lucide-react'
    import_match = re.search(r'import\s*\{\s*([^}]+)\s*\}\s*from\s*[\'"]lucide-react[\'"]', content, re.DOTALL)
    if not import_match:
        print("No lucide-react imports found")
        return
        
    icons = [icon.strip() for icon in import_match.group(1).split(',') if icon.strip()]
    print(f"Imported icons: {len(icons)}")
    print(icons)
    
    # Let's build a map of lines for line numbers
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
        
    # Find all instances where these icons are used as JSX tags: e.g. <IconName
    # Let's search for matches of: <IconName\b
    findings = []
    for icon in icons:
        pattern = re.compile(rf'<{icon}\b')
        for match in pattern.finditer(content):
            start_pos = match.start()
            line_num = get_line_num(start_pos)
            
            # Find the closing bracket of the tag
            curr = start_pos
            in_double_quote = False
            in_single_quote = False
            in_curly = 0
            tag_content = []
            found_end = False
            
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
                    found_end = True
                    break
                curr += 1
                
            tag_str = "".join(tag_content)
            
            # Check if this icon tag has aria-hidden
            has_aria_hidden = 'aria-hidden' in tag_str
            has_alt = 'alt=' in tag_str or 'title=' in tag_str
            
            findings.append({
                'line': line_num,
                'icon': icon,
                'tag_str': tag_str.replace('\n', ' '),
                'has_aria_hidden': has_aria_hidden,
                'has_alt': has_alt
            })
            
    findings.sort(key=lambda x: x['line'])
    print(f"Total icon occurrences: {len(findings)}")
    without_aria_hidden = [f for f in findings if not f['has_aria_hidden']]
    print(f"Without aria-hidden: {len(without_aria_hidden)}")
    
    for f in without_aria_hidden[:30]:
        print(f"Line {f['line']}: <{f['icon']}> -> {f['tag_str']}")

find_icons()
