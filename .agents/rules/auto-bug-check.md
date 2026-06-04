# Auto Bug Check After Every Change

After completing ANY code change, feature addition, or fix to the `ecadrn-grant-studio` project, automatically run a full bug check WITHOUT being asked.

## What to check every time (in this order):

1. **TypeScript errors** — `npx tsc --noEmit` — zero errors required before pushing
2. **Build** — `npm run build` — must succeed with no errors
3. **Worker action coverage** — every `callAI('action', ...)` in `App.tsx` must have a matching `case 'action':` in `worker/src/index.ts`
4. **Hardcoded URLs** — scan for `/api/`, `localhost`, `127.0.0.1` in `src/` — none allowed (must use `callAI()` or `API_BASE`)
5. **Unguarded AI result loops** — any `for...of` or `.forEach` over AI results must have `Array.isArray()` + `title`/`funderName` validation before writing to Firestore
6. **Missing prop threading** — check that `orgId` and `user` are passed through to every component that uses them
7. **Optional chaining on nullable fields** — check `organization?.voiceProfile`, `user?.email`, `user?.uid`, etc.
8. **Null guards on arrays** — `.length`, `.filter`, `.map`, `.forEach` on `grants`, `proposals`, `voiceProfiles` must use `|| []` or `?.`

## After the check:

- If bugs are found: fix them all, then commit and push in a single clean commit
- If no bugs: confirm "✓ Full bug check passed — no issues found" to the user
- Always report what was checked and what (if anything) was fixed — never silently skip

## This rule applies to:
- Every new feature added
- Every bug fix
- Every refactor
- Every update merged from a zip file
- No exceptions
