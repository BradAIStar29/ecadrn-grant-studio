#!/usr/bin/env bash
#
# deploy-firestore-rules.sh — One-shot Firestore rules deployment
#
# This script deploys firestore.rules to the named Firestore database
# that the ECADRN Grant Studio app uses.
#
# PREREQUISITES:
#   1. Install Node.js 18+ from https://nodejs.org
#   2. Run: npm install -g firebase-tools
#   3. Run: firebase login (sign in with your @ecadrn.org Google account)
#
# USAGE:
#   ./deploy-firestore-rules.sh
#
# After running this once, the rules will be live. You can also set up
# the FIREBASE_SERVICE_ACCOUNT GitHub secret so CI auto-deploys on push.
#

set -e

PROJECT_ID="gen-lang-client-0456143672"
DATABASE_ID="ai-studio-bad18069-1a94-4ead-b188-10dcbdd2eee2"
RULES_FILE="firestore.rules"

echo "═══════════════════════════════════════════════════════════════"
echo "  ECADRN Grant Studio — Firestore Rules Deployment"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Project:    $PROJECT_ID"
echo "Database:   $DATABASE_ID"
echo "Rules file: $RULES_FILE"
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
echo "Checking Firebase authentication..."
if ! firebase projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
    echo "⚠️  Not logged in or no access to project. Running firebase login..."
    firebase login
fi

echo ""
echo "Deploying Firestore rules..."
echo ""

# Deploy rules to the project (firebase-tools 13+ deploys to all databases)
firebase deploy --only firestore:rules --project "$PROJECT_ID" --non-interactive

echo ""
echo "✅ Firestore rules deployed successfully!"
echo ""
echo "The ECADRN Grant Studio app should now work after login."
echo "Visit: https://bradaistar29.github.io/ecadrn-grant-studio/"
echo ""
echo "To set up automatic deployment via GitHub Actions:"
echo "  1. Go to Google Cloud Console > IAM > Service Accounts"
echo "  2. Create a key for the 'github-deployer' service account (JSON)"
echo "  3. Go to GitHub repo Settings > Secrets and variables > Actions"
echo "  4. Add a secret named FIREBASE_SERVICE_ACCOUNT with the JSON content"
echo ""
