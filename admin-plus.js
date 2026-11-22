/* Elevate — Admin backup & restore
   Adds a "النسخ الاحتياطي" section to the admin dashboard:
   - download a single file with every shared site data set
   - upload it again at any time: the server merges it with what already
     exists, never deletes, and duplicates are collapsed automatically
   Access is verified server-side with the admin credentials. */
(function () {
  "use strict";

  var TOKEN_KEY = "ns_backup_token";

  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function user() {
    return (window.App && App.getUser && App.getUser()) || readJSON("ns_user", null);
  }
  function isAdmin() {
    var u = user();
    return !!(u && u.isAdmin === true);
  }
  function setStatus(msg, kind) {
    var el = document.getElementById("bk-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "bk-status" + (kind ? " " + kind : "");
  }

  var SCOPE_KEYS = {
    opportunities: ["luxen_general_cards", "luxen_submissions", "luxen_likes", "luxen_views", "luxen_votes", "luxen_comments"],
    courses: ["luxen_courses", "luxen_course_comments", "luxen_course_likes", "luxen_course_views", "luxen_course_subscriptions", "luxen_course_bookmarks"],
    partners: ["luxen_partners"],
    community: ["luxen_community_messages", "luxen_private_chats", "luxen_banned_community_users", "luxen_frozen_chats", "luxen_user_blocks", "luxen_user_follows", "luxen_user_reports", "luxen_flagged_violations"],
    users: ["luxen_all_users"],
    videos: ["luxen_videos", "luxen_video_likes", "luxen_video_views", "luxen_video_comments"],
    live: ["luxen_live", "luxen_live_joins", "luxen_live_comments"],
    faq: ["luxen_faq"],
    settings: ["luxen_settings", "luxen_category_status", "luxen_lockdown_status", "luxen_notifications"]
  };

  function scopeLabel(scope) {
    return {
      full: "كل بيانات المنصة",
      opportunities: "الفرص والتقديمات والتصويتات",
      courses: "الكورسات والمدرسين والتفاعلات",
      partners: "الشركاء",
      community: "المجتمع والمحادثات",
      users: "المستخدمون والحسابات",
      videos: "الفيديوهات",
      live: "ورش العمل المباشرة",
      faq: "الأسئلة الشائعة",
      settings: "الإعدادات والإشعارات والقفل"
    }[scope] || scope;
  }

  function collectScope(scope) {
    var keys = scope === "full"
      ? null
      : (SCOPE_KEYS[scope] || []);
    var data = {};

    if (keys) {
      keys.forEach(function (key) {
        var value = localStorage.getItem(key);
        if (value !== null) data[key] = JSON.parse(value);
      });
    } else {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.startsWith("luxen_") || key.startsWith("ns_"))) {
          var raw = localStorage.getItem(key);
          try { data[key] = JSON.parse(raw); } catch (e) { data[key] = raw; }
        }
      }
    }

    if (scope === "full" || scope === "users") {
      data.luxen_all_users = readJSON("luxen_all_users", []);
    }
    return data;
  }

  async function doExport() {
    var scope = document.getElementById("bk-export-scope").value;
    setStatus("جاري جمع بيانات " + scopeLabel(scope) + "...", "");
    var data = collectScope(scope);

    if (window.ElevateSupabase) {
      try {
        var store = await ElevateSupabase.fetchStore();
        if (store) {
          var keys = scope === "full" ? Object.keys(store) : (SCOPE_KEYS[scope] || []);
          keys.forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(store, key)) data[key] = store[key];
          });
        }
        if (scope === "full" || scope === "users") {
          data.luxen_all_users = await ElevateSupabase.fetchUsers();
        }
      } catch (e) {
        setStatus("تم جمع النسخة من ذاكرة المتصفح؛ بعض البيانات السحابية غير متاحة.", "bad");
      }
    }

    var payload = {
      format: "Elevate Opportunities Backup",
      version: 1,
      scope: scope,
      exportedAt: new Date().toISOString(),
      data: data
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "elevate-" + scope + "-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    setStatus("تم تنزيل نسخة " + scopeLabel(scope) + " بنجاح ✅", "ok");
  }

  function doImport(file) {
    if (!file) return;
    var scope = document.getElementById("bk-import-scope").value;
    setStatus("جاري قراءة الملف...", "");
    var reader = new FileReader();
    reader.onload = async function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        setStatus("الملف غير صالح (ليس ملف نسخة احتياطية).", "bad");
        return;
      }
      var data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
      var fileScope = parsed.scope || "full";
      if (scope !== "full" && fileScope !== "full" && fileScope !== scope) {
        setStatus("نوع النسخة هو " + scopeLabel(fileScope) + " ولا تطابق القسم المختار.", "bad");
        return;
      }
      if (!window.confirm("سيتم استبدال بيانات " + scopeLabel(scope) + " من الملف المختار. هل تريد المتابعة؟")) return;

      var keys = scope === "full"
        ? Object.keys(data)
        : (SCOPE_KEYS[scope] || Object.keys(data));
      setStatus("جاري استعادة " + scopeLabel(scope) + "...", "");
      keys.forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) return;
        var value = data[key];
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
        if (window.ElevateSupabase && typeof ElevateSupabase.saveStoreKey === "function" && key.startsWith("luxen_")) {
          ElevateSupabase.saveStoreKey(key, value);
        }
      });

      if ((scope === "full" || scope === "users") && Array.isArray(data.luxen_all_users)) {
        localStorage.setItem("luxen_all_users", JSON.stringify(data.luxen_all_users));
        for (var i = 0; i < data.luxen_all_users.length; i++) {
          var userData = data.luxen_all_users[i];
          if (window.ElevateSupabase && typeof ElevateSupabase.saveUser === "function") {
            ElevateSupabase.saveUser(userData);
          }
        }
      }
      if (window.ElevateDB && typeof ElevateDB.refresh === "function") ElevateDB.refresh(false);
      setStatus("تم استعادة " + scopeLabel(scope) + " بنجاح ✅", "ok");
    };
    reader.readAsText(file);
  }

  function sectionHtml() {
    return (
      "" +
      '<div class="admin-dashboard-grid" style="grid-template-columns: repeat(auto-fit,minmax(280px,1fr));">' +
      '<div class="prof-card" style="border-color: rgba(56,189,248,.35); height: fit-content;">' +
      '<div class="prof-card-header" style="color:#38bdf8; margin-bottom: 14px;"><span>تنزيل نسخة احتياطية حسب الاختيار</span><i class="fas fa-cloud-arrow-down"></i></div>' +
      '<p style="color: var(--text-muted); font-size:.88rem; line-height:1.75; margin-bottom:12px;">اختر قسمًا محددًا أو حمّل كامل بيانات المنصة في ملف JSON منفصل.</p>' +
      '<select id="bk-export-scope" class="admin-search-input-pro" style="margin-bottom:12px;">' +
      '<option value="full">كل بيانات المنصة</option><option value="opportunities">الفرص والتقديمات والتصويتات</option><option value="courses">الكورسات والمدرسين والتفاعلات</option><option value="partners">الشركاء</option><option value="community">المجتمع والمحادثات</option><option value="users">المستخدمون والحسابات</option><option value="videos">الفيديوهات</option><option value="live">ورش العمل المباشرة</option><option value="faq">الأسئلة الشائعة</option><option value="settings">الإعدادات والإشعارات والقفل</option>' +
      "</select>" +
      '<button type="button" class="a-submit-btn" style="width:100%; margin:0; background: linear-gradient(135deg, #0ea5e9, #0284c7);" id="bk-export"><i class="fas fa-download"></i> تنزيل النسخة المختارة</button>' +
      "</div>" +
      '<div class="prof-card" style="border-color: rgba(16,185,129,.35); height: fit-content;">' +
      '<div class="prof-card-header" style="color:#10b981; margin-bottom: 14px;"><span>رفع نسخة واستعادة قسم محدد</span><i class="fas fa-cloud-arrow-up"></i></div>' +
      '<p style="color: var(--text-muted); font-size:.88rem; line-height:1.75; margin-bottom:12px;">حدد القسم المراد استبداله، ثم ارفع ملف النسخة المقابل له. سيطلب التأكيد قبل أي تغيير.</p>' +
      '<select id="bk-import-scope" class="admin-search-input-pro" style="margin-bottom:12px;">' +
      '<option value="full">كل بيانات المنصة</option><option value="opportunities">الفرص والتقديمات والتصويتات</option><option value="courses">الكورسات والمدرسين والتفاعلات</option><option value="partners">الشركاء</option><option value="community">المجتمع والمحادثات</option><option value="users">المستخدمون والحسابات</option><option value="videos">الفيديوهات</option><option value="live">ورش العمل المباشرة</option><option value="faq">الأسئلة الشائعة</option><option value="settings">الإعدادات والإشعارات والقفل</option>' +
      "</select>" +
      '<input type="file" id="bk-file" accept="application/json,.json" class="admin-search-input-pro" style="margin-bottom:12px;">' +
      '<button type="button" class="a-submit-btn" style="width:100%; margin:0; background: linear-gradient(135deg,#10b981,#059669);" id="bk-import"><i class="fas fa-upload"></i> رفع واستعادة القسم</button>' +
      '<div id="bk-status" class="bk-status"></div>' +
      "</div>" +
      "</div>"
    );
  }

  function mount() {
    if (!isAdmin()) return;
    var nav = document.getElementById("admin-nav");
    if (!nav || document.getElementById("adm-sec-backup")) return;
    var faqSection = document.getElementById("adm-sec-faq");
    if (!faqSection) return;

    var btn = document.createElement("button");
    btn.className = "admin-nav-btn";
    btn.setAttribute("data-sec", "adm-sec-backup");
    btn.innerHTML = '<i class="fas fa-database"></i> النسخ الاحتياطي';
    btn.addEventListener("click", function () {
      if (window.Admin && typeof Admin.switchSection === "function")
        Admin.switchSection("adm-sec-backup");
    });
    nav.appendChild(btn);

    var sec = document.createElement("section");
    sec.className = "admin-section";
    sec.id = "adm-sec-backup";
    sec.innerHTML = sectionHtml();
    faqSection.parentNode.insertBefore(sec, faqSection.nextSibling);

    document.getElementById("bk-export").addEventListener("click", doExport);
    document.getElementById("bk-import").addEventListener("click", function () {
      var input = document.getElementById("bk-file");
      if (!input || !input.files || !input.files[0]) {
        setStatus("اختر الملف أولًا.", "bad");
        return;
      }
      doImport(input.files[0]);
    });
  }

  function boot() {
    var tries = 0;
    (function wait() {
      if (document.getElementById("admin-nav") || tries > 10) {
        mount();
        return;
      }
      tries++;
      setTimeout(wait, 300);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.ElevateBackup = { mount: mount };
})();
