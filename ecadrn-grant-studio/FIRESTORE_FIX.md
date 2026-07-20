# Firestore Rules Deployment Fix

## The Problem

The ECADRN Grant Studio app uses a **named Firestore database**:
```
ai-studio-bad18069-1a94-4ead-b188-10dcbdd2eee2
```

This database was auto-created by Google AI Studio. It's in **production mode**, which means all reads and writes are **denied by default** unless security rules are deployed.

**The CI pipeline has NEVER successfully deployed rules** because the `FIREBASE_SERVICE_ACCOUNT` GitHub secret was never set. This is why **nothing shows up after you log in** — every Firestore read returns `403: Missing or insufficient permissions`.

## The Fix (Choose One)

### Option A: Quick Local Deploy (Recommended — 2 minutes)

1. Install Node.js 18+ from https://nodejs.org
2. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
3. Log in to Firebase:
   ```bash
   firebase login
   ```
   (Sign in with your @ecadrn.org Google account)
4. From the `ecadrn-grant-studio/` directory, run:
   ```bash
   firebase deploy --only firestore:rules --project gen-lang-client-0456143672
   ```

Done! The app will work immediately after the rules are deployed.

### Option B: Set GitHub Secret for CI Auto-Deploy

1. Go to [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts?project=gen-lang-client-0456143672)
2. Find or create the `github-deployer` service account
3. Click → Keys → Add Key → Create new key → JSON
4. Download the JSON file
5. Go to [GitHub Repo Settings → Secrets](https://github.com/BradAIStar29/ecadrn-grant-studio/settings/secrets/actions)
6. Add a new secret:
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the entire JSON content
7. Push any commit to `main` to trigger CI

### Option C: Update Rules Manually in Firebase Console

1. Go to [Firebase Console → Firestore](https://console.firebase.google.com/project/gen-lang-client-0456143672/firestore/databases/ai-studio-bad18069-1a94-4ead-b188-10dcbdd2eee2/rules)
2. Copy the contents of `firestore.rules` from this repo
3. Paste into the rules editor
4. Click **Publish**

## After Deploying

Visit: https://bradaistar29.github.io/ecadrn-grant-studio/

Log in with your @ecadrn.org email. You should see:
- The dashboard with the ECADRN organization profile (auto-created on first load)
- Empty proposals, grants, and funders lists (ready to use)

## Verification

To verify rules are deployed, check:
```bash
curl "https://firestore.googleapis.com/v1/projects/gen-lang-client-0456143672/databases/ai-studio-bad18069-1a94-4ead-b188-10dcbdd2eee2/documents/organizations/test"
```
- `403` = rules not deployed yet (still locked down)
- `404` = rules deployed but document doesn't exist (this is correct!)
