/**
 * Elevate Platform — Cloud Synchronizer & Realtime Engine
 * - Normalized Postgres tables are the single source of truth.
 * - Zero double-write overwrites on users; personal data & engagements hydrate
 *   cleanly per authenticated user.
 * - Real-time WebSocket updates via Supabase Realtime.
 */
(function () {
  "use strict";

  var SYNCED_STORE_KEYS = [
    "luxen_notifications",
    "luxen_faq",
    "luxen_faq_removed",
    "luxen_settings",
    "luxen_category_status",
    "luxen_contests_visibility",
    "luxen_lockdown_status",
    "elevate_element_visibility",
  ];

  var isCloudReady = false;
  var readyCallbacks = [];
  var originalSetItem = localStorage.setItem.bind(localStorage);

  function rerenderAll() {
    try {
      if (window.App) {
        if (typeof App.applyCategoryStatuses === "function") App.applyCategoryStatuses();
        if (typeof App.renderPartners === "function") App.renderPartners();
        if (typeof App.renderOpportunities === "function") App.renderOpportunities();
        if (typeof App.updateHomeStats === "function") App.updateHomeStats();
        if (typeof App.renderNotifications === "function") App.renderNotifications();
      }
      if (window.Admin) {
        if (typeof Admin.updateCounters === "function") Admin.updateCounters();
        if (typeof Admin.renderManagePartners === "function") Admin.renderManagePartners();
        if (typeof Admin.renderManageList === "function") Admin.renderManageList();
        if (typeof Admin.renderMembers === "function") Admin.renderMembers();
        if (typeof Admin.renderTeam === "function") Admin.renderTeam();
      }
      if (window.ElevateFAQ && typeof ElevateFAQ.refresh === "function") ElevateFAQ.refresh();
      if (window.StudentHub && typeof StudentHub.refresh === "function") StudentHub.refresh();
      if (window.ElevateExtras && typeof ElevateExtras.refresh === "function") ElevateExtras.refresh();
      if (window.CoursesApp && typeof CoursesApp.render === "function") CoursesApp.render();
      if (window.Community && typeof Community.render === "function") Community.render();
      if (window.ElevateResets && typeof ElevateResets.render === "function") ElevateResets.render();
    } catch (e) {
      console.warn("[ElevateDB] Rerender notice:", e);
    }
  }

  function hydrateEngagements(rows) {
    var likes = {};
    var views = {};
    var votes = {};
    var courseLikes = {};
    var videoLikes = {};
    var videoViews = {};
    var liveJoins = {};
    var follows = {};
    var blocks = {};
    var frozen = [];
    var banned = [];
    var installs = [];

    (rows || []).forEach(function (r) {
      if (!r || !r.kind) return;
      if (r.kind === "opp_like") {
        if (!likes[r.item_id]) likes[r.item_id] = [];
        likes[r.item_id].push(r.actor_id);
      } else if (r.kind === "opp_view") {
        if (!views[r.item_id]) views[r.item_id] = [];
        views[r.item_id].push({ u: r.actor_id, n: r.actor_name || "زائر", t: Date.parse(r.created_at) || Date.now() });
      } else if (r.kind === "opp_vote") {
        if (!votes[r.item_id]) votes[r.item_id] = [];
        votes[r.item_id].push({ u: r.actor_id, n: r.actor_name || "زائر", d: (r.created_at || "").slice(0, 10) });
      } else if (r.kind === "course_like") {
        if (!courseLikes[r.item_id]) courseLikes[r.item_id] = [];
        courseLikes[r.item_id].push(r.actor_id);
      } else if (r.kind === "video_like") {
        if (!videoLikes[r.item_id]) videoLikes[r.item_id] = [];
        videoLikes[r.item_id].push(r.actor_id);
      } else if (r.kind === "video_view") {
        if (!videoViews[r.item_id]) videoViews[r.item_id] = [];
        videoViews[r.item_id].push({ u: r.actor_id, n: r.actor_name || "زائر" });
      } else if (r.kind === "live_join") {
        if (!liveJoins[r.item_id]) liveJoins[r.item_id] = [];
        liveJoins[r.item_id].push({ u: r.actor_id, n: r.actor_name || "زائر" });
      } else if (r.kind === "user_follow") {
        if (!follows[r.actor_id]) follows[r.actor_id] = [];
        follows[r.actor_id].push(r.item_id);
      } else if (r.kind === "user_block") {
        if (!blocks[r.actor_id]) blocks[r.actor_id] = [];
        blocks[r.actor_id].push(r.item_id);
      } else if (r.kind === "chat_freeze") {
        frozen.push(r.item_id);
      } else if (r.kind === "user_ban") {
        banned.push(r.item_id);
      } else if (r.kind === "app_install") {
        installs.push({ id: r.actor_id, t: Date.parse(r.created_at) || Date.now() });
      }
    });

    originalSetItem("luxen_likes", JSON.stringify(likes));
    originalSetItem("luxen_views", JSON.stringify(views));
    originalSetItem("luxen_votes", JSON.stringify(votes));
    originalSetItem("luxen_course_likes", JSON.stringify(courseLikes));
    originalSetItem("luxen_video_likes", JSON.stringify(videoLikes));
    originalSetItem("luxen_video_views", JSON.stringify(videoViews));
    originalSetItem("luxen_live_joins", JSON.stringify(liveJoins));
    originalSetItem("luxen_user_follows", JSON.stringify(follows));
    originalSetItem("luxen_user_blocks", JSON.stringify(blocks));
    originalSetItem("luxen_frozen_chats", JSON.stringify(frozen));
    originalSetItem("luxen_banned_community_users", JSON.stringify(banned));
    originalSetItem("luxen_app_installs", JSON.stringify(installs));
  }

  function hydrateComments(rows) {
    var oppComments = [];
    var courseComments = [];
    var videoComments = {};
    var liveComments = {};
    var qna = [];

    (rows || []).forEach(function (c) {
      if (!c) return;
      if (c.scope === "opp") {
        oppComments.push({
          id: c.id,
          cardId: c.item_id,
          username: c.username,
          name: c.display_name,
          text: c.text,
          date: c.date_label || new Date(c.created_at).toLocaleString("ar-EG"),
        });
      } else if (c.scope === "course") {
        courseComments.push({
          id: c.id,
          courseId: c.item_id,
          author: c.display_name || c.username,
          text: c.text,
          time: c.date_label || new Date(c.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        });
      } else if (c.scope === "video") {
        if (!videoComments[c.item_id]) videoComments[c.item_id] = [];
        videoComments[c.item_id].push({ id: c.id, author: c.display_name, text: c.text, date: c.date_label || "" });
      } else if (c.scope === "live") {
        if (!liveComments[c.item_id]) liveComments[c.item_id] = [];
        liveComments[c.item_id].push({ id: c.id, author: c.display_name, text: c.text, date: c.date_label || "" });
      } else if (c.scope === "qna") {
        try {
          var parsed = JSON.parse(c.text);
          qna.push(parsed);
        } catch (e) {
          qna.push({ id: c.id, text: c.text, author: c.display_name, topic: c.item_id, answers: [], date: c.date_label || "" });
        }
      }
    });

    originalSetItem("luxen_comments", JSON.stringify(oppComments));
    originalSetItem("luxen_course_comments", JSON.stringify(courseComments));
    originalSetItem("luxen_video_comments", JSON.stringify(videoComments));
    originalSetItem("luxen_live_comments", JSON.stringify(liveComments));
    if (qna.length) originalSetItem("luxen_qna", JSON.stringify(qna));
  }

  async function syncFromCloud() {
    if (!window.ElevateSupabase) {
      setTimeout(syncFromCloud, 80);
      return;
    }

    try {
      var results = await Promise.all([
        ElevateSupabase.fetchStore(),
        ElevateSupabase.fetchOpportunities({ limit: 200 }),
        ElevateSupabase.fetchCourses(),
        ElevateSupabase.fetchPartners(),
        ElevateSupabase.fetchCommunityMessages(100),
        ElevateSupabase.fetchComments(),
        ElevateSupabase.fetchEngagements(),
        ElevateSupabase.getPublicStats(),
      ]);

      var storeData = results[0] || {};
      var cloudOpps = results[1];
      var cloudCourses = results[2];
      var cloudPartners = results[3];
      var commMsgs = results[4] || [];
      var allComments = results[5] || [];
      var allEngagements = results[6] || [];
      var publicStats = results[7];

      if (Array.isArray(cloudOpps)) {
        originalSetItem("luxen_general_cards", JSON.stringify(cloudOpps));
      }
      if (Array.isArray(cloudCourses)) {
        originalSetItem("luxen_courses", JSON.stringify(cloudCourses));
      }
      if (Array.isArray(cloudPartners)) {
        originalSetItem("luxen_partners", JSON.stringify(cloudPartners));
      }

      if (Array.isArray(commMsgs)) {
        var mappedComm = commMsgs.map(function (m) {
          return {
            id: m.id,
            sender: m.sender_username || m.user_name || "user",
            senderName: m.sender_name || m.user_name || "عضو",
            role: m.role || "member",
            roleTitle: m.role_title || null,
            text: m.content || "",
            type: m.msg_type || "text",
            mediaUrl: m.media_url || null,
            replyTo: m.reply_to || null,
            reactions: m.reactions || {},
            timestamp: m.timestamp || Date.parse(m.created_at) || Date.now(),
          };
        });
        originalSetItem("luxen_community_messages", JSON.stringify(mappedComm));
      }

      hydrateComments(allComments);
      hydrateEngagements(allEngagements);

      if (publicStats) {
        originalSetItem("elevate_public_stats", JSON.stringify(publicStats));
      }

      // Sync safe config keys from site_store
      for (var k in storeData) {
        if (Object.prototype.hasOwnProperty.call(storeData, k) && SYNCED_STORE_KEYS.indexOf(k) !== -1) {
          var valStr = typeof storeData[k] === "string" ? storeData[k] : JSON.stringify(storeData[k]);
          originalSetItem(k, valStr);
        }
      }

      // Authenticated user data
      if (ElevateSupabase.isAuthenticated()) {
        var curUser = null;
        try {
          curUser = JSON.parse(localStorage.getItem("ns_user") || "null");
        } catch (e) {}

        var authPromises = [
          ElevateSupabase.getMemberDirectory(),
          ElevateSupabase.fetchPrivateMessages(),
          ElevateSupabase.fetchCourseSubscriptions(),
          ElevateSupabase.fetchPersonalData(),
        ];

        var isAdmin = !!(curUser && curUser.isAdmin);
        if (isAdmin) {
          authPromises.push(ElevateSupabase.fetchUsers());
          authPromises.push(ElevateSupabase.fetchSubmissions());
          authPromises.push(ElevateSupabase.fetchResetRequests());
          authPromises.push(ElevateSupabase.fetchModerationReports());
          authPromises.push(ElevateSupabase.fetchAdminDevices());
        }

        var authRes = await Promise.all(authPromises);
        var directory = authRes[0] || [];
        var privRows = authRes[1] || [];
        var subsRows = authRes[2] || [];
        var personalRows = authRes[3] || [];

        originalSetItem("luxen_member_directory", JSON.stringify(directory));

        var privGrouped = {};
        privRows.forEach(function (pm) {
          if (!privGrouped[pm.chat_key]) privGrouped[pm.chat_key] = [];
          privGrouped[pm.chat_key].push({
            id: pm.id,
            sender: pm.sender_username,
            senderName: pm.sender_name || pm.sender_username,
            receiver: pm.receiver_username,
            text: pm.text || "",
            type: pm.msg_type || "text",
            mediaUrl: pm.media_url || null,
            replyTo: pm.reply_to || null,
            reactions: pm.reactions || {},
            timestamp: pm.timestamp || Date.parse(pm.created_at) || Date.now(),
          });
        });
        originalSetItem("luxen_private_chats", JSON.stringify(privGrouped));

        var mappedSubs = subsRows.map(function (s) {
          return {
            id: s.id,
            courseId: s.course_id,
            courseTitle: s.course_title,
            identifier: s.identifier,
            activatedAt: s.activated_at,
            activatedBy: s.activated_by,
          };
        });
        originalSetItem("luxen_course_subscriptions", JSON.stringify(mappedSubs));

        personalRows.forEach(function (pr) {
          if (pr && pr.key) {
            originalSetItem(pr.key, JSON.stringify(pr.value));
          }
        });

        if (isAdmin) {
          var usersRows = authRes[4] || [];
          var mappedUsers = usersRows.map(function (u) {
            return Object.assign({}, u.metadata || {}, {
              id: u.id,
              username: u.username,
              email: u.email || "",
              phone: u.phone || "",
              fullName: u.full_name || u.username,
              full_name: u.full_name || u.username,
              isAdmin: Boolean(u.is_admin),
              isTeam: Boolean(u.is_team),
              isTeacher: Boolean(u.is_teacher),
              isPartner: Boolean(u.is_partner),
              teacherName: u.teacher_name || u.full_name,
              partnerId: u.partner_id || null,
              customRoleTitle: u.custom_role_title || null,
              perms: Array.isArray(u.perms) ? u.perms : [],
              isActive: u.is_active !== false,
              isOnline: Boolean(u.is_online),
              provider: u.provider || "credentials",
              avatar: u.avatar || "",
              join_date: u.join_date || "",
              join_timestamp: u.join_timestamp || 0,
              last_login: u.last_login || 0,
            });
          });
          originalSetItem("luxen_all_users", JSON.stringify(mappedUsers));

          var subRows = authRes[5] || [];
          originalSetItem(
            "luxen_submissions",
            JSON.stringify(
              subRows.map(function (s) {
                return Object.assign({}, s.data || {}, { id: s.id, status: s.status });
              }),
            ),
          );

          var resetRows = authRes[6] || [];
          originalSetItem("luxen_reset_requests", JSON.stringify(resetRows));

          var repRows = authRes[7] || [];
          var reports = [];
          var violations = [];
          repRows.forEach(function (r) {
            if (r.kind === "violation") violations.push(Object.assign({}, r.data || {}, { id: r.id }));
            else reports.push(Object.assign({}, r.data || {}, { id: r.id }));
          });
          originalSetItem("luxen_user_reports", JSON.stringify(reports));
          originalSetItem("luxen_flagged_violations", JSON.stringify(violations));

          var devRows = authRes[8] || [];
          if (devRows.length) {
            originalSetItem(
              "elevate_admin_devices",
              JSON.stringify(
                devRows.map(function (d) {
                  return Object.assign({}, d.data || {}, { id: d.id });
                }),
              ),
            );
          }
        }
      }

      isCloudReady = true;
      window.dispatchEvent(new CustomEvent("elevate_db_ready"));
      window.dispatchEvent(new CustomEvent("elevate_sync_complete"));

      while (readyCallbacks.length > 0) {
        var cb = readyCallbacks.shift();
        try {
          cb();
        } catch (e) {}
      }

      rerenderAll();
      setupRealtime();
    } catch (err) {
      console.error("[ElevateDB] Cloud sync error:", err);
      isCloudReady = true;
      rerenderAll();
    }
  }

  var realtimeChannel = null;
  function setupRealtime() {
    if (realtimeChannel || !window.ElevateSupabase || !window.ElevateSupabase.client) return;
    try {
      var client = window.ElevateSupabase.client;
      realtimeChannel = client
        .channel("elevate-live-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "partners" }, async function () {
          var pts = await ElevateSupabase.fetchPartners();
          if (Array.isArray(pts)) {
            originalSetItem("luxen_partners", JSON.stringify(pts));
            rerenderAll();
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "opportunities" }, async function () {
          var opps = await ElevateSupabase.fetchOpportunities({ limit: 200 });
          if (Array.isArray(opps)) {
            originalSetItem("luxen_general_cards", JSON.stringify(opps));
            rerenderAll();
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, async function () {
          var crs = await ElevateSupabase.fetchCourses();
          if (Array.isArray(crs)) {
            originalSetItem("luxen_courses", JSON.stringify(crs));
            rerenderAll();
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "community_messages" }, async function () {
          var msgs = await ElevateSupabase.fetchCommunityMessages(100);
          if (Array.isArray(msgs)) {
            originalSetItem(
              "luxen_community_messages",
              JSON.stringify(
                msgs.map(function (m) {
                  return {
                    id: m.id,
                    sender: m.sender_username || m.user_name || "user",
                    senderName: m.sender_name || m.user_name || "عضو",
                    role: m.role || "member",
                    roleTitle: m.role_title || null,
                    text: m.content || "",
                    type: m.msg_type || "text",
                    mediaUrl: m.media_url || null,
                    replyTo: m.reply_to || null,
                    reactions: m.reactions || {},
                    timestamp: m.timestamp || Date.parse(m.created_at) || Date.now(),
                  };
                }),
              ),
            );
            rerenderAll();
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" }, async function () {
          if (!ElevateSupabase.isAuthenticated()) return;
          var privRows = await ElevateSupabase.fetchPrivateMessages();
          var grouped = {};
          privRows.forEach(function (pm) {
            if (!grouped[pm.chat_key]) grouped[pm.chat_key] = [];
            grouped[pm.chat_key].push({
              id: pm.id,
              sender: pm.sender_username,
              senderName: pm.sender_name || pm.sender_username,
              receiver: pm.receiver_username,
              text: pm.text || "",
              type: pm.msg_type || "text",
              mediaUrl: pm.media_url || null,
              replyTo: pm.reply_to || null,
              reactions: pm.reactions || {},
              timestamp: pm.timestamp || Date.parse(pm.created_at) || Date.now(),
            });
          });
          originalSetItem("luxen_private_chats", JSON.stringify(grouped));
          rerenderAll();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "item_comments" }, async function () {
          hydrateComments(await ElevateSupabase.fetchComments());
          rerenderAll();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "item_engagements" }, async function () {
          hydrateEngagements(await ElevateSupabase.fetchEngagements());
          rerenderAll();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "site_store" }, function (payload) {
          if (payload && payload.new && payload.new.key && SYNCED_STORE_KEYS.indexOf(payload.new.key) !== -1) {
            var valStr =
              typeof payload.new.value === "string"
                ? payload.new.value
                : JSON.stringify(payload.new.value);
            originalSetItem(payload.new.key, valStr);
            rerenderAll();
          }
        })
        .subscribe();
    } catch (e) {
      console.warn("[ElevateDB] Realtime notice:", e);
    }
  }

  window.ElevateDB = {
    keys: SYNCED_STORE_KEYS,
    get isReady() {
      return isCloudReady;
    },
    savePartner: async function (partner) {
      if (!partner) return;
      var list = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
      var idx = list.findIndex(function (p) {
        return String(p.id) === String(partner.id);
      });
      if (idx !== -1) list[idx] = partner;
      else list.unshift(partner);
      originalSetItem("luxen_partners", JSON.stringify(list));
      rerenderAll();
      await ElevateSupabase.savePartner(partner);
    },
    deletePartner: async function (id) {
      if (!id) return;
      var list = JSON.parse(localStorage.getItem("luxen_partners") || "[]").filter(function (p) {
        return String(p.id) !== String(id);
      });
      originalSetItem("luxen_partners", JSON.stringify(list));
      rerenderAll();
      await ElevateSupabase.deletePartner(id);
    },
    saveOpportunity: async function (opp) {
      if (!opp) return;
      var list = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      var idx = list.findIndex(function (c) {
        return String(c.id) === String(opp.id);
      });
      if (idx !== -1) list[idx] = opp;
      else list.unshift(opp);
      originalSetItem("luxen_general_cards", JSON.stringify(list));
      rerenderAll();
      await ElevateSupabase.saveOpportunity(opp);
    },
    deleteOpportunity: async function (id) {
      if (!id) return;
      var list = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]").filter(function (c) {
        return String(c.id) !== String(id);
      });
      originalSetItem("luxen_general_cards", JSON.stringify(list));
      rerenderAll();
      await ElevateSupabase.deleteOpportunity(id);
    },
    saveCourse: async function (course) {
      if (!course) return;
      var list = JSON.parse(localStorage.getItem("luxen_courses") || "[]");
      var idx = list.findIndex(function (c) {
        return String(c.id) === String(course.id);
      });
      if (idx !== -1) list[idx] = course;
      else list.unshift(course);
      originalSetItem("luxen_courses", JSON.stringify(list));
      rerenderAll();
      await ElevateSupabase.saveCourse(course);
    },
    deleteCourse: async function (id) {
      if (!id) return;
      var list = JSON.parse(localStorage.getItem("luxen_courses") || "[]").filter(function (c) {
        return String(c.id) !== String(id);
      });
      originalSetItem("luxen_courses", JSON.stringify(list));
      rerenderAll();
      await ElevateSupabase.deleteCourse(id);
    },
    refresh: function () {
      return syncFromCloud();
    },
    onReady: function (fn) {
      if (isCloudReady) {
        try {
          fn();
        } catch (e) {}
      } else {
        readyCallbacks.push(fn);
      }
    },
  };

  rerenderAll();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      rerenderAll();
      syncFromCloud();
    });
  } else {
    setTimeout(syncFromCloud, 20);
  }
})();
