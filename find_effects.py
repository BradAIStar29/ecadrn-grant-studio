import re

def parse_app():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        content = f.read()
    lines = content.split('\n')
    
    # Let's search for useEffect blocks
    # We want to map each useEffect block. We can do this by scanning for "useEffect("
    # and tracking curly braces/parentheses.
    use_effect_blocks = []
    use_effect_pattern = re.compile(r'useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{')
    
    for match in use_effect_pattern.finditer(content):
        start_char = match.start()
        # Find ending matching brace
        brace_count = 1
        paren_count = 1 # since it's useEffect( () => {
        # Actually, let's trace braces from the '{' which starts at match.end() - 1
        curr = match.end()
        # wait, match.end() points right after the '{'
        brace_count = 1
        while curr < len(content) and brace_count > 0:
            if content[curr] == '{':
                brace_count += 1
            elif content[curr] == '}':
                brace_count -= 1
            curr += 1
        
        # Now find the closing parenthesis of useEffect( ... )
        # It should be close to curr
        while curr < len(content) and content[curr] != ')':
            curr += 1
        if curr < len(content):
            curr += 1 # include the ')'
        
        # Convert character indices to line numbers
        start_line = content[:start_char].count('\n') + 1
        end_line = content[:curr].count('\n') + 1
        use_effect_blocks.append({
            'start_line': start_line,
            'end_line': end_line,
            'code': content[start_char:curr],
            'async': 'async' in match.group(0)
        })

    print(f"Found {len(use_effect_blocks)} useEffect blocks.")
    for block in use_effect_blocks:
        print(f"useEffect (lines {block['start_line']} to {block['end_line']}): async={block['async']}")
        # print first line and last line of the block
        cb = block['code'].split('\n')
        print(f"  First: {cb[0]}")
        print(f"  Last: {cb[-1]}")
        
    return lines, content, use_effect_blocks

lines, content, use_effects = parse_app()
