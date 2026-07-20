import re

def analyze_inputs_and_labels():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        content = f.read()

    # Let's find all label tags and check their htmlFor attributes or if they enclose inputs
    # Let's find all labels
    label_pattern = re.compile(r'<label\b', re.IGNORECASE)
    labels = []
    
    # We will need to map characters to line numbers
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

    for match in label_pattern.finditer(content):
        start_pos = match.start()
        line_num = get_line_num(start_pos)
        
        # Parse tag
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
        # Extract htmlFor if any
        html_for_match = re.search(r'htmlFor\s*=\s*(?:["\']([^"\']+)["\']|\{([^}]+)\})', tag_str)
        html_for = None
        if html_for_match:
            html_for = html_for_match.group(1) or html_for_match.group(2)
            
        labels.append({
            'line': line_num,
            'htmlFor': html_for,
            'start_pos': start_pos,
            'end_pos': curr
        })

    # Now let's find all inputs, selects, and textareas
    input_pattern = re.compile(r'<((?:input|select|textarea))\b', re.IGNORECASE)
    inputs = []
    
    for match in input_pattern.finditer(content):
        start_pos = match.start()
        tag_name = match.group(1)
        line_num = get_line_num(start_pos)
        
        # Parse opening tag
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
        
        # Extract id, aria-label, aria-labelledby, placeholder, type
        id_match = re.search(r'\bid\s*=\s*(?:["\']([^"\']+)["\']|\{([^}]+)\})', tag_str)
        tag_id = None
        if id_match:
            tag_id = id_match.group(1) or id_match.group(2)
            
        aria_label = 'aria-label' in tag_str
        aria_labelledby = 'aria-labelledby' in tag_str
        placeholder_match = re.search(r'\bplaceholder\s*=\s*["\']([^"\']+)["\']', tag_str)
        placeholder = placeholder_match.group(1) if placeholder_match else None
        
        type_match = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', tag_str)
        tag_type = type_match.group(1) if type_match else 'text'
        
        # Let's filter out type="hidden", "submit", "button"
        if tag_type in ['hidden', 'submit', 'button']:
            continue
            
        inputs.append({
            'line': line_num,
            'tag': tag_name,
            'id': tag_id,
            'aria_label': aria_label,
            'aria_labelledby': aria_labelledby,
            'placeholder': placeholder,
            'tag_str': tag_str.replace('\n', ' ').strip(),
            'start_pos': start_pos,
            'end_pos': curr
        })

    # Now let's check for each input if it has a label
    print(f"Total Labels: {len(labels)}")
    print(f"Total Inputs/Selects/Textareas: {len(inputs)}")
    
    missing_labels = []
    
    for inp in inputs:
        has_label = False
        
        # 1. Check if there's a label with htmlFor matching the input's id
        if inp['id']:
            for l in labels:
                if l['htmlFor'] == inp['id']:
                    has_label = True
                    break
                    
        # 2. Check if the input is nested inside a label
        # To do this, we can check if there is a label tag starting before the input and ending after it.
        # But wait, JSX nested tags can be a bit more complex. Let's do a simple range check.
        # A label starts before the input, and its closing tag is after the input.
        # Let's see if we can find a label tag that wraps the input.
        if not has_label:
            for l in labels:
                # Find closing label tag </label> after l['end_pos']
                close_label_idx = content.find('</label>', l['end_pos'])
                if close_label_idx != -1:
                    if l['start_pos'] < inp['start_pos'] and inp['end_pos'] < close_label_idx:
                        has_label = True
                        break
                        
        # 3. Check if it has aria-label or aria-labelledby
        if not has_label:
            if inp['aria_label'] or inp['aria_labelledby']:
                has_label = True
                
        if not has_label:
            missing_labels.append(inp)
            
    print(f"Inputs missing labels: {len(missing_labels)}")
    for m in missing_labels:
        print(f"Line {m['line']}: <{m['tag']}> id={m['id']} placeholder={m['placeholder']} tag={m['tag_str'][:80]}")

analyze_inputs_and_labels()
