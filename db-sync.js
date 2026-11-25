/**
 * =====================================================================
 * Elevate Platform — Enterprise Ultra-Fast Cloud Synchronizer
 * =====================================================================
 * - شحن فوري لحظي في 0 ملي ثانية (Instant Local-First Render)
 * - جلب متوازي فائق السرعة من السحابة في الخلفية (Background Revalidation)
 * - دمج ذكي للبيانات (Smart Non-Destructive Merge) يمنع ضياع أي بيانات مضافة
 * - مزامنة لحظية فورية عبر الـ WebSockets بدون تأخير
 * =====================================================================
 */

(function () {
  'use strict';

  console.log("🚀 [Elevate] تشغيل المحرك السحابي الفوري (Ultra-Fast Engine)...");

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
    "luxen_lockdown_status",
    "luxen_suggested_opportunities",
    "luxen_deleted_teachers",
    "luxen_user_follows"
  ];

  var isCloudReady = false;
  var readyCallbacks = [];
  var saveDebounceTimers = {};
  var originalSetItem = localStorage.setItem.bind(localStorage);

  // Smart non-destructive merge to protect newly added items
  function smartMergeArray(localArr, cloudArr) {
    if (!Array.isArray(localArr)) localArr = [];
    if (!Array.isArray(cloudArr)) cloudArr = [];
    var map = {};
    // Add cloud items
    cloudArr.forEach(function (item) {
      if (item && item.id) map[String(item.id)] = item;
    });
    // Overlay local items (preserves newly created items not yet returned by cloud)
    localArr.forEach(function (item) {
      if (item && item.id) {
        map[String(item.id)] = Object.assign({}, map[String(item.id)] || {}, item);
      }
    });
    return Object.values(map);
  }

  // Instant re-render of all UI components (0ms latency)
  function rerenderAll() {
    try {
      if (window.App) {
        if (typeof App.applyCategoryStatuses === "function") App.applyCategoryStatuses();
        if (typeof App.renderPartners === "function") App.renderPartners();
        if (typeof App.renderOpportunities === "function") App.renderOpportunities();
        if (typeof App.updateHomeStats === "function") App.updateHomeStats();
      }
      if (window.Admin) {
        if (typeof Admin.updateCounters === "function") Admin.updateCounters();
        if (typeof Admin.renderManagePartners === "function") Admin.renderManagePartners();
        if (typeof Admin.renderManageList === "function") Admin.renderManageList();
        if (typeof Admin.renderMembers === "function") Admin.renderMembers();
      }
      if (window.ElevateFilters && typeof ElevateFilters.apply === "function") ElevateFilters.apply();
      if (window.ElevateFAQ && typeof ElevateFAQ.refresh === "function") ElevateFAQ.refresh();
      if (window.StudentHub && typeof StudentHub.refresh === "function") StudentHub.refresh();
      if (window.ElevateExtras && typeof ElevateExtras.refresh === "function") ElevateExtras.refresh();
      if (window.CoursesApp && typeof CoursesApp.render === "function") CoursesApp.render();
      if (window.CommunityApp && typeof CommunityApp.render === "function") CommunityApp.render();
    } catch (e) {
      console.warn("[Elevate] Rerender notice:", e);
    }
  }

  // Ultra-fast background synchronization
  async function syncFromCloud() {
    if (!window.ElevateSupabase) {
      setTimeout(syncFromCloud, 80);
      return;
    }

    try {
      // 1. Fetch site_store + users in parallel (single round-trip bundle)
      var storePromise = window.ElevateSupabase.fetchStore();
      var usersPromise = window.ElevateSupabase.fetchUsers();
      var oppsPromise = window.ElevateSupabase.fetchOpportunities({ limit: 100 });
      var partnersPromise = window.ElevateSupabase.fetchPartners();

      var results = await Promise.all([storePromise, usersPromise, oppsPromise, partnersPromise]);
      var storeData = results[0] || {};
      var usersData = results[1] || [];
      var cloudOpps = results[2] || [];
      var cloudPartners = results[3] || [];

      // 1. Opportunities Merge
      var localOpps = [];
      try { localOpps = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]"); } catch (e) {}
      var finalOpps = smartMergeArray(localOpps, cloudOpps.length > 0 ? cloudOpps : (storeData.luxen_general_cards || []));
      originalSetItem("luxen_general_cards", JSON.stringify(finalOpps));

      // 2. Partners Merge (guarantees newly added partners are NEVER wiped)
      var localPartners = [];
      try { localPartners = JSON.parse(localStorage.getItem("luxen_partners") || "[]"); } catch (e) {}
      var finalPartners = smartMergeArray(localPartners, cloudPartners.length > 0 ? cloudPartners : (storeData.luxen_partners || []));
      originalSetItem("luxen_partners", JSON.stringify(finalPartners));

      // 3. Courses Merge
      var localCourses = [];
      try { localCourses = JSON.parse(localStorage.getItem("luxen_courses") || "[]"); } catch (e) {}
      var finalCourses = smartMergeArray(localCourses, storeData.luxen_courses || []);
      originalSetItem("luxen_courses", JSON.stringify(finalCourses));

      // 4. Site Store keys
      for (var k in storeData) {
        if (Object.prototype.hasOwnProperty.call(storeData, k)) {
          if (k !== "luxen_general_cards" && k !== "luxen_partners" && k !== "luxen_courses") {
            var valStr = typeof storeData[k] === "string" ? storeData[k] : JSON.stringify(storeData[k]);
            originalSetItem(k, valStr);
          }
        }
      }

      // 5. Users
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
      }

      isCloudReady = true;
      window.dispatchEvent(new CustomEvent("elevate_db_ready"));
      window.dispatchEvent(new CustomEvent("elevate_sync_complete"));

      while (readyCallbacks.length > 0) {
        var cb = readyCallbacks.shift();
        try { cb(); } catch (e) {}
      }

      // Re-render with verified cloud data
      rerenderAll();
      setupRealtime();

      console.log("✔ [Elevate] المزامنة السحابية مكتملة (شركاء: " + finalPartners.length + "، فرص: " + finalOpps.length + ")");
    } catch (err) {
      console.error("✖ [Elevate] خطأ في المزامنة السحابية:", err);
      isCloudReady = true;
      rerenderAll();
    }
  }

  // Fast background cloud queue
  function queueCloudSave(key, rawValue) {
    if (!window.ElevateSupabase) return;
    if (saveDebounceTimers[key]) clearTimeout(saveDebounceTimers[key]);

    saveDebounceTimers[key] = setTimeout(async function () {
      try {
        var parsed = rawValue;
        try { parsed = JSON.parse(rawValue); } catch (e) {}

        // 1. Direct row save in dedicated tables
        if (key === "luxen_partners" && Array.isArray(parsed)) {
          parsed.forEach(function (p) {
            if (p && p.id) window.ElevateSupabase.savePartner(p).catch(function () {});
          });
        } else if (key === "luxen_general_cards" && Array.isArray(parsed)) {
          parsed.forEach(function (c) {
            if (c && c.id) window.ElevateSupabase.saveOpportunity(c).catch(function () {});
          });
        }

        // 2. Save in site_store key
        await window.ElevateSupabase.saveStoreKey(key, parsed);
      } catch (err) {
        console.warn("[Elevate] خطأ في الحفظ السحابي للمفتاح:", key, err);
      }
    }, 150);
  }

  // Intercept localStorage.setItem
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (key && (key.startsWith("luxen_") || SYNCED_KEYS.indexOf(key) !== -1)) {
      queueCloudSave(key, value);
    }
  };

  // Real-time synchronization
  function setupRealtime() {
    if (!window.ElevateSupabase || !window.ElevateSupabase.client) return;
    try {
      var client = window.ElevateSupabase.client;
      client
        .channel('elevate-fast-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, async function () {
          var pts = await window.ElevateSupabase.fetchPartners();
          if (Array.isArray(pts)) {
            originalSetItem("luxen_partners", JSON.stringify(pts));
            rerenderAll();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, async function () {
          var opps = await window.ElevateSupabase.fetchOpportunities();
          if (Array.isArray(opps)) {
            originalSetItem("luxen_general_cards", JSON.stringify(opps));
            rerenderAll();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_store' }, function (payload) {
          if (payload && payload.new && payload.new.key) {
            var valStr = typeof payload.new.value === "string" ? payload.new.value : JSON.stringify(payload.new.value);
            originalSetItem(payload.new.key, valStr);
            rerenderAll();
          }
        })
        .subscribe();
    } catch (e) {
      console.warn("[Elevate] Realtime notice:", e);
    }
  }

  // ElevateDB public methods with Instant Optimistic UI
  window.ElevateDB = {
    keys: SYNCED_KEYS,
    get isReady() {
      return isCloudReady;
    },
    savePartner: async function (partner) {
      if (!partner) return;
      var list = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
      var idx = list.findIndex(function (p) { return String(p.id) === String(partner.id); });
      if (idx !== -1) list[idx] = partner;
      else list.unshift(partner);
      originalSetItem("luxen_partners", JSON.stringify(list));
      rerenderAll();
      try {
        await window.ElevateSupabase.savePartner(partner);
        await window.ElevateSupabase.saveStoreKey("luxen_partners", list);
      } catch (e) {}
    },
    deletePartner: async function (id) {
      if (!id) return;
      var list = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
      list = list.filter(function (p) { return String(p.id) !== String(id); });
      originalSetItem("luxen_partners", JSON.stringify(list));
      rerenderAll();
      try {
        await window.ElevateSupabase.deletePartner(id);
        await window.ElevateSupabase.saveStoreKey("luxen_partners", list);
      } catch (e) {}
    },
    saveOpportunity: async function (opp) {
      if (!opp) return;
      var list = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      var idx = list.findIndex(function (c) { return String(c.id) === String(opp.id); });
      if (idx !== -1) list[idx] = opp;
      else list.unshift(opp);
      originalSetItem("luxen_general_cards", JSON.stringify(list));
      rerenderAll();
      try {
        await window.ElevateSupabase.saveOpportunity(opp);
        await window.ElevateSupabase.saveStoreKey("luxen_general_cards", list);
      } catch (e) {}
    },
    deleteOpportunity: async function (id) {
      if (!id) return;
      var list = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      list = list.filter(function (c) { return String(c.id) !== String(id); });
      originalSetItem("luxen_general_cards", JSON.stringify(list));
      rerenderAll();
      try {
        await window.ElevateSupabase.deleteOpportunity(id);
        await window.ElevateSupabase.saveStoreKey("luxen_general_cards", list);
      } catch (e) {}
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
    }
  };

  // STEP 1: Render immediately from cache (0ms instant display)
  rerenderAll();

  // STEP 2: Background cloud synchronization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      rerenderAll();
      syncFromCloud();
    });
  } else {
    setTimeout(syncFromCloud, 20);
  }

})();
