// ─────────────────────────────────────────────────────────────────────────────
// Firestore security rules unit tests
//
// Runs against the local Firestore emulator via `firebase emulators:exec`
// (see .github/workflows/firestore-rules-test.yml). Guards the rules that
// protect the hybrid workspace model:
//   • personal workspaces: only the owner
//   • the shared 'ecadrn-shared' workspace: any verified @ecadrn.org member
//   • @ecadrn.org email enforcement everywhere
//   • per-user scoping: notifications, presence, googleConnections, comments
//   • data validators + field-diff restrictions on updates
//   • immutability: feedback, versions
// Run: npm run test:rules   (requires the emulator, or CI does it for you)
// ─────────────────────────────────────────────────────────────────────────────
const {
  assertSucceeds,
  assertFails,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
// rules-unit-testing v5 no longer re-exports firestore operations — pull them
// from the app's own firebase dependency instead.
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
} = require('firebase/firestore');
const fs = require('fs');

const PROJECT_ID = 'demo-ecadrn';
let testEnv;

// Test identities
const ALICE = { uid: 'alice-uid', email: 'alice@ecadrn.org' };   // member, personal org
const BOB = { uid: 'bob-uid', email: 'bob@ecadrn.org' };         // member, another personal org
const EVE = { uid: 'eve-uid', email: 'eve@gmail.com' };          // signed in, NOT a member

const orgDoc = { name: 'ECADRN', profileText: 'ADR network', updatedAt: '2026-09-28T00:00:00Z' };
const validNotification = {
  userId: 'alice-uid', type: 'grant', message: 'New grant matched', read: false,
  timestamp: '2026-09-28T00:00:00Z',
};
const validFeedback = {
  type: 'issue', subject: 'Bug in dashboard', message: 'Tour overlay glitch',
  userEmail: 'alice@ecadrn.org', createdAt: '2026-09-28T00:00:00Z',
  status: 'sent', page: 'dashboard',
};

const ctx = (user) => (user ? testEnv.authenticatedContext(user.uid, user) : testEnv.unauthenticatedContext());
const fsx = (user) => ctx(user).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(`${__dirname}/../firestore.rules`, 'utf8') },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed: alice's personal org, bob's personal org, the shared org
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    const db = adminCtx.firestore();
    await setDoc(doc(db, 'organizations/alice-uid'), orgDoc);
    await setDoc(doc(db, 'organizations/bob-uid'), { ...orgDoc, name: "Bob's Org" });
    await setDoc(doc(db, 'organizations/ecadrn-shared'), orgDoc);
  });
});

// ── 1. Authentication wall ───────────────────────────────────────────────────

describe('unauthenticated access is denied everywhere', () => {
  it('cannot read a personal org', () =>
    assertFails(getDoc(doc(fsx(null), 'organizations/alice-uid'))));
  it('cannot read the shared org', () =>
    assertFails(getDoc(doc(fsx(null), 'organizations/ecadrn-shared'))));
  it('cannot create an org', () =>
    assertFails(setDoc(doc(fsx(null), 'organizations/alice-uid'), orgDoc)));
  it('cannot list grants', () =>
    assertFails(getDocs(collection(fsx(null), 'organizations/ecadrn-shared/grants'))));
});

// ── 2. @ecadrn.org enforcement ───────────────────────────────────────────────

describe('signed-in non-@ecadrn.org users are locked out', () => {
  it('cannot read the shared org', () =>
    assertFails(getDoc(doc(fsx(EVE), 'organizations/ecadrn-shared'))));
  it('cannot read a personal org', () =>
    assertFails(getDoc(doc(fsx(EVE), 'organizations/alice-uid'))));
  it('cannot write into the shared org subcollections', () =>
    assertFails(setDoc(doc(fsx(EVE), 'organizations/ecadrn-shared/grants/g1'),
      { title: 'X', updatedAt: '2026-09-28T00:00:00Z' })));
  it('cannot create an org with its own uid', () =>
    assertFails(setDoc(doc(fsx(EVE), 'organizations/eve-uid'), orgDoc)));
});

// ── 3. Personal workspace isolation ──────────────────────────────────────────

describe('personal workspaces are private to their owner', () => {
  it('owner can read their own org', () =>
    assertSucceeds(getDoc(doc(fsx(ALICE), 'organizations/alice-uid'))));
  it('owner can update their own org (allowed keys)', () =>
    assertSucceeds(updateDoc(doc(fsx(ALICE), 'organizations/alice-uid'),
      { ...orgDoc, name: 'ECADRN Inc' })));
  it('another member cannot read a personal org', () =>
    assertFails(getDoc(doc(fsx(BOB), 'organizations/alice-uid'))));
  it('another member cannot write into a personal org subcollection', () =>
    assertFails(setDoc(doc(fsx(BOB), 'organizations/alice-uid/grants/g1'),
      { title: 'X', updatedAt: '2026-09-28T00:00:00Z' })));
});

// ── 4. Shared workspace ──────────────────────────────────────────────────────

describe('the shared workspace is open to all @ecadrn.org members', () => {
  it('any member can read the shared org', () =>
    assertSucceeds(getDoc(doc(fsx(ALICE), 'organizations/ecadrn-shared'))));
  it('any member can create a grant', () =>
    assertSucceeds(setDoc(doc(fsx(BOB), 'organizations/ecadrn-shared/grants/grant-1'),
      { title: 'ADR Expansion Grant', updatedAt: '2026-09-28T00:00:00Z' })));
  it('any member can list proposals', async () => {
    await assertSucceeds(getDocs(collection(fsx(ALICE), 'organizations/ecadrn-shared/proposals')));
  });
});

// ── 5. Organization root listing is closed (privacy hole fix, 2026-09-28) ─────

describe('the organizations collection root cannot be queried', () => {
  it('a member cannot list all organizations', () =>
    assertFails(getDocs(collection(fsx(ALICE), 'organizations'))));
  it('even the shared org cannot be enumerated via the root', () =>
    assertFails(getDocs(query(collection(fsx(BOB), 'organizations'), limit(5)))));
});

// ── 6. Data validators ───────────────────────────────────────────────────────

describe('organization document validation', () => {
  it('rejects a create missing required fields', () =>
    assertFails(setDoc(doc(fsx(ALICE), 'organizations/new-org-1'),
      { name: 'Only Name' })));
  it('rejects an oversized name', () =>
    assertFails(setDoc(doc(fsx(ALICE), 'organizations/new-org-1'),
      { ...orgDoc, name: 'X'.repeat(201) })));
  it('rejects an update that adds a field outside the allow-list', () =>
    assertFails(updateDoc(doc(fsx(ALICE), 'organizations/alice-uid'),
      { ...orgDoc, adminFlag: true })));
  it('rejects invalid document ids', () =>
    assertFails(setDoc(doc(fsx(ALICE), 'organizations/ecadrn-shared/grants/bad id with spaces'),
      { title: 'X', updatedAt: '2026-09-28T00:00:00Z' })));
});

// ── 7. Per-user scoping ──────────────────────────────────────────────────────

describe('notifications are scoped to the requesting user', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const db = adminCtx.firestore();
      await setDoc(doc(db, 'organizations/ecadrn-shared/notifications/n-alice'), validNotification);
      await setDoc(doc(db, 'organizations/ecadrn-shared/notifications/n-bob'),
        { ...validNotification, userId: 'bob-uid' });
    });
  });
  it('a user can list only their own notifications', () =>
    assertSucceeds(getDocs(query(
      collection(fsx(ALICE), 'organizations/ecadrn-shared/notifications'),
      where('userId', '==', 'alice-uid')))));
  it('a user cannot list all notifications unfiltered (privacy hole fix, 2026-09-28)', () =>
    assertFails(getDocs(
      collection(fsx(ALICE), 'organizations/ecadrn-shared/notifications'))));
  it("a user cannot list someone else's notifications", () =>
    assertFails(getDocs(query(
      collection(fsx(ALICE), 'organizations/ecadrn-shared/notifications'),
      where('userId', '==', 'bob-uid')))));
  it('a user cannot get another user notification by id', () =>
    assertFails(getDoc(doc(fsx(ALICE), 'organizations/ecadrn-shared/notifications/n-bob'))));
  it('cannot create a notification for another user', () =>
    assertFails(addDoc(collection(fsx(ALICE), 'organizations/ecadrn-shared/notifications'),
      { ...validNotification, userId: 'bob-uid' })));
  it('can mark their own notification read, but nothing else', () => {
    const ref = doc(fsx(ALICE), 'organizations/ecadrn-shared/notifications/n-alice');
    return assertSucceeds(updateDoc(ref, { read: true }))
      .then(() => assertFails(updateDoc(ref, { read: false, message: 'tampered' })));
  });
});

describe('googleConnections are per-user', () => {
  const conn = {
    email: 'alice@ecadrn.org', scopes: ['drive', 'gmail'],
    connectedAt: '2026-09-28T00:00:00Z', lastConnectedAt: '2026-09-28T00:00:00Z',
  };
  it('a user can create their own connection record', () =>
    assertSucceeds(setDoc(doc(fsx(ALICE), 'organizations/ecadrn-shared/googleConnections/alice-uid'), conn)));
  it("a user cannot create another user's record", () =>
    assertFails(setDoc(doc(fsx(ALICE), 'organizations/ecadrn-shared/googleConnections/bob-uid'), conn)));
  it('a user cannot write into a personal org they do not own', () =>
    assertFails(setDoc(doc(fsx(BOB), 'organizations/alice-uid/googleConnections/alice-uid'), conn)));
});

describe('proposal comments are editable only by their author', () => {
  const propPath = 'organizations/ecadrn-shared/proposals/p-1';
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const db = adminCtx.firestore();
      await setDoc(doc(db, propPath), {
        title: 'Proposal', status: 'draft', updatedAt: '2026-09-28T00:00:00Z',
      });
    });
  });
  it('alice creates a comment', () =>
    assertSucceeds(addDoc(collection(fsx(ALICE), `${propPath}/comments`),
      { text: 'Looks good', userId: 'alice-uid' })));
  it('bob cannot update alice comment', async () => {
    const snap = await addDoc(collection(fsx(ALICE), `${propPath}/comments`),
      { text: 'From Alice', userId: 'alice-uid' });
    return assertFails(updateDoc(doc(fsx(BOB), snap.path), { text: 'Tampered' }));
  });
});

describe('proposal versions are append-only', () => {
  const propPath = 'organizations/ecadrn-shared/proposals/p-2';
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const db = adminCtx.firestore();
      await setDoc(doc(db, propPath), { title: 'P', status: 'draft', updatedAt: '2026-09-28T00:00:00Z' });
      await setDoc(doc(db, `${propPath}/versions/v1`), { content: 'draft 1' });
    });
  });
  it('a member can create a new version', () =>
    assertSucceeds(addDoc(collection(fsx(ALICE), `${propPath}/versions`), { content: 'draft 2' })));
  it('a member cannot update an existing version', () =>
    assertFails(updateDoc(doc(fsx(ALICE), `${propPath}/versions/v1`), { content: 'rewritten' })));
});

describe('presence slots are per-user', () => {
  const base = 'organizations/ecadrn-shared/proposals/p-3';
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await setDoc(doc(adminCtx.firestore(), base), { title: 'P', status: 'draft', updatedAt: '2026-09-28T00:00:00Z' });
    });
  });
  it('a user can write their own presence slot', () =>
    assertSucceeds(setDoc(doc(fsx(ALICE), `${base}/presence/alice-uid`), { active: true })));
  it("a user cannot write another user's slot", () =>
    assertFails(setDoc(doc(fsx(BOB), `${base}/presence/alice-uid`), { active: false })));
});

// ── 8. Feedback immutability ─────────────────────────────────────────────────

describe('feedback (Message Ellis) is create-only', () => {
  const feedbackPath = 'organizations/ecadrn-shared/feedback';
  it('a member can submit valid feedback', () =>
    assertSucceeds(addDoc(collection(fsx(ALICE), feedbackPath), validFeedback)));
  it('rejects feedback with a wrong status', () =>
    assertFails(addDoc(collection(fsx(ALICE), feedbackPath), { ...validFeedback, status: 'open' })));
  it('rejects feedback with a non-ecadrn email', () =>
    assertFails(addDoc(collection(fsx(ALICE), feedbackPath), { ...validFeedback, userEmail: 'eve@gmail.com' })));
  it('feedback can never be edited', async () => {
    const snap = await addDoc(collection(fsx(ALICE), feedbackPath), validFeedback);
    return assertFails(updateDoc(doc(fsx(ALICE), snap.path), { status: 'resolved' }));
  });
  it('feedback can never be deleted', async () => {
    const snap = await addDoc(collection(fsx(ALICE), feedbackPath), validFeedback);
    return assertFails(deleteDoc(doc(fsx(ALICE), snap.path)));
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});
