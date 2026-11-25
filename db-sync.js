/**
 * =====================================================================
 * Elevate Platform — Enterprise Cloud Database Synchronizer
 * =====================================================================
 * يربط كافة أجزاء المنصة بقاعدة بيانات Supabase السحابية (PostgreSQL):
 * 1. جلب البيانات المنظمة من الجداول السحابية الحقيقية (opportunities, courses, partners, users)
 * 2. حفظ فوري على مستوى الصفوف (Row-by-Row Cloud Persistence) بدون الاعتماد على التخزين المحلي
 * 3. المزامنة اللحظية الفورية (Real-time WebSockets) بين كافة الأجهزة والمتصفحات
 * 4. توافق تام مع واجهة الموقع ولوحة الإدارة مع أداء فائق وسرعة استجابة فورية
 * =====================================================================
 */

(function () {
  'use strict';

  console.log("🚀 [Elevate] جاري تهيئة محرك قاعدة البيانات السحابية (Supabase PostgreSQL)...");

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
  var previousCardsCache = null;
  var previousPartnersCache = null;
  var previousCoursesCache = null;

  // Intercept localStorage safely to maintain cache and propagate to cloud
  var originalSetItem = localStorage.setItem.bind(localStorage);
  var originalRemoveItem = localStorage.removeItem.bind(localStorage);

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

  // Row-level synchronization for Opportunities
  async function syncOpportunitiesDiff(newCards) {
    if (!window.ElevateSupabase || !Array.isArray(newCards)) return;
    try {
      var prevMap = {};
      if (Array.isArray(previousCardsCache)) {
        previousCardsCache.forEach(function (c) { if (c && c.id) prevMap[c.id] = c; });
      }
      var newMap = {};
      newCards.forEach(function (c) { if (c && c.id) newMap[c.id] = c; });

      // Upsert added/updated cards
      for (var id in newMap) {
        var card = newMap[id];
        var prev = prevMap[id];
        if (!prev || JSON.stringify(card) !== JSON.stringify(prev)) {
          window.ElevateSupabase.saveOpportunity(card).catch(function (e) {
            console.error("✖ فشل حفظ الفرصة في جدول opportunities:", id, e);
          });
        }
      }

      // Delete removed cards
      if (previousCardsCache) {
        for (var pId in prevMap) {
          if (!newMap[pId]) {
            window.ElevateSupabase.deleteOpportunity(pId).catch(function (e) {
              console.error("✖ فشل حذف الفرصة من جدول opportunities:", pId, e);
            });
          }
        }
      }
      previousCardsCache = JSON.parse(JSON.stringify(newCards));
    } catch (e) {
      console.warn("[Elevate] خطأ في مزامنة جدول الفرص:", e);
    }
  }

  // Row-level synchronization for Partners
  async function syncPartnersDiff(newPartners) {
    if (!window.ElevateSupabase || !Array.isArray(newPartners)) return;
    try {
      var prevMap = {};
      if (Array.isArray(previousPartnersCache)) {
        previousPartnersCache.forEach(function (p) { if (p && p.id) prevMap[p.id] = p; });
      }
      var newMap = {};
      newPartners.forEach(function (p) { if (p && p.id) newMap[p.id] = p; });

      for (var id in newMap) {
        var part = newMap[id];
        var prev = prevMap[id];
        if (!prev || JSON.stringify(part) !== JSON.stringify(prev)) {
          window.ElevateSupabase.savePartner(part).catch(function (e) {
            console.error("✖ فشل حفظ الشريك في جدول partners:", id, e);
          });
        }
      }
      if (previousPartnersCache) {
        for (var pId in prevMap) {
          if (!newMap[pId]) {
            window.ElevateSupabase.deletePartner(pId).catch(function (e) {
              console.error("✖ فشل حذف الشريك من جدول partners:", pId, e);
            });
          }
        }
      }
      previousPartnersCache = JSON.parse(JSON.stringify(newPartners));
    } catch (e) {
      console.warn("[Elevate] خطأ في مزامنة جدول الشركاء:", e);
    }
  }

  // Row-level synchronization for Courses
  async function syncCoursesDiff(newCourses) {
    if (!window.ElevateSupabase || !Array.isArray(newCourses)) return;
    try {
      var prevMap = {};
      if (Array.isArray(previousCoursesCache)) {
        previousCoursesCache.forEach(function (c) { if (c && c.id) prevMap[c.id] = c; });
      }
      var newMap = {};
      newCourses.forEach(function (c) { if (c && c.id) newMap[c.id] = c; });

      for (var id in newMap) {
        var crs = newMap[id];
        var prev = prevMap[id];
        if (!prev || JSON.stringify(crs) !== JSON.stringify(prev)) {
          window.ElevateSupabase.saveCourse(crs).catch(function (e) {
            console.error("✖ فشل حفظ الكورس في جدول courses:", id, e);
          });
        }
      }
      if (previousCoursesCache) {
        for (var pId in prevMap) {
          if (!newMap[pId]) {
            window.ElevateSupabase.deleteCourse(pId).catch(function (e) {
              console.error("✖ فشل حذف الكورس من جدول courses:", pId, e);
            });
          }
        }
      }
      previousCoursesCache = JSON.parse(JSON.stringify(newCourses));
    } catch (e) {
      console.warn("[Elevate] خطأ في مزامنة جدول الكورسات:", e);
    }
  }

  // Debounced cloud save for key-value store
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

        // Specialized row-level handlers
        if (key === "luxen_general_cards" && Array.isArray(parsed)) {
          syncOpportunitiesDiff(parsed);
        } else if (key === "luxen_partners" && Array.isArray(parsed)) {
          syncPartnersDiff(parsed);
        } else if (key === "luxen_courses" && Array.isArray(parsed)) {
          syncCoursesDiff(parsed);
        }

        // Always update site_store key as master KV backup
        await window.ElevateSupabase.saveStoreKey(key, parsed);
        console.log("☁ [ElevateSupabase] تم حفظ التعديلات سحابياً للمفتاح:", key);
      } catch (err) {
        console.error("✖ [ElevateSupabase] خطأ في حفظ المفتاح:", key, err);
      }
    }, 250);
  }

  // Intercept localStorage.setItem to auto-sync luxen_* keys to Supabase
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (key && (key.startsWith("luxen_") || SYNCED_KEYS.indexOf(key) !== -1)) {
      queueCloudSave(key, value);
    }
  };

  // Main Cloud Synchronization (Enterprise Hydration)
  async function syncFromCloud() {
    if (!window.ElevateSupabase) {
      console.warn("[Elevate] مكتبة ElevateSupabase غير متوفرة بعد، إعادة المحاولة...");
      setTimeout(syncFromCloud, 100);
      return;
    }

    try {
      console.log("☁ [Supabase] جاري جلب أحدث البيانات المنظمة من السحابة...");

      // Parallel fetch from all dedicated tables + site_store
      var oppsPromise = window.ElevateSupabase.fetchOpportunities();
      var coursesPromise = window.ElevateSupabase.fetchCourses();
      var partnersPromise = window.ElevateSupabase.fetchPartners();
      var usersPromise = window.ElevateSupabase.fetchUsers();
      var storePromise = window.ElevateSupabase.fetchStore();

      var results = await Promise.all([
        oppsPromise,
        coursesPromise,
        partnersPromise,
        usersPromise,
        storePromise
      ]);

      var cloudOpps = results[0];
      var cloudCourses = results[1];
      var cloudPartners = results[2];
      var usersData = results[3];
      var storeData = results[4] || {};

      // 1. Opportunities: Prioritize dedicated opportunities table
      var finalOpps = [];
      if (Array.isArray(cloudOpps) && cloudOpps.length > 0) {
        finalOpps = cloudOpps;
      } else if (Array.isArray(storeData.luxen_general_cards)) {
        finalOpps = storeData.luxen_general_cards;
      }
      originalSetItem("luxen_general_cards", JSON.stringify(finalOpps));
      previousCardsCache = JSON.parse(JSON.stringify(finalOpps));
      console.log("✔ [Supabase] تم تحميل " + finalOpps.length + " فرصة من قاعدة البيانات السحابية");

      // 2. Courses
      var finalCourses = [];
      if (Array.isArray(cloudCourses) && cloudCourses.length > 0) {
        finalCourses = cloudCourses;
      } else if (Array.isArray(storeData.luxen_courses)) {
        finalCourses = storeData.luxen_courses;
      }
      originalSetItem("luxen_courses", JSON.stringify(finalCourses));
      previousCoursesCache = JSON.parse(JSON.stringify(finalCourses));

      // 3. Partners
      var finalPartners = [];
      if (Array.isArray(cloudPartners) && cloudPartners.length > 0) {
        finalPartners = cloudPartners;
      } else if (Array.isArray(storeData.luxen_partners)) {
        finalPartners = storeData.luxen_partners;
      }
      originalSetItem("luxen_partners", JSON.stringify(finalPartners));
      previousPartnersCache = JSON.parse(JSON.stringify(finalPartners));

      // 4. Site Store (settings, lockdown, reactions, counters)
      for (var k in storeData) {
        if (Object.prototype.hasOwnProperty.call(storeData, k)) {
          if (k !== "luxen_general_cards" && k !== "luxen_courses" && k !== "luxen_partners") {
            var valStr = typeof storeData[k] === "string" ? storeData[k] : JSON.stringify(storeData[k]);
            originalSetItem(k, valStr);
          }
        }
      }

      // 5. Users
      if (Array.isArray(usersData)) {
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

      console.log("✔ [Elevate] اكتملت المزامنة السحابية بنجاح!");
      isCloudReady = true;

      // Dispatch completion events
      window.dispatchEvent(new CustomEvent("elevate_db_ready"));
      window.dispatchEvent(new CustomEvent("elevate_sync_complete"));

      while (readyCallbacks.length > 0) {
        var cb = readyCallbacks.shift();
        try { cb(); } catch (e) {}
      }

      rerenderAll();
      setupRealtime();

    } catch (err) {
      console.error("✖ [Elevate] خطأ أثناء المزامنة مع Supabase:", err);
      isCloudReady = true;
      window.dispatchEvent(new CustomEvent("elevate_db_ready"));
      window.dispatchEvent(new CustomEvent("elevate_sync_complete"));
      rerenderAll();
    }
  }

  // Setup Real-time listener across all tables
  function setupRealtime() {
    if (!window.ElevateSupabase || !window.ElevateSupabase.client) return;
    try {
      var client = window.ElevateSupabase.client;
      var channel = client
        .channel('elevate-cloud-enterprise')
        // Opportunities table realtime
        .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, async function () {
          console.log("⚡ [Realtime] تحديث سحابي مباشر لجدول opportunities");
          var opps = await window.ElevateSupabase.fetchOpportunities();
          if (Array.isArray(opps)) {
            originalSetItem("luxen_general_cards", JSON.stringify(opps));
            previousCardsCache = JSON.parse(JSON.stringify(opps));
            rerenderAll();
          }
        })
        // Courses table realtime
        .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, async function () {
          console.log("⚡ [Realtime] تحديث سحابي لجدول courses");
          var crs = await window.ElevateSupabase.fetchCourses();
          if (Array.isArray(crs)) {
            originalSetItem("luxen_courses", JSON.stringify(crs));
            previousCoursesCache = JSON.parse(JSON.stringify(crs));
            rerenderAll();
          }
        })
        // Partners table realtime
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, async function () {
          console.log("⚡ [Realtime] تحديث سحابي لجدول partners");
          var pts = await window.ElevateSupabase.fetchPartners();
          if (Array.isArray(pts)) {
            originalSetItem("luxen_partners", JSON.stringify(pts));
            previousPartnersCache = JSON.parse(JSON.stringify(pts));
            rerenderAll();
          }
        })
        // Site store realtime
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_store' }, function (payload) {
          if (payload && payload.new && payload.new.key) {
            console.log("⚡ [Realtime] تحديث سحابي للمفتاح:", payload.new.key);
            var valStr = typeof payload.new.value === "string" ? payload.new.value : JSON.stringify(payload.new.value);
            originalSetItem(payload.new.key, valStr);
            rerenderAll();
          }
        })
        // Users table realtime
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async function () {
          console.log("⚡ [Realtime] تحديث سحابي لقائمة المستخدمين");
          var users = await window.ElevateSupabase.fetchUsers();
          if (users) {
            originalSetItem("luxen_all_users", JSON.stringify(users));
            rerenderAll();
          }
        })
        .subscribe();

      console.log("✔ [Supabase Realtime] تم تفعيل المزامنة اللحظية الشاملة لكافة الجداول!");
    } catch (e) {
      console.warn("[Elevate] Realtime subscription notice:", e);
    }
  }

  // ElevateDB global object with direct enterprise CRUD methods
  window.ElevateDB = {
    keys: SYNCED_KEYS,
    get isReady() {
      return isCloudReady;
    },

    // Direct Opportunities CRUD
    saveOpportunity: async function (opp) {
      if (!opp) return false;
      var cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      var idx = cards.findIndex(function (c) { return String(c.id) === String(opp.id); });
      if (idx !== -1) {
        cards[idx] = opp;
      } else {
        cards.unshift(opp);
      }
      originalSetItem("luxen_general_cards", JSON.stringify(cards));
      previousCardsCache = JSON.parse(JSON.stringify(cards));
      rerenderAll();

      try {
        await window.ElevateSupabase.saveOpportunity(opp);
        await window.ElevateSupabase.saveStoreKey("luxen_general_cards", cards);
        return true;
      } catch (e) {
        console.error("✖ فشل حفظ الفرصة:", e);
        return false;
      }
    },

    deleteOpportunity: async function (id) {
      if (!id) return false;
      var cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      cards = cards.filter(function (c) { return String(c.id) !== String(id); });
      originalSetItem("luxen_general_cards", JSON.stringify(cards));
      previousCardsCache = JSON.parse(JSON.stringify(cards));
      rerenderAll();

      try {
        await window.ElevateSupabase.deleteOpportunity(id);
        await window.ElevateSupabase.saveStoreKey("luxen_general_cards", cards);
        return true;
      } catch (e) {
        console.error("✖ فشل حذف الفرصة:", e);
        return false;
      }
    },

    // Legacy sync adapters
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

  // Start cloud sync immediately
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromCloud);
  } else {
    setTimeout(syncFromCloud, 10);
  }

})();
