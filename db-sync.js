/**
 * =====================================================================
 * Elevate Platform — Cloud Database Synchronizer (Supabase PostgreSQL)
 * =====================================================================
 * يقوم بربط كافة أقسام المنصة بقاعدة بيانات Supabase السحابية:
 * 1. جلب أحدث البيانات من السحابة عند فتح أي صفحة
 * 2. الحفظ الفوري المباشر في قاعدة البيانات السحابية عند أي تعديل أو إضافة
 * 3. المزامنة اللحظية (Real-time) بين المستخدمين ولوحة التحكم
 * 4. الاحتفاظ بنسخة ذاكرة محلية سريعة لضمان أفضل سرعة واستجابة
 * =====================================================================
 */

(function () {
  'use strict';

  console.log("🚀 [Elevate] جاري تهيئة الاتصال بقاعدة بيانات Supabase السحابية...");

  var SYNCED_KEYS = [
    "luxen_general_cards",
    "luxen_partners",
    "luxen_comments",
    "luxen_notifications",
    "luxen_courses",
    "luxen_course_comments",
    "luxen_community_messages",
    "luxen_private_chats",
    "luxen_faq",
    "luxen_submissions",
    "luxen_app_installs",
    "luxen_qna",
    "luxen_reset_requests",
    "luxen_course_bookmarks",
    "luxen_course_subscriptions",
    "luxen_likes",
    "luxen_views",
    "luxen_votes",
    "luxen_settings",
    "luxen_category_status",
    "luxen_live_joins",
    "luxen_video_likes",
    "luxen_video_views",
    "luxen_course_likes",
    "luxen_lockdown_status"
  ];

  var isCloudReady = false;
  var readyCallbacks = [];
  var saveDebounceTimers = {};

  // Debounced save to Supabase site_store
  function queueCloudSave(key, rawValue) {
    if (!window.ElevateSupabase) return;
    if (saveDebounceTimers[key]) {
      clearTimeout(saveDebounceTimers[key]);
    }
    saveDebounceTimers[key] = setTimeout(async function () {
      try {
        var parsed = rawValue;
        try {
          parsed = JSON.parse(rawValue);
        } catch (e) {}
        await window.ElevateSupabase.saveStoreKey(key, parsed);
        console.log("☁ [Supabase] تم حفظ التعديلات سحابياً للمفتاح:", key);
      } catch (err) {
        console.error("✖ [Supabase] خطأ في حفظ المفتاح:", key, err);
      }
    }, 300);
  }

  // Intercept localStorage.setItem to auto-sync luxen_* keys to Supabase
  var originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (key && (key.startsWith("luxen_") || SYNCED_KEYS.indexOf(key) !== -1)) {
      queueCloudSave(key, value);
    }
  };

  // Re-render UI components once data arrives
  function rerenderAll() {
    try {
      if (window.App) {
        if (typeof App.applyCategoryStatuses === "function") App.applyCategoryStatuses();
        if (typeof App.renderPartners === "function") App.renderPartners();
        if (typeof App.renderOpportunities === "function") App.renderOpportunities();
        if (typeof App.updateHomeStats === "function") App.updateHomeStats();
      }
      if (window.ElevateFilters && typeof ElevateFilters.apply === "function") ElevateFilters.apply();
      if (window.ElevateFAQ && typeof ElevateFAQ.refresh === "function") ElevateFAQ.refresh();
      if (window.StudentHub && typeof StudentHub.refresh === "function") StudentHub.refresh();
      if (window.ElevateExtras && typeof ElevateExtras.refresh === "function") ElevateExtras.refresh();
      if (window.Admin && typeof Admin.init === "function") Admin.init();
      if (window.CoursesApp && typeof CoursesApp.render === "function") CoursesApp.render();
      if (window.CommunityApp && typeof CommunityApp.render === "function") CommunityApp.render();
    } catch (e) {
      console.warn("[Elevate] Rerender notice:", e);
    }
  }

  // Main Cloud Synchronization
  async function syncFromCloud() {
    if (!window.ElevateSupabase) {
      console.warn("[Elevate] مكتبة ElevateSupabase غير متوفرة بعد، إعادة المحاولة...");
      setTimeout(syncFromCloud, 100);
      return;
    }

    try {
      console.log("☁ [Supabase] جاري جلب أحدث البيانات من قاعدة البيانات السحابية...");

      // 1. Fetch Store (cards, courses, settings, etc.)
      var storeData = await window.ElevateSupabase.fetchStore();
      if (storeData && typeof storeData === "object") {
        for (var k in storeData) {
          if (Object.prototype.hasOwnProperty.call(storeData, k)) {
            var valStr = typeof storeData[k] === "string" ? storeData[k] : JSON.stringify(storeData[k]);
            originalSetItem(k, valStr);
          }
        }
      }

      // 2. Fetch Users
      var usersData = await window.ElevateSupabase.fetchUsers();
      if (Array.isArray(usersData) && usersData.length > 0) {
        var mappedUsers = usersData.map(function (u) {
          return {
            id: u.id,
            username: u.username,
            email: u.email || "",
            phone: u.phone || "",
            fullName: u.full_name || u.username,
            full_name: u.full_name || u.username,
            password_hash: u.password_hash || "",
            passwordHash: u.password_hash || "",
            isAdmin: Boolean(u.is_admin),
            isTeacher: Boolean(u.is_teacher),
            teacherName: u.teacher_name || u.full_name,
            isActive: Boolean(u.is_active),
            isOnline: Boolean(u.is_online),
            provider: u.provider || "credentials",
            googleId: u.google_id || "",
            avatar: u.avatar || "",
            join_date: u.join_date || "",
            join_timestamp: u.join_timestamp || Date.now(),
            last_login: u.last_login || Date.now(),
            metadata: u.metadata || {}
          };
        });
        originalSetItem("luxen_all_users", JSON.stringify(mappedUsers));
        console.log("✔ [Supabase] تم استرجاع " + mappedUsers.length + " مستخدم من قاعدة البيانات السحابية");
      }

      console.log("✔ [Elevate] تمت المزامنة السحابية بنجاح من Supabase!");
      isCloudReady = true;

      // Dispatch events
      window.dispatchEvent(new CustomEvent("elevate_db_ready"));
      window.dispatchEvent(new CustomEvent("elevate_sync_complete"));

      // Trigger queued callbacks
      while (readyCallbacks.length > 0) {
        var cb = readyCallbacks.shift();
        try { cb(); } catch (e) {}
      }

      rerenderAll();

      // Subscribe to real-time changes if official SDK client is connected
      setupRealtime();

    } catch (err) {
      console.error("✖ [Elevate] خطأ أثناء المزامنة مع Supabase:", err);
      // Fallback: trigger ready anyway so UI loads
      isCloudReady = true;
      window.dispatchEvent(new CustomEvent("elevate_db_ready"));
      window.dispatchEvent(new CustomEvent("elevate_sync_complete"));
      rerenderAll();
    }
  }

  // Setup Real-time listener for live updates across clients
  function setupRealtime() {
    if (!window.ElevateSupabase || !window.ElevateSupabase.client) return;
    try {
      var client = window.ElevateSupabase.client;
      var channel = client
        .channel('elevate-cloud-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_store' }, function (payload) {
          if (payload && payload.new && payload.new.key) {
            console.log("⚡ [Realtime] تحديث سحابي مباشر للمفتاح:", payload.new.key);
            var valStr = typeof payload.new.value === "string" ? payload.new.value : JSON.stringify(payload.new.value);
            originalSetItem(payload.new.key, valStr);
            rerenderAll();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async function () {
          console.log("⚡ [Realtime] تحديث سحابي لقائمة المستخدمين");
          var users = await window.ElevateSupabase.fetchUsers();
          if (users) {
            originalSetItem("luxen_all_users", JSON.stringify(users));
            rerenderAll();
          }
        })
        .subscribe();
      console.log("✔ [Supabase Realtime] تم تفعيل المزامنة اللحظية الفورية!");
    } catch (e) {
      console.warn("[Elevate] Realtime subscription notice:", e);
    }
  }

  // ElevateDB global object for full compatibility with existing code
  window.ElevateDB = {
    keys: SYNCED_KEYS,
    get isReady() {
      return isCloudReady;
    },
    syncCards: function (cards) {
      queueCloudSave("luxen_general_cards", cards);
      return Promise.resolve(true);
    },
    syncSettings: function (settings) {
      for (var k in settings) {
        if (Object.prototype.hasOwnProperty.call(settings, k)) {
          queueCloudSave(k, settings[k]);
        }
      }
      return Promise.resolve(true);
    },
    refresh: function () {
      return syncFromCloud();
    },
    onReady: function (fn) {
      if (isCloudReady) {
        try { fn(); } catch (e) {}
      } else {
        readyCallbacks.push(fn);
      }
    },
    ready: new Promise(function (resolve) {
      if (isCloudReady) {
        resolve();
      } else {
        readyCallbacks.push(resolve);
      }
    })
  };

  // Start cloud sync as soon as DOM is ready or after brief tick
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromCloud);
  } else {
    setTimeout(syncFromCloud, 10);
  }

})();
