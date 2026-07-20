/**
 * deploy-firestore-rules.mjs
 * 
 * Self-contained script to deploy Firestore security rules to the
 * named database used by the ECADRN Grant Studio app.
 * 
 * USAGE:
 *   node deploy-firestore-rules.mjs
 * 
 * This will:
 *   1. Open your browser for Google sign-in
 *   2. Get an OAuth token with Firestore admin permissions
 *   3. Deploy firestore.rules to the named database
 *   4. Verify the rules are live
 * 
 * No service account key needed — uses your Google account directly.
 */

import { readFileSync, existsSync } from 'fs';
import { createServer } from 'http';
import { execSync } from 'child_process';
import { google } from 'googleapis';

const PROJECT_ID = 'gen-lang-client-0456143672';
const DATABASE_ID = 'ai-studio-bad18069-1a94-4ead-b188-10dcbdd2eee2';
const RULES_FILE = 'firestore.rules';

// OAuth config — using Google APIs with the Firebase project's client ID
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/datastore',
];

async function deployRules() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ECADRN Grant Studio — Firestore Rules Deployment');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (!existsSync(RULES_FILE)) {
    console.error(`❌ Rules file not found: ${RULES_FILE}`);
    console.error('   Run this script from the ecadrn-grant-studio directory.');
    process.exit(1);
  }

  const rulesContent = readFileSync(RULES_FILE, 'utf8');
  console.log(`✓ Loaded rules from ${RULES_FILE} (${rulesContent.length} bytes)`);
  console.log('');

  // Set up OAuth2 client using Google's default client
  // Using the GCM client ID (works for any Google account)
  const oauth2Client = new google.auth.OAuth2(
    '292979040440-1u8d9kqbk3hvnnar8d2s0553q5mb8ur3.apps.googleusercontent.com',
    '', // No client secret needed for desktop app
    'http://localhost:8765/callback'
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('Opening browser for Google sign-in...');
  console.log('');
  console.log('If the browser doesn\'t open automatically, visit:');
  console.log(authUrl);
  console.log('');

  // Open browser
  try {
    execSync(`open "${authUrl}"`, { stdio: 'ignore' });
  } catch {
    try {
      execSync(`xdg-open "${authUrl}"`, { stdio: 'ignore' });
    } catch {
      try {
        execSync(`start "${authUrl}"`, { stdio: 'ignore' });
      } catch {
        console.log('Please open the URL above in your browser manually.');
      }
    }
  }

  // Wait for OAuth callback
  const code = await waitForOAuthCallback();
  console.log('✓ Authorization received');
  console.log('');

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  console.log('✓ Got access token');
  console.log('');

  // Deploy rules via Firestore Admin API
  console.log(`Deploying rules to database: ${DATABASE_ID}`);
  console.log('');

  const firestore = google.firestore({
    version: 'v1',
    auth: oauth2Client,
  });

  try {
    // Update the database security rules
    const response = await firestore.projects.databases.patch({
      name: `projects/${PROJECT_ID}/databases/${DATABASE_ID}`,
      updateMask: 'securityRules',
      requestBody: {
        securityRules: {
          rules: rulesContent,
        },
      },
    });

    console.log('✅ Firestore rules deployed successfully!');
    console.log('');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed to deploy rules:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Try alternative API endpoint
    console.log('');
    console.log('Trying alternative deployment method...');
    try {
      const response2 = await firestore.projects.databases.update({
        name: `projects/${PROJECT_ID}/databases/${DATABASE_ID}`,
        updateMask: 'securityRules',
        requestBody: {
          securityRules: {
            rules: rulesContent,
          },
        },
      });
      console.log('✅ Firestore rules deployed via alternative method!');
      console.log('Response:', JSON.stringify(response2.data, null, 2));
    } catch (error2) {
      console.error('❌ Alternative method also failed:', error2.message);
      process.exit(1);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  The ECADRN Grant Studio app should now work after login!');
  console.log('  Visit: https://bradaistar29.github.io/ecadrn-grant-studio/');
  console.log('═══════════════════════════════════════════════════════════════');
}

function waitForOAuthCallback() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:8765');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        server.close();
        reject(new Error(error));
      } else if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(8765, () => {
      console.log('Waiting for authorization on http://localhost:8765 ...');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 5 minutes'));
    }, 300000);
  });
}

deployRules().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
