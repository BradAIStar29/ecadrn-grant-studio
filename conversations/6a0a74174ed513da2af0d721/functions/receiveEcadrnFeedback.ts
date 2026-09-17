// ─────────────────────────────────────────────────────────────────────────────
// receiveEcadrnFeedback — inbound feedback pipe from the ECADRN Grant Studio app
//
// Flow: ECADRN app user → Cloudflare Worker /feedback (Firebase-auth'd,
// @ecadrn.org-locked) → this function → Feedback entity record → an
// entity-triggered workflow wakes Ellis to triage it.
//
// This endpoint requires the shared worker token (defense in depth: the
// function URL is public; the worker route is the primary auth gate).
// ─────────────────────────────────────────────────────────────────────────────
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const WORKER_SHARED_TOKEN = '8b6a5237972867190d94144880821eb3e15b0b4c49faaf1e';
const VALID_TYPES = ['issue', 'recommendation', 'question'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Shared-secret check — the request must come from the ECADRN worker
    const auth = req.headers.get('authorization') || '';
    const bearer = auth.replace(/^Bearer\s+/i, '');
    if (bearer !== WORKER_SHARED_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}

    // Validate payload (the worker pre-validates too — belt and braces)
    const type = String(body?.type || '').toLowerCase();
    const subject = String(body?.subject || '').slice(0, 200).trim();
    const message = String(body?.message || '').slice(0, 5000).trim();
    const userEmail = String(body?.userEmail || '').slice(0, 200).trim();
    const page = String(body?.page || '').slice(0, 100).trim();
    const appName = String(body?.appName || 'ecadrn-grant-studio').slice(0, 100).trim();

    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!message || !userEmail.endsWith('@ecadrn.org')) {
      return new Response(JSON.stringify({ ok: false, error: 'message and @ecadrn.org email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store as a service-level record (no end-user auth on this app)
    const record = await base44.asServiceRole.entities.Feedback.create({
      type,
      subject,
      message,
      userEmail,
      page,
      appName,
      status: 'new',
    });

    return new Response(JSON.stringify({ ok: true, id: record?.id ?? null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
