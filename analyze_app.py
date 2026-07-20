import re

def analyze():
    with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
        lines = f.readlines()
    
    content = "".join(lines)
    
    print(f"Total lines: {len(lines)}")
    
    # 8. onSnapshot unsubscribes
    print("\n--- 8. onSnapshot calls ---")
    for idx, line in enumerate(lines):
        if "onSnapshot(" in line:
            print(f"Line {idx+1}: {line.strip()}")
            # print surrounding 5 lines
            for j in range(max(0, idx-2), min(len(lines), idx+6)):
                print(f"  {j+1}: {lines[j].strip()}")

    # 9. localStorage access
    print("\n--- 9. localStorage calls ---")
    for idx, line in enumerate(lines):
        if "localStorage" in line:
            print(f"Line {idx+1}: {line.strip()}")
            # print context
            for j in range(max(0, idx-2), min(len(lines), idx+4)):
                print(f"  {j+1}: {lines[j].strip()}")

    # 11. new Date calls
    print("\n--- 11. new Date calls ---")
    for idx, line in enumerate(lines):
        if "new Date(" in line:
            print(f"Line {idx+1}: {line.strip()}")

    # 7. addEventListener
    print("\n--- 7. addEventListener calls ---")
    for idx, line in enumerate(lines):
        if "addEventListener" in line:
            print(f"Line {idx+1}: {line.strip()}")
            for j in range(max(0, idx-2), min(len(lines), idx+6)):
                print(f"  {j+1}: {lines[j].strip()}")

    # 12. dangerouslySetInnerHTML or innerHTML
    print("\n--- 12. dangerouslySetInnerHTML or innerHTML or raw HTML concatenation ---")
    for idx, line in enumerate(lines):
        if "dangerouslySetInnerHTML" in line or "innerHTML" in line:
            print(f"Line {idx+1}: {line.strip()}")
            for j in range(max(0, idx-2), min(len(lines), idx+4)):
                print(f"  {j+1}: {lines[j].strip()}")

if __name__ == "__main__":
    analyze()
