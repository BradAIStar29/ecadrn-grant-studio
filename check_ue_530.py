import re

with open('ecadrn-grant-studio/src/App.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

# 1. State updates after unmount / missing cleanups
# Let's inspect all useEffect returns and look for unsubscribe functions or cleanups.
# We found:
# - unsubNotifs is subscribed in useEffect line 338, but never unsubscribed in line 427's return. This is a clear bug!
# Let's see if there are other subscriptions in useEffect blocks.
# Let's check line 530 to 575 useEffect:
print("=== CHECKING useEffect 530-575 ===")
for i in range(529, min(len(lines), 576)):
    print(f"{i+1}: {lines[i]}")
