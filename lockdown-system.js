/**
 * =====================================================================
 * Elevate Platform — Platform Lockdown & Maintenance System
 * =====================================================================
 * نظام قفل وتطوير المنصة:
 * - بدء عد تنازلي لمدة 5 دقائق بعد كتابة رمز التأكيد (omarayman)
 * - إطلاق إنذار مرئي وصوتي متطور خلال مدة الـ 5 دقائق
 * - إغلاق المنصة تلقائياً وعرض شاشة الصيانة والتطوير
 * - إتاحة تسجيل الحسابات فقط، لكن يظل الموقع مغلقاً أمام المستخدمين
 * - السماح للمدير العام فقط بالدخول وإلغاء القفل متى شاء
 * - مزامنة فورية كاملة عبر قاعدة بيانات Supabase السحابية
 * =====================================================================
 */

(function (window, document) {
  'use strict';

  var LOCKDOWN_KEY = 'luxen_lockdown_status';
  var DEFAULT_MESSAGE = 'نعمل حالياً على تطوير وتحديث منصة Elevate لإضافة ميزات حصرية وتحسين تجربة الاستخدام. سنعود قريباً جداً!';

  // Default state
  var state = {
    isLocked: false,
    countdownActive: false,
    targetTimestamp: null,
    countdownMinutes: 5,
    startedAt: null,
    scheduledCloseAt: null,
    scheduledOpenAt: null,
    lockedBy: 'OMAR AYMAN',
    message: DEFAULT_MESSAGE
  };

  var audioCtx = null;
  var audioMuted = false;
  var alarmInterval = null;
  var countdownInterval = null;
  var scheduleCounterInterval = null;

  // -------------------------------------------------------------
  // 1. Audio Alarm Synthesizer (Web Audio API - No external files)
  // -------------------------------------------------------------
  function playAlarmBeep() {
    if (audioMuted) return;
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      // Alarm siren sweep: 900Hz -> 450Hz
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      // Audio autoplay policy notice
    }
  }

  function startAlarmSound() {
    if (alarmInterval) clearInterval(alarmInterval);
    playAlarmBeep();
    alarmInterval = setInterval(playAlarmBeep, 2500);
  }

  function stopAlarmSound() {
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
  }

  // -------------------------------------------------------------
  // 2. State & Database Sync
  // -------------------------------------------------------------
  function loadLocalState() {
    try {
      var saved = localStorage.getItem(LOCKDOWN_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        state = Object.assign(state, parsed);
      }
    } catch (e) {}
  }

  async function syncStateFromCloud() {
    if (window.ElevateSupabase && typeof window.ElevateSupabase.fetchStore === 'function') {
      try {
        var store = await window.ElevateSupabase.fetchStore();
        if (store && store[LOCKDOWN_KEY]) {
          state = Object.assign(state, store[LOCKDOWN_KEY]);
          localStorage.setItem(LOCKDOWN_KEY, JSON.stringify(state));
        }
      } catch (e) {
        console.warn('[Lockdown] Cloud sync notice:', e);
      }
    }
    evaluateState();
  }

  async function saveState(newState) {
    state = Object.assign(state, newState);
    var str = JSON.stringify(state);
    localStorage.setItem(LOCKDOWN_KEY, str);

    if (window.ElevateSupabase && typeof window.ElevateSupabase.saveStoreKey === 'function') {
      try {
        await window.ElevateSupabase.saveStoreKey(LOCKDOWN_KEY, state);
        console.log('☁ [Lockdown] تم حفظ حالة قفل المنصة سحابياً في Supabase');
      } catch (e) {
        console.error('✖ [Lockdown] فشل حفظ حالة القفل في Supabase:', e);
      }
    }
    evaluateState();
  }

  // -------------------------------------------------------------
  // 3. User & Page Checks
  // -------------------------------------------------------------
  function isLoginPage() {
    var p = (window.location.pathname || '').toLowerCase();
    return p.includes('login') || (window.location.href || '').toLowerCase().includes('login.html');
  }

  function isCurrentUserAdmin() {
    try {
      var user = JSON.parse(localStorage.getItem('ns_user') || 'null');
      if (!user) return false;
      return Boolean(user.isAdmin || user.is_admin || user.id === 'admin_001' || user.id === 'admin_master_001');
    } catch (e) {
      return false;
    }
  }

  // -------------------------------------------------------------
  // 4. UI Evaluation & Rendering
  // -------------------------------------------------------------
  function evaluateState() {
    var now = Date.now();

    if (state.isLocked && state.scheduledOpenAt && now >= Number(state.scheduledOpenAt)) {
      saveState({
        isLocked: false,
        scheduledOpenAt: null,
        countdownActive: false,
        targetTimestamp: null,
        startedAt: null
      });
      return;
    }

    if (!state.isLocked && state.scheduledCloseAt && now >= Number(state.scheduledCloseAt)) {
      saveState({
        isLocked: true,
        scheduledCloseAt: null,
        countdownActive: false,
        targetTimestamp: null,
        startedAt: null
      });
      return;
    }

    if (!state.isLocked && state.scheduledCloseAt && now < Number(state.scheduledCloseAt)) {
      renderScheduledCloseBanner();
    } else {
      removeScheduledCloseBanner();
    }

    // Check if countdown expired -> turn into locked
    if (state.countdownActive && state.targetTimestamp) {
      if (now >= state.targetTimestamp) {
        state.countdownActive = false;
        state.isLocked = true;
        saveState({ countdownActive: false, isLocked: true });
        return;
      }
    }

    if (state.countdownActive) {
      renderCountdownBanner();
      removeMaintenanceOverlay();
      startAlarmSound();
    } else {
      removeCountdownBanner();
      stopAlarmSound();
    }

    if (state.isLocked) {
      if (isCurrentUserAdmin()) {
        removeMaintenanceOverlay();
        removeLoginMaintenanceNotice();
        renderAdminBypassBar();
      } else if (isLoginPage()) {
        // On login.html, allow users to register or login without full screen overlay
        removeMaintenanceOverlay();
        removeAdminBypassBar();
        renderLoginMaintenanceNotice();
      } else {
        removeAdminBypassBar();
        removeLoginMaintenanceNotice();
        renderMaintenanceOverlay();
      }
    } else {
      removeMaintenanceOverlay();
      removeAdminBypassBar();
      removeLoginMaintenanceNotice();
    }

    // Update Admin Panel UI if visible
    renderAdminSectionUI();
  }

  function renderLoginMaintenanceNotice() {
    var notice = document.getElementById('elevate-login-lockdown-notice');
    if (!notice) {
      var card = document.querySelector('.login-auth-card') || document.querySelector('.login-container');
      if (!card) return;
      notice = document.createElement('div');
      notice.id = 'elevate-login-lockdown-notice';
      notice.style.cssText = [
        'background: rgba(239, 68, 68, 0.15)',
        'border: 1px solid rgba(239, 68, 68, 0.45)',
        'border-radius: 14px',
        'padding: 14px 18px',
        'margin-bottom: 22px',
        'color: #fca5a5',
        'font-family: Cairo, sans-serif',
        'direction: rtl',
        'font-size: 0.92rem',
        'line-height: 1.6',
        'text-align: center'
      ].join(';');
      card.insertBefore(notice, card.firstChild);
    }
    notice.innerHTML = `
      <div style="font-weight:900;color:#f87171;font-size:1.05rem;margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:8px;">
        <i class="fas fa-triangle-exclamation"></i> وضع التطوير والصيانة الإدارية نشط
      </div>
      <div>
        المنصة مغلقة حالياً للتطوير والتحديث. يمكنك <strong>إنشاء حسابك الجديد الآن</strong> ليكون مفعلاً فور فتح المنصة، أو تسجيل الدخول بصلاحيات الإدارة لتجاوز شاشة الصيانة.
      </div>
    `;
  }

  function removeLoginMaintenanceNotice() {
    var notice = document.getElementById('elevate-login-lockdown-notice');
    if (notice) notice.remove();
  }

  // -------------------------------------------------------------
  // 5. Countdown Banner (5 Minutes Warning)
  // -------------------------------------------------------------
  function renderCountdownBanner() {
    var banner = document.getElementById('elevate-lockdown-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'elevate-lockdown-banner';
      banner.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'right: 0',
        'z-index: 9999999',
        'background: linear-gradient(90deg, #991b1b, #dc2626, #b91c1c)',
        'color: #fff',
        'box-shadow: 0 4px 25px rgba(220, 38, 38, 0.6)',
        'padding: 12px 20px',
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'font-family: Cairo, sans-serif',
        'direction: rtl',
        'border-bottom: 3px solid #fef08a',
        'animation: pulseWarning 1.5s infinite alternate'
      ].join(';');

      document.body.prepend(banner);

      // Inject keyframe animation if needed
      if (!document.getElementById('lockdown-keyframes')) {
        var style = document.createElement('style');
        style.id = 'lockdown-keyframes';
        style.innerHTML = `
          @keyframes pulseWarning {
            0% { box-shadow: 0 0 15px rgba(239,68,68,0.7); }
            100% { box-shadow: 0 0 35px rgba(245,158,11,0.9); }
          }
          @keyframes blinkIcon {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.15); }
          }
        `;
        document.head.appendChild(style);
      }
    }

    var remainingMs = Math.max(0, (state.targetTimestamp || Date.now()) - Date.now());
    var totalSeconds = Math.floor(remainingMs / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    var timeStr = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span style="font-size:1.6rem;color:#fef08a;animation:blinkIcon 0.8s infinite;"><i class="fas fa-triangle-exclamation"></i></span>
        <div>
          <strong style="font-size:1.05rem;font-weight:900;letter-spacing:0.3px;">⚠️ إنذار إداري عاجل: سيتم قفل وتطوير المنصة خلال:</strong>
          <span style="background:#000;color:#fbbf24;padding:3px 12px;border-radius:8px;font-family:monospace;font-size:1.35rem;font-weight:900;letter-spacing:2px;margin:0 8px;border:1px solid #f59e0b;display:inline-block;">${timeStr}</span>
          <span style="font-size:0.9rem;color:#fee2e2;">يرجى حفظ أي بيانات قيد الإجراء فوراً.</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button id="lockdown-mute-btn" onclick="window.ElevateLockdown.toggleMute()" 
                style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:6px 14px;border-radius:8px;font-family:inherit;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <i class="fas ${audioMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i> ${audioMuted ? 'تشغيل الصوت' : 'كتم الإنذار'}
        </button>
      </div>
    `;

    // Push body down so banner doesn't cover top navbar
    document.body.style.paddingTop = '60px';

    if (!countdownInterval) {
      countdownInterval = setInterval(function () {
        if (!state.countdownActive) {
          clearInterval(countdownInterval);
          countdownInterval = null;
          return;
        }
        evaluateState();
      }, 1000);
    }
  }

  function removeCountdownBanner() {
    var banner = document.getElementById('elevate-lockdown-banner');
    if (banner) banner.remove();
    document.body.style.paddingTop = '';
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function renderScheduledCloseBanner() {
    var banner = document.getElementById('elevate-scheduled-close-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'elevate-scheduled-close-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999999;background:linear-gradient(90deg,#7c2d12,#c2410c,#9a3412);color:#fff;padding:10px 16px;text-align:center;font-family:Cairo,sans-serif;direction:rtl;box-shadow:0 4px 24px rgba(234,88,12,.45);';
      document.body.prepend(banner);
    }
    banner.innerHTML = '<strong><i class="fas fa-clock"></i> تم جدولة قفل المنصة خلال:</strong> <span id="elevate-scheduled-close-counter" style="background:#020617;color:#fdba74;padding:3px 12px;border-radius:8px;font-family:monospace;font-size:1.15rem;font-weight:900;margin-right:8px;"></span>';
    var counter = document.getElementById('elevate-scheduled-close-counter');
    if (counter) counter.textContent = formatCountdown(Number(state.scheduledCloseAt) - Date.now());
  }

  function removeScheduledCloseBanner() {
    var banner = document.getElementById('elevate-scheduled-close-banner');
    if (banner) banner.remove();
  }

  function formatDateTimeLocal(timestamp) {
    var d = new Date(timestamp);
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function formatCountdown(milliseconds) {
    var seconds = Math.max(0, Math.floor(milliseconds / 1000));
    var days = Math.floor(seconds / 86400);
    seconds %= 86400;
    var hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    var minutes = Math.floor(seconds / 60);
    seconds %= 60;
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return (days ? days + ' يوم · ' : '') + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
  }

  function scheduleClose() {
    var input = document.getElementById('lockdown-schedule-close');
    if (!input || !input.value) return;
    var timestamp = new Date(input.value).getTime();
    if (!timestamp || timestamp <= Date.now()) {
      if (window.App && App.showToast) App.showToast('اختر وقتًا في المستقبل لقفل المنصة.', 'error');
      return;
    }
    saveState({ scheduledCloseAt: timestamp, isLocked: false });
  }

  function scheduleOpen() {
    var input = document.getElementById('lockdown-schedule-open');
    if (!input || !input.value) return;
    var timestamp = new Date(input.value).getTime();
    if (!timestamp || timestamp <= Date.now()) {
      if (window.App && App.showToast) App.showToast('اختر وقتًا في المستقبل لفتح المنصة.', 'error');
      return;
    }
    saveState({ scheduledOpenAt: timestamp });
  }

  function cancelSchedule(kind) {
    var changes = kind === 'open'
      ? { scheduledOpenAt: null }
      : { scheduledCloseAt: null };
    saveState(changes);
  }

  // -------------------------------------------------------------
  // 6. Admin Bypass Bar (Shown only to Admin when platform is locked)
  // -------------------------------------------------------------
  function renderAdminBypassBar() {
    var bar = document.getElementById('elevate-admin-bypass-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'elevate-admin-bypass-bar';
      bar.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'right: 0',
        'z-index: 9999998',
        'background: linear-gradient(90deg, #1e1b4b, #312e81)',
        'color: #c7d2fe',
        'border-bottom: 2px solid #818cf8',
        'padding: 8px 18px',
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'font-family: Cairo, sans-serif',
        'direction: rtl',
        'font-size: 0.9rem'
      ].join(';');
      document.body.prepend(bar);
      document.body.style.paddingTop = '45px';
    }

    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <i class="fas fa-user-shield" style="color:#a5b4fc;font-size:1.1rem;"></i>
        <span><strong>وضع قفل المنصة والصيانة نشط:</strong> أنت تتصفح بصلاحيات المدير العام (الموقع مغلق تماماً أمام الزوار العاديين).</span>
      </div>
      <div>
        <button onclick="window.ElevateLockdown.unlockPlatform()" 
                style="background:#10b981;border:none;color:#fff;padding:5px 14px;border-radius:6px;font-family:inherit;font-weight:700;font-size:0.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          <i class="fas fa-lock-open"></i> فتح المنصة للجميع الآن
        </button>
      </div>
    `;
  }

  function removeAdminBypassBar() {
    var bar = document.getElementById('elevate-admin-bypass-bar');
    if (bar) bar.remove();
    if (!state.countdownActive) {
      document.body.style.paddingTop = '';
    }
  }

  // -------------------------------------------------------------
  // 7. Full-Screen Maintenance Overlay (When Platform is Locked)
  // -------------------------------------------------------------
  function renderMaintenanceOverlay() {
    var overlay = document.getElementById('elevate-maintenance-screen');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'elevate-maintenance-screen';
      overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 10000000',
        'background: #060913',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'padding: 24px',
        'font-family: Cairo, sans-serif',
        'direction: rtl',
        'color: #f8fafc',
        'text-align: center',
        'overflow-y: auto'
      ].join(';');

      overlay.innerHTML = `
        <div style="max-width: 580px; width: 100%; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 28px; padding: 42px 30px; box-shadow: 0 25px 60px rgba(0,0,0,0.85); position: relative; overflow: hidden;">
          
          <!-- Decorative Top Glow -->
          <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg, #38bdf8, #818cf8, #f43f5e);"></div>

          <div style="width: 88px; height: 88px; margin: 0 auto 22px; border-radius: 50%; background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(245,158,11,0.25)); border: 2px solid rgba(245,158,11,0.4); display: flex; align-items: center; justify-content: center; font-size: 38px; color: #fbbf24; box-shadow: 0 0 35px rgba(245,158,11,0.3);">
            <i class="fas fa-screwdriver-wrench"></i>
          </div>

          <div style="display:inline-block;padding:4px 16px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:20px;color:#f87171;font-size:0.85rem;font-weight:800;margin-bottom:14px;">
            <i class="fas fa-shield-halved"></i> وضع التطوير والصيانة الإدارية
          </div>

          <h1 style="margin: 0 0 12px; font-size: 1.85rem; font-weight: 900; color: #fff; line-height: 1.4;">
            منصة Elevate قيد التطوير والتحديث
          </h1>

          <p style="margin: 0 auto 28px; color: #94a3b8; font-size: 1.05rem; line-height: 1.8; max-width: 480px;">
            ${state.message || DEFAULT_MESSAGE}
          </p>
          ${state.scheduledOpenAt ? `
            <div style="margin:-10px auto 22px;padding:12px;border-radius:12px;border:1px solid rgba(16,185,129,.35);background:rgba(16,185,129,.08);color:#34d399;">
              <div style="font-size:.86rem;margin-bottom:6px;">الفتح التلقائي خلال</div>
              <div id="elevate-scheduled-open-counter" style="font-family:monospace;font-size:1.35rem;font-weight:900;">${formatCountdown(Number(state.scheduledOpenAt)-Date.now())}</div>
            </div>
          ` : ''}

          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
            <a href="login.html" 
               style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 800; font-size: 1.05rem; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 8px 20px rgba(37,99,235,0.35); transition: transform 0.2s;">
              <i class="fas fa-arrow-right-to-bracket"></i> تسجيل الدخول / إنشاء حساب
            </a>
            <button onclick="window.location.reload()" 
                    style="background: rgba(30,41,59,0.7); border: 1px solid rgba(148,163,184,0.25); color: #cbd5e1; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <i class="fas fa-rotate"></i> إعادة فحص حالة المنصة
            </button>
          </div>

          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
            <p style="margin:0;font-size:0.85rem;color:#64748b;">
              <i class="fas fa-lock" style="margin-left:6px;color:#38bdf8;"></i>
              إذا كنت أحد مدراء المنصة، يرجى تسجيل الدخول بحساب المدير لتجاوز شاشة الصيانة.
            </p>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
    }
  }

  function removeMaintenanceOverlay() {
    var overlay = document.getElementById('elevate-maintenance-screen');
    if (overlay) overlay.remove();
  }

  // -------------------------------------------------------------
  // 8. Admin Dashboard Section UI
  // -------------------------------------------------------------
  function renderAdminSectionUI() {
    var container = document.getElementById('adm-lockdown-container');
    if (!container) return;

    var badge = document.getElementById('admin-nav-lockdown-badge');
    if (badge) {
      if (state.isLocked) {
        badge.style.display = 'inline-block';
        badge.style.background = '#ef4444';
        badge.textContent = 'مغلقة';
      } else if (state.countdownActive) {
        badge.style.display = 'inline-block';
        badge.style.background = '#f59e0b';
        badge.textContent = 'إنذار';
      } else {
        badge.style.display = 'none';
      }
    }

    var remainingSeconds = 0;
    if (state.countdownActive && state.targetTimestamp) {
      remainingSeconds = Math.max(0, Math.floor((state.targetTimestamp - Date.now()) / 1000));
    }
    var mins = Math.floor(remainingSeconds / 60);
    var secs = remainingSeconds % 60;
    var timeFormatted = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:24px;">
        <!-- Status Card -->
        <div style="background:rgba(15,23,42,0.6);border:1px solid ${state.isLocked ? '#ef4444' : state.countdownActive ? '#f59e0b' : '#10b981'};border-radius:18px;padding:26px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:2rem;color:${state.isLocked ? '#ef4444' : state.countdownActive ? '#f59e0b' : '#10b981'};">
                <i class="fas ${state.isLocked ? 'fa-lock' : state.countdownActive ? 'fa-hourglass-half' : 'fa-lock-open'}"></i>
              </span>
              <div>
                <h3 style="margin:0;font-size:1.3rem;font-weight:900;color:#fff;">
                  حالة المنصة الحالية: 
                  <span style="color:${state.isLocked ? '#f87171' : state.countdownActive ? '#fbbf24' : '#34d399'};">
                    ${state.isLocked ? '🔒 مغلقة في وضع التطوير والصيانة' : state.countdownActive ? '⏳ العد التنازلي للقفل نشط' : '✅ مفتوحة وتعمل بشكل طبيعي للجميع'}
                  </span>
                </h3>
                <p style="margin:4px 0 0;color:#94a3b8;font-size:0.9rem;">
                  ${state.isLocked ? 'الموقع مغلق أمام جميع الزوار والطلاب وتظهر لهم شاشة الصيانة. المدير فقط يمكنه الدخول.' : state.countdownActive ? 'يظهر إنذار مع صوت وصفارة عد تنازلي للزوار ينبههم بقفل الموقع بعد قليل.' : 'الموقع متاح لكافة الزوار والطلاب للتصفح والتقديم.'}
                </p>
              </div>
            </div>
            <span style="padding:6px 16px;border-radius:20px;font-weight:800;font-size:0.88rem;background:${state.isLocked ? 'rgba(239,68,68,0.2)' : state.countdownActive ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'};color:${state.isLocked ? '#f87171' : state.countdownActive ? '#fbbf24' : '#34d399'};border:1px solid currentColor;">
              ${state.isLocked ? 'وضع القفل نشط' : state.countdownActive ? 'إنذار 5 دقائق' : 'مفتوح للعموم'}
            </span>
          </div>

          ${state.countdownActive ? `
            <div style="background:#020617;border:1px solid rgba(245,158,11,0.4);border-radius:14px;padding:18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
              <div>
                <strong style="color:#fbbf24;font-size:1.1rem;display:block;margin-bottom:4px;">⏱️ الوقت المتبقي حتى القفل التام:</strong>
                <span style="color:#94a3b8;font-size:0.88rem;">سيتم تحويل جميع الزوار تلقائياً لشاشة الصيانة بعد انتهاء هذا الوقت.</span>
              </div>
              <div style="font-family:monospace;font-size:2.2rem;font-weight:900;color:#f59e0b;background:#0f172a;padding:4px 20px;border-radius:10px;border:1px solid #f59e0b;">
                ${timeFormatted}
              </div>
            </div>
          ` : ''}

          <!-- Actions -->
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:20px;">
            ${!state.isLocked && !state.countdownActive ? `
              <button onclick="window.ElevateLockdown.promptStartLockdown()" 
                      style="background:linear-gradient(135deg,#dc2626,#991b1b);border:none;border-radius:12px;color:#fff;padding:14px 26px;font-family:inherit;font-weight:900;font-size:1.05rem;cursor:pointer;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 20px rgba(220,38,38,0.4);">
                <i class="fas fa-power-off"></i> قفل المنصة (بدء مهلة 5 دقائق مع إنذار)
              </button>
            ` : ''}

            ${state.countdownActive ? `
              <button onclick="window.ElevateLockdown.cancelCountdown()" 
                      style="background:#475569;border:none;border-radius:12px;color:#fff;padding:14px 26px;font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
                <i class="fas fa-times-circle"></i> إلغاء القفل والعودة للوضع الطبيعي
              </button>
            ` : ''}

            ${state.isLocked ? `
              <button onclick="window.ElevateLockdown.unlockPlatform()" 
                      style="background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:12px;color:#fff;padding:14px 26px;font-family:inherit;font-weight:900;font-size:1.05rem;cursor:pointer;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 20px rgba(16,185,129,0.4);">
                <i class="fas fa-lock-open"></i> فتح المنصة الآن للجميع
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Scheduled Open and Close -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;">
          <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(239,68,68,.25);border-radius:18px;padding:22px;">
            <h4 style="margin:0 0 8px;color:#fff;"><i class="fas fa-lock" style="color:#ef4444;margin-left:8px;"></i>جدولة قفل المنصة</h4>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:.86rem;">سيتم قفل المنصة تلقائياً عند وصول الموعد المحدد.</p>
            <input id="lockdown-schedule-close" type="datetime-local" value="${state.scheduledCloseAt ? formatDateTimeLocal(Number(state.scheduledCloseAt)) : ''}"
              style="width:100%;box-sizing:border-box;background:#020617;border:1px solid rgba(239,68,68,.35);border-radius:10px;color:#fff;padding:11px;font-family:inherit;">
            ${state.scheduledCloseAt ? `<div id="lockdown-close-counter" style="margin-top:10px;color:#fbbf24;font-family:monospace;font-size:1.15rem;font-weight:900;">${formatCountdown(Number(state.scheduledCloseAt)-Date.now())}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button onclick="window.ElevateLockdown.scheduleClose()" style="flex:1;background:#dc2626;border:none;border-radius:9px;color:#fff;padding:10px;font-family:inherit;font-weight:800;">تأكيد الجدولة</button>
              ${state.scheduledCloseAt ? `<button onclick="window.ElevateLockdown.cancelSchedule('close')" style="background:#475569;border:none;border-radius:9px;color:#fff;padding:10px;font-family:inherit;font-weight:700;">إلغاء</button>` : ''}
            </div>
          </div>
          <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(16,185,129,.25);border-radius:18px;border-radius:18px;padding:22px;">
            <h4 style="margin:0 0 8px;color:#fff;"><i class="fas fa-lock-open" style="color:#10b981;margin-left:8px;"></i>جدولة فتح المنصة</h4>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:.86rem;">تفتح المنصة تلقائياً عند الوقت المحدد للجميع.</p>
            <input id="lockdown-schedule-open" type="datetime-local" value="${state.scheduledOpenAt ? formatDateTimeLocal(Number(state.scheduledOpenAt)) : ''}"
              style="width:100%;box-sizing:border-box;background:#020617;border:1px solid rgba(16,185,129,.35);border-radius:10px;color:#fff;padding:11px;font-family:inherit;">
            ${state.scheduledOpenAt ? `<div id="lockdown-open-counter" style="margin-top:10px;color:#34d399;font-family:monospace;font-size:1.15rem;font-weight:900;">${formatCountdown(Number(state.scheduledOpenAt)-Date.now())}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button onclick="window.ElevateLockdown.scheduleOpen()" style="flex:1;background:#059669;border:none;border-radius:9px;color:#fff;padding:10px;font-family:inherit;font-weight:800;">تأكيد الجدولة</button>
              ${state.scheduledOpenAt ? `<button onclick="window.ElevateLockdown.cancelSchedule('open')" style="background:#475569;border:none;border-radius:9px;color:#fff;padding:10px;font-family:inherit;font-weight:700;">إلغاء</button>` : ''}
            </div>
          </div>
        </div>

        <!-- Custom Message Settings Card -->
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:18px;padding:26px;">
          <h4 style="margin:0 0 10px;color:#fff;font-size:1.1rem;font-weight:800;">
            <i class="fas fa-pen-to-square" style="color:#38bdf8;margin-left:8px;"></i>
            رسالة التطوير والصيانة المعروضة للزوار
          </h4>
          <p style="margin:0 0 14px;color:#94a3b8;font-size:0.88rem;">
            هذه الرسالة تظهر في شاشة الصيانة لأي زائر عند قفل المنصة:
          </p>
          <textarea id="lockdown-msg-input" rows="3" 
                    style="width:100%;box-sizing:border-box;background:#020617;border:1px solid rgba(56,189,248,0.25);border-radius:10px;color:#fff;padding:12px;font-family:inherit;font-size:0.95rem;resize:vertical;">${state.message || DEFAULT_MESSAGE}</textarea>
          <div style="margin-top:12px;text-align:left;">
            <button onclick="window.ElevateLockdown.updateMessage()" 
                    style="background:#0284c7;border:none;color:#fff;padding:10px 20px;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
              <i class="fas fa-save"></i> حفظ الرسالة سحابياً
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // 9. Modal for Confirmation: type "omarayman"
  // -------------------------------------------------------------
  function promptStartLockdown() {
    var modal = document.createElement('div');
    modal.id = 'lockdown-confirm-modal';
    modal.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 10000000',
      'background: rgba(0,0,0,0.85)',
      'backdrop-filter: blur(8px)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'padding: 20px',
      'font-family: Cairo, sans-serif',
      'direction: rtl'
    ].join(';');

    modal.innerHTML = `
      <div style="background:#0f172a;border:2px solid #ef4444;border-radius:24px;padding:32px;max-width:440px;width:100%;box-shadow:0 25px 60px rgba(220,38,38,0.4);text-align:center;">
        <div style="width:70px;height:70px;margin:0 auto 18px;border-radius:50%;background:rgba(239,68,68,0.2);border:2px solid #ef4444;display:flex;align-items:center;justify-content:center;font-size:32px;color:#ef4444;">
          <i class="fas fa-triangle-exclamation"></i>
        </div>
        <h2 style="margin:0 0 10px;color:#fff;font-size:1.45rem;font-weight:900;">تأكيد قفل وتطوير المنصة</h2>
        <p style="margin:0 0 18px;color:#94a3b8;font-size:0.92rem;line-height:1.7;">
          لبدء مهلة الـ 5 دقائق مع إطلاق صفارة الإنذار للزوار، يرجى كتابة رمز التأكيد:
          <br>
          <code style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:3px 10px;border-radius:6px;font-weight:900;font-size:1.1rem;display:inline-block;margin-top:6px;">omarayman</code>
        </p>

        <input type="text" id="lockdown-code-input" placeholder="اكتب omarayman هنا" 
               style="width:100%;box-sizing:border-box;padding:12px 16px;background:#020617;border:2px solid rgba(239,68,68,0.5);border-radius:12px;color:#fff;font-size:1.15rem;text-align:center;font-weight:700;margin-bottom:20px;" autofocus>

        <div id="lockdown-code-err" style="color:#f87171;font-size:0.88rem;margin-bottom:12px;display:none;">
          رمز التأكيد غير صحيح! تأكد من كتابة omarayman
        </div>

        <div style="display:flex;gap:12px;">
          <button id="lockdown-confirm-btn" 
                  style="flex:1;background:linear-gradient(135deg,#dc2626,#991b1b);border:none;border-radius:12px;color:#fff;padding:13px;font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer;">
            <i class="fas fa-check"></i> تأكيد وبدء العداد
          </button>
          <button onclick="document.getElementById('lockdown-confirm-modal').remove()" 
                  style="flex:1;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;color:#cbd5e1;padding:13px;font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;">
            إلغاء
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    var input = document.getElementById('lockdown-code-input');
    var btn = document.getElementById('lockdown-confirm-btn');
    var err = document.getElementById('lockdown-code-err');

    setTimeout(function () { input.focus(); }, 100);

    function handleConfirm() {
      var val = (input.value || '').trim();
      if (!val) return;
      btn.disabled = true;
      ElevateSupabase.callAuthGateway('verify_lockdown', { code: val })
        .then(function (res) {
          btn.disabled = false;
          if (res && res.valid) {
            modal.remove();
            startCountdown();
          } else {
            err.style.display = 'block';
            input.style.borderColor = '#ef4444';
            input.focus();
          }
        })
        .catch(function () {
          btn.disabled = false;
          err.style.display = 'block';
        });
    }

    btn.addEventListener('click', handleConfirm);
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') handleConfirm();
    });
  }

  // -------------------------------------------------------------
  // 10. Operations: Start, Cancel, Unlock, Update
  // -------------------------------------------------------------
  function startCountdown() {
    var fiveMinutesMs = 5 * 60 * 1000; // 5 minutes
    var target = Date.now() + fiveMinutesMs;

    saveState({
      isLocked: false,
      countdownActive: true,
      targetTimestamp: target,
      countdownMinutes: 5,
      startedAt: Date.now()
    });

    console.log('🚨 [Lockdown] تم بدء العد التنازلي لمدة 5 دقائق لقفل المنصة!');
    if (window.App && typeof App.showToast === 'function') {
      App.showToast('تم بدء العد التنازلي لقفل المنصة لمدة 5 دقائق مع تشغيل الإنذار!', 'warning');
    }
  }

  function cancelCountdown() {
    saveState({
      countdownActive: false,
      targetTimestamp: null,
      startedAt: null
    });
    stopAlarmSound();
    if (window.App && typeof App.showToast === 'function') {
      App.showToast('تم إلغاء قفل المنصة بنجاح.', 'info');
    }
  }

  function unlockPlatform() {
    saveState({
      isLocked: false,
      countdownActive: false,
      targetTimestamp: null,
      startedAt: null
    });
    stopAlarmSound();
    if (window.App && typeof App.showToast === 'function') {
      App.showToast('تم فتح المنصة للجميع بنجاح!', 'success');
    }
  }

  function updateMessage() {
    var input = document.getElementById('lockdown-msg-input');
    if (!input) return;
    var msg = input.value.trim() || DEFAULT_MESSAGE;
    saveState({ message: msg });
    if (window.App && typeof App.showToast === 'function') {
      App.showToast('تم حفظ رسالة الصيانة سحابياً بنجاح!', 'success');
    }
  }

  function toggleMute() {
    audioMuted = !audioMuted;
    if (audioMuted) {
      stopAlarmSound();
    } else {
      startAlarmSound();
    }
    var btn = document.getElementById('lockdown-mute-btn');
    if (btn) {
      btn.innerHTML = `<i class="fas ${audioMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i> ${audioMuted ? 'تشغيل الصوت' : 'كتم الإنذار'}`;
    }
  }

  function updateScheduleCounters() {
    var closeCounter = document.getElementById('lockdown-close-counter');
    var openCounter = document.getElementById('lockdown-open-counter');
    var publicCloseCounter = document.getElementById('elevate-scheduled-close-counter');
    var publicOpenCounter = document.getElementById('elevate-scheduled-open-counter');
    if (closeCounter && state.scheduledCloseAt) {
      closeCounter.textContent = formatCountdown(Number(state.scheduledCloseAt) - Date.now());
    }
    if (openCounter && state.scheduledOpenAt) {
      openCounter.textContent = formatCountdown(Number(state.scheduledOpenAt) - Date.now());
    }
    if (publicCloseCounter && state.scheduledCloseAt) {
      publicCloseCounter.textContent = formatCountdown(Number(state.scheduledCloseAt) - Date.now());
    }
    if (publicOpenCounter && state.scheduledOpenAt) {
      publicOpenCounter.textContent = formatCountdown(Number(state.scheduledOpenAt) - Date.now());
    }
  }

  // -------------------------------------------------------------
  // 11. Public API
  // -------------------------------------------------------------
  window.ElevateLockdown = {
    getState: function () { return state; },
    promptStartLockdown: promptStartLockdown,
    cancelCountdown: cancelCountdown,
    unlockPlatform: unlockPlatform,
    updateMessage: updateMessage,
    toggleMute: toggleMute,
    scheduleClose: scheduleClose,
    scheduleOpen: scheduleOpen,
    cancelSchedule: cancelSchedule,
    renderAdminSectionUI: renderAdminSectionUI,
    evaluateState: evaluateState,
    syncStateFromCloud: syncStateFromCloud
  };

  // Initial load
  loadLocalState();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      evaluateState();
      syncStateFromCloud();
    });
  } else {
    evaluateState();
    syncStateFromCloud();
  }

  // Poll cloud state periodically (every 10s)
  setInterval(syncStateFromCloud, 10000);
  scheduleCounterInterval = setInterval(updateScheduleCounters, 1000);

})(window, document);
