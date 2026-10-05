/* ─────────────────────────────────────────────────────────────────────────────
 * tryon-queue.js — the session queue for OUR OWN try-on pages
 *   /onboarding-extension, /onboarding-campaign, the landing demo (index.html),
 *   old_index.html. One copy, so the four cannot drift apart.
 *
 * Why these pages queue at all (QUEUE_SYSTEM.md § Our own pages): until
 * 2026-10-04 they minted straight from /api/tokens, which never touches the
 * queue. Their sessions took GPU seats the queue could not see. And when the
 * pool was full, Decart rejected the connect with "Server at capacity", which
 * the page could only report as a vague error. Now they join through
 * /api/queue/join like the extension widget does. The server puts our own
 * domains in the PRIORITY tier (isOwnPagesHost in server.js), so they are
 * served first and usually seated at once.
 *
 * Same wire contract as the widget's fetchDecartTokenViaQueue (extension repo,
 * dev/_widget_entry.js): join → poll /status every poll_ms → heartbeat every
 * 30s while streaming → leave on teardown. Two rules carried over from it:
 *   - A 4xx refusal (ban, disabled account, cap, paywall) is TERMINAL. It is
 *     thrown, never retried through /api/tokens, which would only refuse again.
 *   - Queue INFRASTRUCTURE failing (network, 5xx, a missing route) falls back to
 *     /api/tokens. The queue fails open on the server; the client does too.
 *
 * window.__awTryonQueue:
 *   acquire({ base, body, track, onWaiting, isCancelled, defaultMaxWaitMs })
 *     → { token, ticketId, waitedMs }   admitted; token is the /api/tokens shape
 *     → { busy: true, waitedMs }        waited past the ceiling: the pool really
 *                                       is full, so "our servers are busy" is TRUE
 *     → { cancelled: true }             isCancelled() went true while waiting
 *     throws Error (err.httpStatus, err.code) on a refusal
 *   startHeartbeat(ticketId, token?), release()  — the token caps the seat at its session length
 *   isCapacityError(err)  — Decart's own "at capacity" connect rejection
 *   BUSY_MESSAGE          — the one sentence shown when either is true
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Shown ONLY when the pool is provably full: we waited in our own queue past
  // the ceiling, or Decart refused the connect for capacity. Any other failure
  // gets the page's generic server message — "busy" would be a lie there.
  var BUSY_MESSAGE = 'Our servers are popular and busy right now. Please try again in a minute.';
  var DEFAULT_MAX_WAIT_MS = 60000;   // when the account sets no max_queue_wait_seconds
  var HEARTBEAT_MS = 30000;          // QUEUE_SYSTEM.md § heartbeat: 180s silence frees the seat

  // A seat is never held longer than the session it was granted for. The token
  // carries that length (constraints.realtime.maxSessionDuration); Decart ends
  // the session there, so heartbeating past it only keeps an EMPTY seat.
  // 2026-10-04: a landing-demo tab left open after a 4-second try-on held a
  // priority seat for 15 minutes (until the server's 900s ceiling), because the
  // page released only on modal close.
  var SEAT_SLACK_S = 60;
  var DEFAULT_SESSION_S = 300;

  var ticketId = null, hbTimer = null, holdTimer = null, base = '';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function refusal(res, body) {
    var e = new Error((body && (body.code || body.error)) || ('queue HTTP ' + res.status));
    e.httpStatus = res.status;
    e.code = (body && body.code) || null;
    return e;
  }

  // 4xx = policy, terminal. Anything else (5xx, network) = infrastructure.
  function isTerminal(res) { return res.status >= 400 && res.status < 500 && res.status !== 404; }

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',   // aw_vid cookie, ban-system browser identity (bans.js)
      body: JSON.stringify(body || {}),
    });
  }

  async function legacyToken(opts) {
    var res = await postJson(opts.base + '/api/tokens', opts.body);
    if (!res.ok) throw refusal(res, await res.json().catch(function () { return null; }));
    return { token: await res.json(), ticketId: null, waitedMs: 0 };
  }

  async function acquire(opts) {
    opts = opts || {};
    base = opts.base || '';
    var track = opts.track || function () {};
    var isCancelled = opts.isCancelled || function () { return false; };
    var startedAt = Date.now();
    var ticket = null;

    try {
      var res = await postJson(base + '/api/queue/join', opts.body);
      if (!res.ok) {
        var errBody = await res.json().catch(function () { return null; });
        if (isTerminal(res)) throw Object.assign(refusal(res, errBody), { terminal: true });
        throw new Error('join HTTP ' + res.status);
      }
      var data = await res.json();
      if (data.status === 'active' && data.token && data.token.apiKey) {
        return { token: data.token, ticketId: data.ticket_id || null, waitedMs: 0 };
      }
      if (data.status !== 'waiting' || !data.ticket_id) throw new Error('unexpected join response');

      ticket = data.ticket_id;
      var maxWaitMs = Number(data.maxQueueWaitSeconds) > 0
        ? Number(data.maxQueueWaitSeconds) * 1000 : (opts.defaultMaxWaitMs || DEFAULT_MAX_WAIT_MS);
      var pos = function (d) { return d.position_in_lane || d.position || null; };
      track('queue_entered', { position: data.position, ahead: data.ahead == null ? null : data.ahead,
                               lane: data.lane || null, position_in_lane: data.position_in_lane || null,
                               source: 'backend' });
      if (opts.onWaiting) opts.onWaiting(pos(data), data);

      var rejoined = false;
      for (;;) {
        await sleep(data.poll_ms || 2500);
        if (isCancelled()) { ticketId = ticket; release(); return { cancelled: true }; }
        if (Date.now() - startedAt > maxWaitMs) {
          ticketId = ticket; release();
          track('queue_timeout', { waited_ms: Date.now() - startedAt });
          return { busy: true, waitedMs: Date.now() - startedAt };
        }
        var pr = await fetch(base + '/api/queue/status?ticket=' + encodeURIComponent(ticket),
                             { credentials: 'include' });
        if (!pr.ok) {
          var pBody = await pr.json().catch(function () { return null; });
          if (isTerminal(pr)) { ticketId = ticket; release(); throw Object.assign(refusal(pr, pBody), { terminal: true }); }
          throw new Error('status HTTP ' + pr.status);
        }
        var s = await pr.json();
        if (s.status === 'active' && s.token && s.token.apiKey) {
          track('queue_completed', { queue_duration_ms: Date.now() - startedAt });
          return { token: s.token, ticketId: ticket, waitedMs: Date.now() - startedAt };
        }
        if (s.status === 'waiting') {
          if (s.poll_ms) data.poll_ms = s.poll_ms;
          if (opts.onWaiting) opts.onWaiting(pos(s), s);
          continue;
        }
        // expired / done mid-wait (a laptop slept past the waiting TTL): rejoin once.
        if (rejoined) throw new Error('queue ticket lost twice');
        rejoined = true;
        var again = await postJson(base + '/api/queue/join', opts.body);
        if (!again.ok) {
          var aBody = await again.json().catch(function () { return null; });
          if (isTerminal(again)) throw Object.assign(refusal(again, aBody), { terminal: true });
          throw new Error('rejoin HTTP ' + again.status);
        }
        var a = await again.json();
        if (a.status === 'active' && a.token && a.token.apiKey) {
          return { token: a.token, ticketId: a.ticket_id || null, waitedMs: Date.now() - startedAt };
        }
        ticket = a.ticket_id;
      }
    } catch (err) {
      if (err && err.terminal) throw err;
      // Leave a line we were standing in before minting around it, or the
      // abandoned ticket holds a place ahead of real shoppers until its TTL.
      if (ticket) { ticketId = ticket; release(); }
      // FAIL-OPEN, client side: queue infrastructure must never block a try-on.
      track('queue_fallback', { error: String((err && err.message) || err).slice(0, 160) });
      return legacyToken(opts);
    }
  }

  /** startHeartbeat(ticketId, token?) — pass the admitted token so the seat is
   *  released when its session can no longer be running, even if the page
   *  never tears down (a tab left open). */
  function startHeartbeat(t, token) {
    ticketId = t || null;
    if (hbTimer) clearInterval(hbTimer);
    if (holdTimer) clearTimeout(holdTimer);
    hbTimer = null; holdTimer = null;
    if (!ticketId) return;
    var sessionS = Number(token && token.constraints && token.constraints.realtime &&
                          token.constraints.realtime.maxSessionDuration) || DEFAULT_SESSION_S;
    holdTimer = setTimeout(release, (sessionS + SEAT_SLACK_S) * 1000);
    hbTimer = setInterval(function () {
      fetch(base + '/api/queue/heartbeat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }), keepalive: true,
      }).catch(function () {});
    }, HEARTBEAT_MS);
  }

  /** Free the seat. Idempotent; call it from every teardown path. The server's
   *  TTL is the safety net if it never fires. */
  function release() {
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (!ticketId) return;
    var payload = JSON.stringify({ ticket_id: ticketId });
    ticketId = null;
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(base + '/api/queue/leave', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(base + '/api/queue/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                           body: payload, keepalive: true }).catch(function () {});
      }
    } catch (_) {}
  }

  function isCapacityError(err) {
    return /capacity/i.test(String((err && err.message) || err || ''));
  }

  try { window.addEventListener('pagehide', release); } catch (_) {}

  window.__awTryonQueue = {
    acquire: acquire, startHeartbeat: startHeartbeat, release: release,
    isCapacityError: isCapacityError, BUSY_MESSAGE: BUSY_MESSAGE,
    _ticket: function () { return ticketId; },
  };
})();
