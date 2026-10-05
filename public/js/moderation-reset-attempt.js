/**
 * moderation-reset-attempt.js - recover a flagged stream instead of ending the session.
 *
 * On the pod's content_flag we wipe the model's KV cache, then re-arm the
 * detector so a failed reset attempt flags again. Unrecoverable streams are cut.
 *
 * This is the landing try-example port of the Chrome extension's
 * moderation-reset-attempt.js (chrome_extension repo, dev/chrome-extension/),
 * used by the "Try now" modal in public/index.html. The policy, the config keys,
 * the timings and the analytics names are the same on purpose, so both surfaces
 * land in one measurement. Full reasoning and the wire protocol are in that
 * repo's docs/moderation-reset-attempt.md. The flag policy (onContentFlag), the
 * reset (doReset), the re-arm, the perturbation and the tuning surface are
 * byte-identical to it; the six places this port differs are listed in
 * MODERATION_RESET_ATTEMPT.md here.
 *
 * Three things here are not obvious.
 *
 *   1. Loads BEFORE decart-sdk.min.js. Patching window.WebSocket is the only
 *      seam: the SDK's handleMessage switches on msg.type with no default
 *      branch, so content_flag is parsed and dropped, and it has no API for
 *      set_detector_scoring at all.
 *
 *   2. The trigger is a pixel nudge on the garment, never the prompt. The
 *      pipeline resets when the reference image changes (exact tensor compare,
 *      so a byte-identical replay does nothing). What we replay is the page's
 *      OWN captured set_image, verbatim apart from the pixels, so the reset
 *      lands the pipeline in the state a genuine garment pick would.
 *
 *   3. A flag in the first FRESH_CACHE_MS after a garment goes live gets no
 *      reset. That garment already wiped the cache, so there is no accumulated
 *      memory to clear and the item itself is the problem.
 *
 * Debug: window.__decartModerationResetAttempt.report() / .trigger() / .configure({...})
 */
(function () {
  'use strict';

  var CFG = (window.DECART_CONFIG && window.DECART_CONFIG.MODERATION_RESET_ATTEMPT) || {};
  function cfg(key, fallback) {
    return CFG[key] === undefined ? fallback : CFG[key];
  }

  // Defaults mirror the extension's config.js MODERATION_RESET_ATTEMPT block.
  // Overridable from the page by setting window.DECART_CONFIG before this loads,
  // or at runtime through configure() below.
  var ENABLED               = cfg('ENABLED', true);
  var MAX_RESETS            = cfg('MAX_RESETS_PER_SESSION', Infinity);
  var RESET_WITH_ENHANCE    = cfg('RESET_WITH_ENHANCEMENT', true);
  var REARM_DETECTOR        = cfg('REARM_DETECTOR', true);
  var RESET_SETTLE_MS       = cfg('RESET_SETTLE_MS', 4000);
  var OUTPUT_FLAGS_ONLY     = cfg('OUTPUT_FLAGS_ONLY', true);
  var GIVE_UP_ACTION        = cfg('GIVE_UP_ACTION', 'end_session');
  var RESET_APPLY_MS        = cfg('RESET_APPLY_MS', 400);
  var REARM_GRACE_MS        = cfg('REARM_GRACE_MS', 600);
  var FRESH_CACHE_MS        = cfg('FRESH_CACHE_MS', 2000);
  var GIVE_UP_MESSAGE       = cfg('GIVE_UP_MESSAGE', 'Something went wrong.');
  var GIVE_UP_MESSAGE_UNSUPPORTED = cfg('GIVE_UP_MESSAGE_UNSUPPORTED', 'This item is not supported');
  var GIVE_UP_RESTART_LABEL_UNSUPPORTED = cfg('GIVE_UP_RESTART_LABEL_UNSUPPORTED', 'Restart');
  var SET_IMAGE_ACK_TIMEOUT = cfg('SET_IMAGE_ACK_TIMEOUT_MS', 15000);
  var REARM_ACK_TIMEOUT     = cfg('REARM_ACK_TIMEOUT_MS', 5000);
  var DEBUG_PANEL           = cfg('DEBUG_PANEL', false);
  var RESET_MESSAGE_ENABLED = cfg('RESET_MESSAGE_ENABLED', true);
  var RESET_MESSAGE_TITLE   = cfg('RESET_MESSAGE_TITLE', "We couldn't process that");
  var RESET_MESSAGE_SUBTITLE= cfg('RESET_MESSAGE_SUBTITLE', 'Restarting the session');
  var RESET_MESSAGE_BLUR    = cfg('RESET_MESSAGE_BLUR', true);
  var RESET_MESSAGE_TARGET_MS = cfg('RESET_MESSAGE_TARGET_MS', 500);
  var RESET_MESSAGE_MAX_MS  = cfg('RESET_MESSAGE_MAX_MS', 12000);
  var RESET_MESSAGE_FADE_MS = cfg('RESET_MESSAGE_FADE_MS', 120);

  // Where to mount. The extension hard-codes the widget iframe's #root and
  // #remote-video; these defaults are the landing modal's equivalents, and they
  // are config so a second surface can retarget them without forking this file.
  // check.mjs asserts the defaults still match real ids in index.html: a
  // selector that matches nothing means no blur, and a notice mounted on
  // document.body, which on that page would land outside the modal.
  var VIDEO_SELECTOR        = cfg('VIDEO_SELECTOR', '#t-output');
  var CONTAINER_SELECTOR    = cfg('CONTAINER_SELECTOR', '#t-widget-panel');
  // 10: above .t-status (z-index 2), the only thing inside the panel that could
  // cover the notice. The modal is position:fixed with z-index 1000, so it owns
  // a stacking context and this stays scoped to the panel.
  var NOTICE_Z_INDEX        = cfg('NOTICE_Z_INDEX', 10);
  var FONT_FAMILY           = cfg('NOTICE_FONT_FAMILY', 'inherit');

  var NSFW_THRESHOLD        = cfg('NSFW_THRESHOLD', null);
  var SERVER_SIDE           = cfg('SERVER_SIDE_ENFORCEMENT', false);

  // The WebSocket hook now carries two things: the server-side enforcement
  // switch on the outbound URL and the content_flag listener. Either one is
  // reason enough to install it, so ENABLED alone no longer gates the module -
  // turning the client reset ladder off must not silently disable server-side
  // moderation with it.
  if (!ENABLED && NSFW_THRESHOLD == null) return;

  // ── Session state ──────────────────────────────────────────────────────────
  var sockets     = [];    // hooked sockets that have carried a set_image
  var lastSetImage = null; // last set_image the page sent with a real garment
  var baseCanvas  = null;  // decoded garment, cached for perturbation
  var baseKey     = null;  // which set_image the canvas was built from
  var variantOn   = false; // A/B perturbation toggle
  var replaying   = false; // suppress self-capture while re-sending
  var busy        = false;

  var flagCount   = 0;
  var resetCount  = 0;
  var lastResetAt = 0;     // Date.now() of the last reset we sent
  // Flags before this timestamp belong to the previous reset, not to a new
  // incident. Armed when the reset is sent and re-armed on the set_image_ack,
  // because in enhance mode the enhancer adds 1-2s before the server applies
  // the image at all: measuring only from send would end the window while the
  // reset was still in flight and charge a retry for the same incident.
  var settleUntil = 0;
  // When output for the CURRENT reference image started flowing, i.e. when the
  // KV cache was last wiped by a reference change (a garment pick, a rotation,
  // or one of our own resets). Used to tell fresh-cache moderation from
  // accumulated drift. See onContentFlag.
  var referenceLiveAt = 0;
  var referenceSentAt = 0; // fallback before the first ack of a session
  var gaveUp      = false;
  var rearmAcked  = null;  // null = never acked (old image), true/false = applied
  var sessionT0   = Date.now();
  var timeline    = [];

  // ── Flag → cleared pairing (server-side lane) ───────────────────────────────
  // The pod answers a flag with its own KV reset, then sends phase:'cleared'
  // when the blur drops. The gap between the two is the only client-visible
  // measure of how long a user actually sat behind that blur, so pair them at
  // capture time rather than leaving it to be re-joined from two event streams
  // later. Both stamps are session-relative, matching record()'s at_ms.
  var lastFlagAt   = 0;     // Date.now() of the last phase:'flagged'
  var lastFlagAtMs = null;  // same, session-relative
  var lastFlagN    = 0;     // which flag it was (pairs with flag_n)
  var flagCleared  = true;  // false while a flag is still waiting for its cleared

  function resetSessionState() {
    lastSetImage = null;
    baseCanvas = null;
    baseKey = null;
    flagCount = 0;
    resetCount = 0;
    lastResetAt = 0;
    settleUntil = 0;
    referenceLiveAt = 0;
    referenceSentAt = 0;
    gaveUp = false;
    rearmAcked = null;
    lastFlagAt = 0;
    lastFlagAtMs = null;
    lastFlagN = 0;
    flagCleared = true;
    sessionT0 = Date.now();
    timeline = [];
  }

  // ── Logging ────────────────────────────────────────────────────────────────
  // Three sinks: the timeline (report()), the console, and __decartTrack so the
  // numbers survive outside one DevTools session. __decartTrack is defined by
  // the page's own script, which loads after us, so resolve it lazily.
  function record(kind, data) {
    var entry = {
      kind: kind,
      at_ms: Date.now() - sessionT0,
      flags: flagCount,
      resets: resetCount,
      data: data || {},
    };
    timeline.push(entry);
    console.log('[moderation-reset-attempt] ' + kind, entry.data);
    if (window.__decartTrack) {
      var props = { session_ms: entry.at_ms, flag_n: flagCount, reset_n: resetCount };
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) props[k] = data[k];
      props.tryon_id = window.__decartTryonId || null;
      props.api_session_id = window.__decartApiSessionId || null;
      props.model_slug = window.__decartModelSlug || null;
      window.__decartTrack('moderation_' + kind, props);
    }
    updatePanel();
  }

  // ── WebSocket hook ─────────────────────────────────────────────────────────
  var NativeWS = window.WebSocket;

  function hasGarment(msg) {
    if (msg.image_ref) return true;
    var d = msg.image_data;
    return typeof d === 'string' && d !== '' && d !== 'null';
  }

  // ── Server-side NSFW enforcement (?nsfw_threshold=) ────────────────────────
  // Sent on EVERY session. Not a visitor or merchant choice — there is no toggle
  // and no consent gate; the api calls this a per-session "opt-in" only in the
  // sense that the client is the side that enables the lane.
  //
  // Sending the param IS the switch: bouncer/src/realtime/stream.py validates it
  // (finite, in [0,1]) and forwards it to the pod, where it selects the local
  // NSFW lane in kv-reset mode for this session alone. A rejected value does not
  // fail the session - it falls back to GHOST mode, where the pod still detects
  // and still notifies but nothing acts, so keep the value inside the range.
  //
  // Only the Decart signaling socket takes it. LiveKit's media socket is created
  // through the same patched constructor but speaks a different endpoint, so it
  // is matched out by path rather than being handed a stray param.
  var paramLogged = false;
  function withNsfwThreshold(url) {
    if (NSFW_THRESHOLD == null) return url;
    var s = String(url);
    if (s.indexOf('/v1/stream') === -1) return url;        // not the signaling socket
    if (/[?&]nsfw_threshold=/.test(s)) return url;         // already carried
    var out = s + (s.indexOf('?') === -1 ? '?' : '&') +
              'nsfw_threshold=' + encodeURIComponent(NSFW_THRESHOLD);
    if (!paramLogged) {
      paramLogged = true;
      record('nsfw_optin_sent', { threshold: NSFW_THRESHOLD, server_side: SERVER_SIDE });
    }
    return out;
  }

  function HookedWS(url, protocols) {
    var target = withNsfwThreshold(url);
    var ws = protocols !== undefined ? new NativeWS(target, protocols) : new NativeWS(target);

    var origSend = ws.send;
    ws.send = function (data) {
      try {
        if (!replaying && typeof data === 'string' && data.charAt(0) === '{') {
          var msg = JSON.parse(data);
          if (msg.type === 'set_image' && hasGarment(msg)) {
            lastSetImage = msg;
            referenceSentAt = Date.now();
            trackSocket(ws);
            updatePanel();
          }
        }
      } catch (e) { /* non-JSON frame, ignore */ }
      return origSend.call(this, data);
    };

    // Additive listener: the SDK sets ws.onmessage, which still fires.
    // LiveKit's socket is hooked too but speaks binary protobuf, so the
    // string/'{' guard skips it for free. The Anywear widget the later
    // onboarding step loads runs in a cross-origin iframe with its own
    // window.WebSocket, so its sockets never reach this hook.
    ws.addEventListener('message', function (ev) {
      if (typeof ev.data !== 'string' || ev.data.charAt(0) !== '{') return;
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      if (m.type === 'content_flag') {
        trackSocket(ws);
        onContentFlag(m, ws);
      } else if (m.type === 'set_image_ack') {
        noteReferenceApplied();
      }
    });

    return ws;
  }
  HookedWS.prototype = NativeWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) {
    HookedWS[k] = NativeWS[k];
  });
  window.WebSocket = HookedWS;

  function trackSocket(ws) {
    if (sockets.indexOf(ws) !== -1) return;
    sockets.push(ws);
    ws.addEventListener('close', function () {
      var i = sockets.indexOf(ws);
      if (i >= 0) sockets.splice(i, 1);
      // The page can start a fresh session in the same document (back-nav, tab
      // hide then return), so counters are per-session: summarise and clear once
      // the last signaling socket goes.
      if (!liveSocket()) {
        if (flagCount || resetCount) finalizeSession();
        resetSessionState();
      }
      updatePanel();
    });
  }

  function liveSocket() {
    for (var i = sockets.length - 1; i >= 0; i--) {
      if (sockets[i].readyState === NativeWS.OPEN) return sockets[i];
    }
    return null;
  }

  // Every set_image_ack means the server has taken a new reference, and the pod
  // applies it at its next chunk boundary, so its output (and the freshly wiped
  // KV cache) go live RESET_APPLY_MS later. This replaces the extension's
  // #shimmer MutationObserver, which does not exist on this page and only ever
  // saw the user's own garment picks; the ack covers rotations and our own
  // resets too. waitForResetComplete keeps its own assignment for the case this
  // one cannot see: a reset whose ack never arrives.
  function noteReferenceApplied() {
    setTimeout(function () { referenceLiveAt = Date.now(); }, RESET_APPLY_MS);
  }

  // ── Garment perturbation ───────────────────────────────────────────────────
  function garmentSource(msg) {
    // Normal path: the SDK base64-encodes whatever was handed to setImage()
    // (a URL string is fetched and encoded client-side), so image_data is set.
    if (msg && msg.image_data) return Promise.resolve('data:image/*;base64,' + msg.image_data);

    // image_ref is an opaque server file-ref id, not a URL. Fall back to the
    // garment URL the page published: same garment, different bytes, which still
    // guarantees the reference change we need. Same-origin here (/tryon_assets),
    // so no CORS involved.
    var ref = msg && msg.image_ref;
    var url = (typeof ref === 'string' && /^https?:\/\//.test(ref))
      ? ref
      : window.__decartProductImageUrl;
    if (!url) return Promise.reject(new Error('no garment source available'));

    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('garment fetch ' + r.status);
        return r.blob();
      })
      .then(function (b) { return URL.createObjectURL(b); });
  }

  function loadBaseCanvas(msg) {
    var key = (msg && (msg.image_data || msg.image_ref)) || window.__decartProductImageUrl;
    if (baseCanvas && baseKey === key) return Promise.resolve(baseCanvas);
    return garmentSource(msg).then(function (src) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          baseCanvas = c;
          baseKey = key;
          resolve(c);
        };
        img.onerror = function () { reject(new Error('garment decode failed')); };
        img.src = src;
      });
    });
  }

  function perturbedImageData(canvas, on) {
    var c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    var ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    var block = ctx.getImageData(0, 0, 8, 8);
    for (var i = 0; i < block.data.length; i += 4) {
      block.data[i + 2] = (block.data[i + 2] & ~7) | (on ? 2 : 5);
      block.data[i + 3] = 255;
    }
    ctx.putImageData(block, 0, 0);
    // PNG is lossless, so the low-bit tweak survives encoding. JPEG would not.
    return c.toDataURL('image/png').split(',')[1];
  }

  // ── Ack plumbing ───────────────────────────────────────────────────────────
  function awaitAck(ws, ackType, timeoutMs, done) {
    var settled = false;
    function finish(msg) {
      if (settled) return;
      settled = true;
      ws.removeEventListener('message', onMsg);
      clearTimeout(timer);
      done(msg);
    }
    function onMsg(ev) {
      if (typeof ev.data !== 'string' || ev.data.charAt(0) !== '{') return;
      try {
        var m = JSON.parse(ev.data);
        if (m && m.type === ackType) finish(m);
      } catch (e) { /* ignore */ }
    }
    var timer = setTimeout(function () { finish(null); }, timeoutMs);
    ws.addEventListener('message', onMsg);
  }

  function send(ws, msg) {
    replaying = true;
    try { ws.send(JSON.stringify(msg)); } finally { replaying = false; }
  }

  // ── Flag handling ──────────────────────────────────────────────────────────
  function onContentFlag(msg, ws) {
    // phase:'cleared' is the pod closing its own reset window (server blur
    // dropped, its detector re-armed) — the companion notify that ships with
    // the server-side lane. It is NOT a new flag: counting it as one would
    // inflate flag_n and, on the client ladder, spend a retry on an all-clear.
    if (msg.phase === 'cleared') {
      record('server_cleared', {
        mode: msg.mode || null,
        direction: msg.direction || null,
        // THE measurement: how long the pod's reset window actually lasted,
        // i.e. how long the user sat behind the server blur. The pod aims for
        // NSFW_RESET_SETTLE_S (1s) but ends early at the first new-epoch frame,
        // so the real number is only observable from here. null when no flag
        // preceded it this session (socket hooked mid-incident).
        ms_flag_to_cleared: lastFlagAt ? Date.now() - lastFlagAt : null,
        // Both ends of the interval, so the pair is readable on its own without
        // joining back to the flag event. record() stamps the cleared end as
        // at_ms / session_ms already, so only the flag end needs carrying.
        flag_at_ms: lastFlagAtMs,
        paired_flag_n: lastFlagAt ? lastFlagN : null,
      });
      flagCleared = true;
      return;
    }

    flagCount++;
    var sinceReset = lastResetAt ? Date.now() - lastResetAt : null;
    var settling = Date.now() < settleUntil;
    // A flag arriving while the previous one never cleared means the pod did
    // not recover that incident — it flagged again, or it cut. Distinguishing
    // that from a clean flag→cleared cycle is the whole point of the pairing.
    var prevCleared = lastFlagAt ? flagCleared : null;

    record('flag', {
      mode: msg.mode || null,
      phase: msg.phase || null,
      previous_flag_cleared: prevCleared,
      ms_since_previous_flag: lastFlagAt ? Date.now() - lastFlagAt : null,
      direction: msg.direction || null,
      score: msg.score != null ? msg.score : null,
      streak: msg.streak != null ? msg.streak : null,
      frame_time_from_start_s: msg.frame_time_from_start_s != null ? msg.frame_time_from_start_s : null,
      ms_since_reset: sinceReset,
      attributed_to_previous_reset: settling,
    });

    // Arm the pairing AFTER the record above, so that event still reports the
    // gap to the PREVIOUS flag rather than zero against itself.
    lastFlagAt = Date.now();
    lastFlagAtMs = lastFlagAt - sessionT0;
    lastFlagN = flagCount;
    flagCleared = false;

    // ── Server-side enforcement: the pod owns the response ────────────────────
    // We sent ?nsfw_threshold=, so this session's NSFW lane runs in kv-reset
    // mode ON THE POD: it wipes the KV cache itself, burns a blur into the
    // output, re-arms its detector and keeps the stream running, then sends the
    // phase:'cleared' notify handled above when the blur drops. That is this
    // module's entire ladder, moved server-side — so run none of it here.
    //
    // Not merely redundant, actively harmful: our reset is a reference-image
    // change, which starts a NEW condition epoch. Landing one inside the pod's
    // post-reset grace window is exactly the case the pod reads as "the new
    // conditions are themselves flagrant" and cuts the session for. Logging and
    // getting out of the way is the correct client behaviour.
    //
    // The pod can still cut — an early flag, an exhausted reset budget, or a
    // failed reset — but that arrives as its own terminal violation and socket
    // close, which the page's normal session-end path already handles. We do
    // not pre-empt it from here.
    if (SERVER_SIDE) {
      // mode is the pod's declared response to THIS flag. 'reset'/'enforce'
      // mean it is acting. 'ghost' means it is only logging — enforcement did
      // not take (pod on an image without the lane, or the bouncer dropped an
      // out-of-range threshold), so nobody is handling this flag. Worth a loud
      // record: the stream keeps playing flagged output and looks perfectly fine.
      if (msg.mode && msg.mode !== 'reset' && msg.mode !== 'enforce') {
        record('server_side_inactive', {
          mode: msg.mode,
          threshold_sent: NSFW_THRESHOLD,
        });
      }
      return;
    }

    // A KV reset rewinds the model's memory of its own OUTPUT. An input-side
    // flag is about the camera feed, which no reset can fix.
    if (OUTPUT_FLAGS_ONLY && msg.direction && msg.direction !== 'output') {
      record('reset_skipped', { reason: 'non-output flag', direction: msg.direction });
      return;
    }

    // Frames generated before the reset landed on a chunk boundary can still
    // latch the freshly re-armed detector. Same incident, not a failed
    // reset-attempt failure, so do not spend a retry on it.
    if (settling) {
      record('reset_skipped', { reason: 'within reset settle window', ms_since_reset: sinceReset });
      return;
    }

    if (gaveUp) {
      record('reset_skipped', { reason: 'already gave up' });
      return;
    }

    // Flagged straight out of an empty cache, so a reset has nothing to clear:
    // the item is the problem, not accumulated drift. Cut instead of retrying.
    var sinceLive = referenceLiveAt
      ? Date.now() - referenceLiveAt
      : (referenceSentAt ? Date.now() - referenceSentAt : null);
    if (sinceLive !== null && sinceLive < FRESH_CACHE_MS) {
      record('fresh_cache_flag', {
        ms_since_reference_live: sinceLive,
        measured_from: referenceLiveAt ? 'output_live' : 'set_image_sent',
        threshold_ms: FRESH_CACHE_MS,
      });
      giveUp('fresh-cache flag: moderation from an already-empty cache, reset cannot help',
             'unsupported');
      return;
    }

    if (resetCount >= MAX_RESETS) {
      giveUp('retry cap reached');
      return;
    }

    doReset(ws && ws.readyState === NativeWS.OPEN ? ws : liveSocket(), 'content_flag');
  }

  function doReset(ws, trigger) {
    if (busy) {
      record('reset_skipped', { reason: 'reset already in flight' });
      return;
    }
    if (!ws) {
      record('reset_skipped', { reason: 'no open signaling socket' });
      return;
    }
    if (!lastSetImage && !window.__decartProductImageUrl) {
      record('reset_skipped', { reason: 'no garment captured yet' });
      return;
    }

    busy = true;
    loadBaseCanvas(lastSetImage).then(function (canvas) {
      variantOn = !variantOn;
      var replay = { type: 'set_image', image_data: perturbedImageData(canvas, variantOn) };

      if (RESET_WITH_ENHANCE) {
        // Verbatim replay of the page's own message, so the server treats it as
        // a real garment pick and reproduces the same prompt state. This page
        // calls setImage(url) with no options, so there is normally no prompt
        // and no enhance flag to carry. Copying them when present keeps the
        // replay verbatim rather than assuming that stays true.
        if (lastSetImage && typeof lastSetImage.prompt === 'string') replay.prompt = lastSetImage.prompt;
        if (lastSetImage && lastSetImage.enhance_prompt !== undefined) replay.enhance_prompt = lastSetImage.enhance_prompt;
      } else {
        // NO prompt field: the pod's `if prompt:` check then leaves the live
        // prompt alone. enhance_prompt:false keeps the bouncer from writing a
        // new one.
        replay.enhance_prompt = false;
      }

      resetCount++;
      lastResetAt = Date.now();
      settleUntil = lastResetAt + RESET_SETTLE_MS;
      record('reset_sent', {
        trigger: trigger,
        mode: RESET_WITH_ENHANCE ? 'enhance' : 'pure',
        variant: variantOn ? 'A' : 'B',
        of_max: isFinite(MAX_RESETS) ? MAX_RESETS : 'unlimited',
      });
      showResetNotice();

      awaitAck(ws, 'set_image_ack', SET_IMAGE_ACK_TIMEOUT, function (ack) {
        // The server has the new reference now, so restart the settle window
        // from here: the frames still in flight were generated before it.
        if (ack) settleUntil = Date.now() + RESET_SETTLE_MS;
        record('reset_ack', {
          acked: !!ack,
          success: ack ? ack.success !== false : null,
          error: (ack && ack.error) || null,
        });
        // The ack only means ACCEPTED. Until the next chunk boundary the stream
        // still shows the flagged frames, so hold the blur until then (onLive)
        // and re-arm a grace period later (done). Runs even without an ack: a
        // detector left latched blinds the rest of the session.
        waitForResetComplete(
          function (how) {
            record('reset_complete', { after: how });
            if (REARM_DETECTOR) doRearm(ws, how);
          },
          function () { hideResetNotice(); }
        );
      });

      send(ws, replay);
      busy = false;
    }).catch(function (err) {
      busy = false;
      hideResetNotice(true);
      record('reset_failed', { error: String(err && err.message ? err.message : err) });
    });
  }

  // ── Re-arm ─────────────────────────────────────────────────────────────────
  // Re-arm only once the reset has landed, so any later flag is a real failure
  // of that reset rather than a pre-reset frame still in flight.
  //
  // The pod applies a changed reference at its next chunk boundary, so
  // "complete" is modelled as ack + RESET_APPLY_MS. onLive fires then (release
  // the blur), done fires REARM_GRACE_MS later (re-arm).
  function waitForResetComplete(done, onLive) {
    setTimeout(function () {
      // Our own reset is a reference change, so this is when the cache was last
      // wiped. noteReferenceApplied already covers the acked case; this also
      // covers a reset whose ack never arrived, without which the fresh-cache
      // rule would read a post-reset flag as drift.
      referenceLiveAt = Date.now();
      if (onLive) { try { onLive('post_ack_apply'); } catch (e) {} }
      setTimeout(function () { done('post_ack_apply'); }, REARM_GRACE_MS);
    }, RESET_APPLY_MS);
  }

  function doRearm(ws, how) {
    if (ws.readyState !== NativeWS.OPEN) {
      record('rearm_skipped', { reason: 'socket closed', after: how });
      return;
    }
    // Close the settle window here: past this point every flag is about
    // post-reset output, and leaving it open would swallow the first real one.
    settleUntil = 0;

    record('rearm_sent', { after: how });
    awaitAck(ws, 'set_detector_scoring_ack', REARM_ACK_TIMEOUT, function (ack) {
      rearmAcked = ack ? ack.applied !== false : null;
      record('rearm_ack', {
        acked: !!ack,
        enabled: ack ? ack.enabled : null,
        applied: ack ? ack.applied : null,
        // The toggle is live in production as of Jul 2026. A missing ack now
        // means something is wrong (pool without the detector toggle, or an
        // older image on that pod), not the expected case it once was.
        stack: ack ? 'toggle applied' : 'NO ACK - toggle not honoured on this pod',
      });
    });
    send(ws, { type: 'set_detector_scoring', enabled: true });
  }

  // ── Reset notice ───────────────────────────────────────────────────────────
  // Shown while a reset is in flight. The reset is visible either way (the first
  // post-reset chunk re-rolls, so the stream jumps), and the blur covers it.
  // Wording never mentions moderation: do not accuse the user.
  var noticeEl = null;
  var noticeTimers = [];
  var noticeShownAt = 0;   // for the anti-flash floor in hideResetNotice
  var keyframesInjected = false;

  function videoEl()     { return document.querySelector(VIDEO_SELECTOR); }
  function containerEl() { return document.querySelector(CONTAINER_SELECTOR) || document.body; }

  // The extension reuses widget.html's global @keyframes spin. This page has no
  // spin animation, so carry our own and stay a drop-in file.
  function injectKeyframes() {
    if (keyframesInjected) return;
    keyframesInjected = true;
    var s = document.createElement('style');
    s.textContent = '@keyframes __decart-mra-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  function clearNoticeTimers() {
    for (var i = 0; i < noticeTimers.length; i++) clearTimeout(noticeTimers[i]);
    noticeTimers = [];
  }

  function showResetNotice() {
    if (!RESET_MESSAGE_ENABLED || noticeEl) return;
    injectKeyframes();

    var video = videoEl();
    if (video && RESET_MESSAGE_BLUR) {
      video.style.transition = 'filter ' + RESET_MESSAGE_FADE_MS + 'ms ease';
      video.style.filter = 'blur(14px) brightness(0.62)';
    }

    var el = document.createElement('div');
    el.id = '__decart-reset-notice';
    el.style.cssText = [
      'position:absolute', 'inset:0',
      'z-index:' + NOTICE_Z_INDEX,
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'gap:1.1em', 'padding:0 6%',
      // No scrim: the blurred video is the backdrop, so the stream stays visible.
      'background:transparent',
      'font-family:' + FONT_FAMILY,
      '-webkit-font-smoothing:antialiased',
      'font-size:clamp(12px,1.45vw,19px)',
      'transition:opacity ' + RESET_MESSAGE_FADE_MS + 'ms ease', 'opacity:0',
      'pointer-events:none',
    ].join(';');

    // Sized off vw so it scales with the panel rather than fighting a fixed px
    // size at either end of the layout's range.
    var spinner =
      '<div style="' +
        'width:clamp(34px,5.5vw,64px);height:clamp(34px,5.5vw,64px);' +
        'flex-shrink:0;border-radius:50%;' +
        'border:clamp(3px,0.45vw,5px) solid rgba(255,255,255,0.26);' +
        'border-top-color:rgba(255,255,255,0.92);' +
        'animation:__decart-mra-spin 0.8s linear infinite' +
      '"></div>';

    // Text sits UNDER the spinner. Shadowed rather than boxed, so nothing
    // competes with the spinner for attention.
    //
    // Spinner-only is a supported look: with both strings empty the whole text
    // block is omitted rather than rendered empty, or the flex `gap` would leave
    // the spinner sitting above 1.1em of nothing instead of centred. Wanted where
    // a reset should read as "working on it" with no wording to misread, and
    // where the terminal card's copy would otherwise be a near-duplicate of it.
    var lines = '';
    if (RESET_MESSAGE_TITLE || RESET_MESSAGE_SUBTITLE) {
      lines =
        '<div style="text-align:center;text-shadow:0 1px 12px rgba(0,0,0,0.55)">' +
          (RESET_MESSAGE_TITLE
            ? '<div style="' +
                'font-size:1em;font-weight:400;letter-spacing:0.10em;' +
                'text-transform:uppercase;color:#fff;line-height:1.4' +
              '">' + esc(RESET_MESSAGE_TITLE) + '</div>'
            : '') +
          (RESET_MESSAGE_SUBTITLE
            ? '<div style="' +
                'font-size:0.8em;font-weight:400;letter-spacing:0.14em;' +
                'text-transform:uppercase;color:rgba(255,255,255,0.72);' +
                'line-height:1.4;margin-top:0.35em' +
              '">' + esc(RESET_MESSAGE_SUBTITLE) + '</div>'
            : '') +
        '</div>';
    }

    el.innerHTML = spinner + lines;

    containerEl().appendChild(el);
    noticeEl = el;
    noticeShownAt = Date.now();

    // Fade in on the next frame so the transition actually runs (setting opacity
    // in the same frame as insertion usually skips it). Belt-and-braces: a timer
    // forces opacity to 1 as well, so a throttled or never-firing rAF can never
    // leave the notice stuck invisible at opacity 0. Being silently invisible is
    // the exact failure this notice already had, more than once.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (noticeEl === el) el.style.opacity = '1'; });
    });
    noticeTimers.push(setTimeout(function () {
      if (noticeEl === el) el.style.opacity = '1';
    }, 80));

    // Ceiling: never leave the notice up forever if no ack ever arrives.
    noticeTimers.push(setTimeout(function () {
      hideResetNotice(true);
    }, RESET_MESSAGE_MAX_MS));
  }

  // force=true dismisses immediately, bypassing the target duration. Used when
  // something else takes over the screen (give-up card, step navigation) or when
  // the reset failed outright, so there is nothing left to cover.
  function hideResetNotice(force) {
    var el = noticeEl;
    if (!el) { clearNoticeTimers(); return; }

    // Hold to the target duration, which is a FLOOR rather than a duration: the
    // notice is dismissed at max(target, time-to-ack) and never before the ack,
    // since unblurring earlier would show the pre-reset (flagged) frames again.
    // The floor exists only so a fast ack cannot flash the blur on and off in a
    // few hundred ms, which reads as a glitch rather than a deliberate pause.
    var shownFor = Date.now() - noticeShownAt;
    if (!force && shownFor < RESET_MESSAGE_TARGET_MS) {
      noticeTimers.push(setTimeout(function () { hideResetNotice(); },
                                   RESET_MESSAGE_TARGET_MS - shownFor));
      return;
    }

    clearNoticeTimers();
    noticeEl = null;

    // Only un-blur if the give-up card has not taken over: that path keeps the
    // stream blurred behind its own overlay and must not be undone here.
    if (!gaveUp) releaseVideo();

    el.style.opacity = '0';
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, RESET_MESSAGE_FADE_MS + 40);
  }

  // Drop the inline blur. Also the page's hook for starting a new session after
  // a give-up: nothing else clears it, and a session that begins blurred looks
  // broken with no error on screen.
  function releaseVideo() {
    var video = videoEl();
    if (!video) return;
    video.style.filter = '';
    setTimeout(function () { video.style.transition = ''; }, RESET_MESSAGE_FADE_MS + 40);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Give up ────────────────────────────────────────────────────────────────
  // kind 'unsupported' = flagged from an empty cache, so the item is at fault.
  // Anything else = drifted and survived our resets, a generic failure.
  function giveUp(reason, kind) {
    gaveUp = true;
    // The give-up card takes over; drop the transient notice so they never
    // stack. gaveUp is already true, so this leaves the video blurred for it.
    hideResetNotice(true);
    record('gave_up', {
      reason: reason,
      kind: kind || 'generic',
      resets_spent: resetCount,
      flags_seen: flagCount,
      action: GIVE_UP_ACTION,
    });
    // Route through the page's __decartForceSessionEnd: its teardown is
    // order-dependent (camera tracks, SDK client, the rotation and session
    // timers) and a card without it leaves the stream and the billing running.
    if (GIVE_UP_ACTION === 'end_session' && window.__decartForceSessionEnd) {
      try {
        window.__decartForceSessionEnd('moderation_unrecoverable', {
          title: kind === 'unsupported' ? GIVE_UP_MESSAGE_UNSUPPORTED : GIVE_UP_MESSAGE,
          // "Try more outfits" reads as "try the same thing again", which is
          // wrong when the item is what failed.
          restartLabel: kind === 'unsupported' ? GIVE_UP_RESTART_LABEL_UNSUPPORTED : null,
          kind: kind || 'generic',
        });
        return;
      } catch (err) {
        record('give_up_action_failed', { error: String(err && err.message ? err.message : err) });
      }
    }

    // Reached only on GIVE_UP_ACTION 'report' (measurement runs) or if the page
    // stopped defining the hook, which check.mjs guards. The extension also has
    // an 'overlay' mode; it is deliberately not ported, because it leans on the
    // widget's dressing-error overlay and because a covered stream is still a
    // streaming, billing session. So this path logs and leaves the stream alone,
    // loudly enough to notice in the timeline.
    record('give_up_not_enforced', {
      action: GIVE_UP_ACTION,
      has_session_end_hook: !!window.__decartForceSessionEnd,
    });
  }

  function finalizeSession() {
    // recovered = we reset at least once and the stream stayed clean after the
    // last one. Only trustworthy when the re-arm actually applied; with the old
    // image the detector is latched after flag #1, so absence of further flags
    // proves nothing. rearm_applied carries that caveat into the data.
    //
    // recovered/resets/gave_up describe the CLIENT ladder only. Under
    // SERVER_SIDE_ENFORCEMENT the client never resets, so resetCount is always
    // 0 and recovered would read a misleading constant false — server_side
    // says which regime produced the row, and last_flag_cleared is the
    // server-side equivalent of "recovered": did the pod's own reset land.
    record('session_summary', {
      flags: flagCount,
      resets: resetCount,
      gave_up: gaveUp,
      rearm_applied: rearmAcked,
      recovered: SERVER_SIDE ? null : (resetCount > 0 && !gaveUp),
      server_side: SERVER_SIDE,
      last_flag_cleared: lastFlagAt ? flagCleared : null,
    });
  }
  window.addEventListener('beforeunload', function () {
    if (flagCount || resetCount) finalizeSession();
  });

  // ── Optional debug panel ───────────────────────────────────────────────────
  // Live moderation testing happens with eyes on the video, not on DevTools.
  // Off by default so production behaviour is untouched.
  var panel = null;
  function buildPanel() {
    if (!DEBUG_PANEL || panel) return;
    panel = document.createElement('div');
    panel.id = '__decart-moderation-reset-attempt-panel';
    panel.style.cssText = [
      'position:fixed', 'bottom:12px', 'left:12px', 'z-index:2147483647',
      'width:210px', 'padding:8px 10px', 'border-radius:10px',
      'background:rgba(0,0,0,0.72)', 'color:#fff',
      'font:11px/1.5 -apple-system,BlinkMacSystemFont,sans-serif',
      'box-shadow:0 2px 10px rgba(0,0,0,0.4)', 'pointer-events:none',
      'white-space:pre',
    ].join(';');
    document.body.appendChild(panel);
    updatePanel();
  }
  function updatePanel() {
    if (!panel) return;
    panel.textContent = [
      'Moderation reset attempt',
      'garment  ' + (lastSetImage || window.__decartProductImageUrl ? 'captured' : 'waiting'),
      'session  ' + (liveSocket() ? 'live' : 'idle'),
      'flags    ' + flagCount,
      'resets   ' + resetCount + '/' + MAX_RESETS,
      're-arm   ' + (rearmAcked === null ? 'no ack yet' : rearmAcked ? 'applied' : 'refused'),
      gaveUp ? 'GAVE UP' : '',
    ].filter(Boolean).join('\n');
  }
  if (DEBUG_PANEL) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildPanel);
    } else {
      buildPanel();
    }
  }

  // ── Runtime tuning ─────────────────────────────────────────────────────────
  // Each entry assigns to the closure variable the rest of the file reads, so a
  // change takes effect on the very next flag. Keyed by the config.js names.
  var TUNABLE = {
    MAX_RESETS_PER_SESSION:   function (v) { MAX_RESETS = v; },
    RESET_WITH_ENHANCEMENT:   function (v) { RESET_WITH_ENHANCE = !!v; },
    REARM_DETECTOR:           function (v) { REARM_DETECTOR = !!v; },
    REARM_GRACE_MS:           function (v) { REARM_GRACE_MS = v; },
    RESET_APPLY_MS:           function (v) { RESET_APPLY_MS = v; },
    RESET_SETTLE_MS:          function (v) { RESET_SETTLE_MS = v; },
    FRESH_CACHE_MS:           function (v) { FRESH_CACHE_MS = v; },
    OUTPUT_FLAGS_ONLY:        function (v) { OUTPUT_FLAGS_ONLY = !!v; },
    GIVE_UP_ACTION:           function (v) { GIVE_UP_ACTION = v; },
    GIVE_UP_MESSAGE:          function (v) { GIVE_UP_MESSAGE = v; },
    GIVE_UP_MESSAGE_UNSUPPORTED: function (v) { GIVE_UP_MESSAGE_UNSUPPORTED = v; },
    GIVE_UP_RESTART_LABEL_UNSUPPORTED: function (v) { GIVE_UP_RESTART_LABEL_UNSUPPORTED = v; },
    RESET_MESSAGE_ENABLED:    function (v) { RESET_MESSAGE_ENABLED = !!v; },
    RESET_MESSAGE_TITLE:      function (v) { RESET_MESSAGE_TITLE = v; },
    RESET_MESSAGE_SUBTITLE:   function (v) { RESET_MESSAGE_SUBTITLE = v; },
    RESET_MESSAGE_BLUR:       function (v) { RESET_MESSAGE_BLUR = !!v; },
    RESET_MESSAGE_TARGET_MS:  function (v) { RESET_MESSAGE_TARGET_MS = v; },
    RESET_MESSAGE_FADE_MS:    function (v) { RESET_MESSAGE_FADE_MS = v; },
  };

  // Keys whose value must be a finite number, so a typo like {MAX_RESETS_PER_SESSION:'5'}
  // is rejected loudly instead of silently making `resetCount >= '5'` compare as
  // a string.
  var NUMERIC = {
    MAX_RESETS_PER_SESSION: 1, REARM_GRACE_MS: 1, RESET_APPLY_MS: 1,
    RESET_SETTLE_MS: 1, FRESH_CACHE_MS: 1,
    RESET_MESSAGE_TARGET_MS: 1, RESET_MESSAGE_FADE_MS: 1,
  };

  function settings() {
    return {
      MAX_RESETS_PER_SESSION: MAX_RESETS,
      RESET_WITH_ENHANCEMENT: RESET_WITH_ENHANCE,
      REARM_DETECTOR: REARM_DETECTOR,
      REARM_GRACE_MS: REARM_GRACE_MS,
      RESET_APPLY_MS: RESET_APPLY_MS,
      RESET_SETTLE_MS: RESET_SETTLE_MS,
      FRESH_CACHE_MS: FRESH_CACHE_MS,
      OUTPUT_FLAGS_ONLY: OUTPUT_FLAGS_ONLY,
      GIVE_UP_ACTION: GIVE_UP_ACTION,
      GIVE_UP_MESSAGE: GIVE_UP_MESSAGE,
      GIVE_UP_MESSAGE_UNSUPPORTED: GIVE_UP_MESSAGE_UNSUPPORTED,
      RESET_MESSAGE_ENABLED: RESET_MESSAGE_ENABLED,
      RESET_MESSAGE_TARGET_MS: RESET_MESSAGE_TARGET_MS,
      // Live counters, so one call answers "what is set and where am I".
      _state: {
        flags: flagCount, resets: resetCount, gave_up: gaveUp,
        rearm_applied: rearmAcked, resets_left: isFinite(MAX_RESETS) ? Math.max(0, MAX_RESETS - resetCount) : 'unlimited',
      },
    };
  }

  function configure(overrides) {
    var applied = {}, rejected = {};
    for (var k in overrides || {}) {
      if (!Object.prototype.hasOwnProperty.call(overrides, k)) continue;
      var v = overrides[k];
      if (!TUNABLE[k]) { rejected[k] = 'unknown key'; continue; }
      // Infinity is the documented "no limit" idiom in this config, so it must
      // pass for the retry cap.
      var okNum = typeof v === 'number' && v >= 0 && (isFinite(v) || v === Infinity);
      if (NUMERIC[k] && !okNum) {
        rejected[k] = 'expected a number >= 0, got ' + JSON.stringify(v);
        continue;
      }
      TUNABLE[k](v);
      applied[k] = v;
    }
    // Keep the exposed snapshot honest rather than stale.
    if (window.__decartModerationResetAttempt) window.__decartModerationResetAttempt.config = settings();
    record('configured', { applied: applied, rejected: rejected });
    if (Object.keys(rejected).length) console.warn('[moderation-reset-attempt] configure rejected:', rejected);
    return settings();
  }

  // ── Test / inspection API ──────────────────────────────────────────────────
  window.__decartModerationResetAttempt = {
    // Force a reset without needing real flagged content on screen.
    trigger: function () {
      doReset(liveSocket(), 'manual');
    },
    // Synthetic content_flag through the REAL inbound path (listener, guard,
    // parse, handler), so it proves the hook is attached. simulateFlag() below
    // calls the handler directly and proves only the policy logic.
    injectFlag: function (overrides) {
      var ws = liveSocket();
      if (!ws) {
        console.warn('[moderation-reset-attempt] injectFlag: no open signaling socket');
        return false;
      }
      var msg = {
        type: 'content_flag', mode: 'ghost', direction: 'output',
        score: 0.95, streak: 5, frame_time_from_start_s: null,
      };
      for (var k in overrides || {}) msg[k] = overrides[k];
      ws.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(msg) }));
      return true;
    },
    // Simulate a server flag end to end, including the retry cap and give-up.
    simulateFlag: function (overrides) {
      var msg = {
        type: 'content_flag', mode: 'ghost', direction: 'output',
        score: 0.95, streak: 5, frame_time_from_start_s: null,
      };
      for (var k in overrides || {}) msg[k] = overrides[k];
      onContentFlag(msg, liveSocket());
    },
    rearm: function () {
      var ws = liveSocket();
      if (ws) doRearm(ws, 'manual');
    },
    // Preview the on-screen message without touching the stream, for wording and
    // layout review. Auto-dismisses; pass a duration or call hideNotice().
    showNotice: function (ms) {
      showResetNotice();
      noticeTimers.push(setTimeout(function () { hideResetNotice(true); }, ms || 4000));
    },
    hideNotice: function () { hideResetNotice(true); },
    // Called by the page when it starts a fresh session, so a give-up's blur
    // never carries into it.
    releaseVideo: function () { gaveUp = false; releaseVideo(); },
    // "Did it render, and is anything on top of it?" Hit-tests the notice and
    // reports any element covering it in covered_by.
    probeNotice: function () {
      showResetNotice();
      var el = noticeEl;
      if (!el) {
        return { rendered: false, why: 'RESET_MESSAGE_ENABLED is false, or a notice is already up' };
      }
      var card = el.firstChild;
      var prev = el.style.pointerEvents;
      el.style.pointerEvents = 'auto';
      var r = card.getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      el.style.pointerEvents = prev;

      var name = function (n) {
        if (!n) return null;
        return n.id ? '#' + n.id : (n.className ? '.' + String(n.className).split(' ')[0] : n.tagName);
      };
      var out = {
        rendered: true,
        appended_to: name(el.parentNode),
        card_rect: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
        has_size: r.width > 0 && r.height > 0,
        topmost_at_card_centre: name(hit),
        covered_by: (hit && !el.contains(hit)) ? name(hit) : null,
      };
      console.log('[moderation-reset-attempt] probeNotice', out);
      noticeTimers.push(setTimeout(function () { hideResetNotice(true); }, 4000));
      return out;
    },
    report: function () {
      return {
        flags: flagCount,
        resets: resetCount,
        max_resets: MAX_RESETS,
        gave_up: gaveUp,
        rearm_applied: rearmAcked,
        session_live: !!liveSocket(),
        garment_captured: !!(lastSetImage || window.__decartProductImageUrl),
        timeline: timeline.slice(),
      };
    },
    // Live settings, always current (configure() updates this in place).
    config: settings(),

    // Tune mid-session without a reload (a reload costs a session you would have
    // to reproduce). Same key names as the extension's config.js; session-local.
    //   configure({ MAX_RESETS_PER_SESSION: 5 })
    configure: configure,
    settings: settings,
  };

  console.log('[moderation-reset-attempt] armed: max ' + MAX_RESETS + ' resets/session, ' +
              (RESET_WITH_ENHANCE ? 'enhancement ON' : 'enhancement OFF') +
              ', re-arm ' + (REARM_DETECTOR ? 'on' : 'off'));
})();
