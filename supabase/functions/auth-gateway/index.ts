import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, existingSalt?: string): Promise<string> {
  let salt = existingSalt;
  if (!salt) {
    const rand = new Uint8Array(16);
    crypto.getRandomValues(rand);
    salt = btoa(String.fromCharCode(...rand));
  }
  const iterations = 32000;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pbkdf2$${iterations}$${salt}$${hashB64}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== "string") return false;
  if (!storedHash.startsWith("pbkdf2$")) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]) || 32000;
  const salt = parts[2];
  const expectedB64 = parts[3];

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return timingSafeEqualStr(computedB64, expectedB64);
}

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  password_hash: string | null;
  is_admin: boolean;
  is_team: boolean;
  is_teacher: boolean;
  is_partner: boolean;
  teacher_name: string | null;
  partner_id: string | null;
  custom_role_title: string | null;
  perms: unknown;
  is_active: boolean;
  is_online: boolean;
  provider: string | null;
  google_id: string | null;
  avatar: string | null;
  failed_attempts: number;
  locked_until: number;
  join_date: string | null;
  join_timestamp: number | null;
  last_login: number | null;
  metadata: Record<string, unknown> | null;
  auth_uid: string | null;
}

function buildAppMetadata(u: UserRow) {
  let role = "student";
  if (u.is_admin) role = "admin";
  else if (u.is_team) role = "team";
  else if (u.is_teacher) role = "teacher";
  else if (u.is_partner) role = "partner";

  return {
    profile_id: u.id,
    username: u.username,
    email: u.email || "",
    role,
    perms: Array.isArray(u.perms) ? u.perms : [],
    partner_id: u.partner_id || null,
  };
}

function sanitizeUser(u: UserRow) {
  const meta = u.metadata && typeof u.metadata === "object" ? u.metadata : {};
  return {
    ...meta,
    id: u.id,
    username: u.username,
    email: u.email || "",
    phone: u.phone || "",
    fullName: u.full_name || u.username,
    full_name: u.full_name || u.username,
    name: u.full_name || u.username,
    isAdmin: Boolean(u.is_admin),
    is_admin: Boolean(u.is_admin),
    isTeam: Boolean(u.is_team),
    is_team: Boolean(u.is_team),
    isTeacher: Boolean(u.is_teacher),
    is_teacher: Boolean(u.is_teacher),
    isPartner: Boolean(u.is_partner),
    is_partner: Boolean(u.is_partner),
    teacherName: u.teacher_name || u.full_name || "",
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
    metadata: meta,
  };
}

async function mintSupabaseSession(
  supabaseAdmin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  user: UserRow,
) {
  const idHex = await sha256Hex(user.id);
  const internalEmail = `u_${idHex.slice(0, 24)}@auth.elevate.local`;
  const oneTimeSecret = `${crypto.randomUUID()}!9Az`;
  const appMetadata = buildAppMetadata(user);

  let authUid = user.auth_uid;
  if (!authUid) {
    // Check if auth user already exists by looking up listUsers or creating directly
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: oneTimeSecret,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: { profile_id: user.id, username: user.username },
    });

    if (createErr) {
      // Fallback: find existing auth user with same synthetic email
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = listData?.users?.find((au) => au.email === internalEmail);
      if (!found) throw createErr;
      authUid = found.id;
      await supabaseAdmin.auth.admin.updateUserById(authUid, {
        password: oneTimeSecret,
        email_confirm: true,
        ban_duration: "none",
        app_metadata: appMetadata,
      });
    } else {
      authUid = created.user.id;
    }

    await supabaseAdmin.from("users").update({ auth_uid: authUid }).eq("id", user.id);
    user.auth_uid = authUid;
  } else {
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUid, {
      email: internalEmail,
      password: oneTimeSecret,
      email_confirm: true,
      ban_duration: "none",
      app_metadata: appMetadata,
    });
    if (updErr) throw updErr;
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
    email: internalEmail,
    password: oneTimeSecret,
  });
  if (signInErr || !signInData.session) {
    throw signInErr || new Error("Failed to mint auth session");
  }

  return signInData.session;
}

async function getCallerUser(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<UserRow | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const profileId = (data.user.app_metadata as Record<string, unknown> | undefined)?.profile_id;
  let query = supabaseAdmin.from("users").select("*");
  if (typeof profileId === "string" && profileId) {
    query = query.eq("id", profileId);
  } else {
    query = query.eq("auth_uid", data.user.id);
  }
  const { data: userRow } = await query.maybeSingle();
  if (!userRow || userRow.is_active === false) return null;
  return userRow as UserRow;
}

async function findUserByIdentifier(
  supabaseAdmin: ReturnType<typeof createClient>,
  identifier: string,
): Promise<UserRow | null> {
  const clean = identifier.trim();
  const lower = clean.toLowerCase();

  if (lower === "admin" || lower === "admin@elevate.com" || clean === "01000000000") {
    const { data } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("is_admin", true)
      .limit(1)
      .maybeSingle();
    if (data) return data as UserRow;
  }

  // Safe parameterized queries (no raw string interpolation inside .or() filters)
  const { data: byUser } = await supabaseAdmin
    .from("users")
    .select("*")
    .ilike("username", clean)
    .limit(1)
    .maybeSingle();
  if (byUser) return byUser as UserRow;

  const { data: byEmail } = await supabaseAdmin
    .from("users")
    .select("*")
    .ilike("email", clean)
    .limit(1)
    .maybeSingle();
  if (byEmail) return byEmail as UserRow;

  const { data: byPhone } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("phone", clean)
    .limit(1)
    .maybeSingle();
  return (byPhone as UserRow | null) || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ ok: false, error: "Server configuration missing" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const action = String(body.action || "");

  try {
    // ------------------------------------------------------------------
    // 1. LOGIN
    // ------------------------------------------------------------------
    if (action === "login") {
      const identifier = String(body.identifier || "").trim();
      const password = String(body.password || "");
      const twofaCode = body.twofa_code !== undefined ? String(body.twofa_code).trim() : "";

      if (!identifier || !password) {
        return jsonResponse({ ok: false, error: "يرجى إدخال اسم المستخدم وكلمة المرور." }, 400);
      }

      const user = await findUserByIdentifier(supabaseAdmin, identifier);
      if (!user) {
        return jsonResponse({ ok: false, error: "بيانات الدخول غير صحيحة." }, 401);
      }

      if (user.is_active === false) {
        return jsonResponse({ ok: false, error: "هذا الحساب موقوف حالياً. تواصل مع الإدارة." }, 403);
      }

      const now = Date.now();
      if (user.locked_until && user.locked_until > now) {
        const minsLeft = Math.max(1, Math.ceil((user.locked_until - now) / 60000));
        return jsonResponse(
          { ok: false, error: `تم قفل المحاولات مؤقتاً لكثرة الأخطاء. حاول بعد ${minsLeft} دقيقة.` },
          429,
        );
      }

      const validPw = await verifyPassword(password, user.password_hash || "");
      if (!validPw) {
        const nextFails = (user.failed_attempts || 0) + 1;
        const lockUntil = nextFails >= 5 ? now + 5 * 60 * 1000 : 0;
        await supabaseAdmin
          .from("users")
          .update({ failed_attempts: nextFails, locked_until: lockUntil })
          .eq("id", user.id);
        return jsonResponse({ ok: false, error: "بيانات الدخول غير صحيحة." }, 401);
      }

      // Admin 2FA check before issuing JWT
      if (user.is_admin) {
        if (!twofaCode) {
          return jsonResponse({ ok: true, requires_2fa: true });
        }
        const { data: secretVal } = await supabaseAdmin.rpc("elevate_get_admin_secret", {
          p_key: "admin_2fa_sha256",
        });

        const providedHash = await sha256Hex(twofaCode);
        if (!secretVal || !timingSafeEqualStr(providedHash, String(secretVal))) {
          const nextFails = (user.failed_attempts || 0) + 1;
          const lockUntil = nextFails >= 5 ? now + 5 * 60 * 1000 : 0;
          await supabaseAdmin
            .from("users")
            .update({ failed_attempts: nextFails, locked_until: lockUntil })
            .eq("id", user.id);
          return jsonResponse({ ok: false, error: "رمز التحقق الثنائي (2FA) غير صحيح." }, 401);
        }
      }

      await supabaseAdmin
        .from("users")
        .update({ failed_attempts: 0, locked_until: 0, last_login: now, is_online: true })
        .eq("id", user.id);

      const session = await mintSupabaseSession(supabaseAdmin, supabaseUrl, anonKey, user);
      return jsonResponse({ ok: true, session, user: sanitizeUser(user) });
    }

    // ------------------------------------------------------------------
    // 2. REGISTER
    // ------------------------------------------------------------------
    if (action === "register") {
      const username = String(body.username || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const fullName = String(body.fullName || body.full_name || username).trim();
      const password = String(body.password || "");

      if (!username || username.length < 3) {
        return jsonResponse({ ok: false, error: "اسم المستخدم يجب ألا يقل عن 3 أحرف." }, 400);
      }
      if (password.length < 8) {
        return jsonResponse({ ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." }, 400);
      }

      const { data: dupUser } = await supabaseAdmin
        .from("users")
        .select("id")
        .ilike("username", username)
        .limit(1)
        .maybeSingle();
      if (dupUser) {
        return jsonResponse({ ok: false, error: "اسم المستخدم مسجل مسبقاً." }, 409);
      }
      if (email) {
        const { data: dupEmail } = await supabaseAdmin
          .from("users")
          .select("id")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();
        if (dupEmail) {
          return jsonResponse({ ok: false, error: "البريد الإلكتروني مسجل مسبقاً." }, 409);
        }
      }
      if (phone) {
        const { data: dupPhone } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("phone", phone)
          .limit(1)
          .maybeSingle();
        if (dupPhone) {
          return jsonResponse({ ok: false, error: "رقم الهاتف مسجل مسبقاً." }, 409);
        }
      }

      const passwordHash = await hashPassword(password);
      const now = Date.now();
      const newUser: Partial<UserRow> = {
        id: `usr_${now}_${Math.random().toString(36).slice(2, 8)}`,
        username,
        email: email || null,
        phone: phone || null,
        full_name: fullName || username,
        password_hash: passwordHash,
        is_admin: false,
        is_team: false,
        is_teacher: false,
        is_partner: false,
        perms: [],
        is_active: true,
        is_online: true,
        provider: "credentials",
        failed_attempts: 0,
        locked_until: 0,
        join_date: new Date().toLocaleDateString("ar-EG"),
        join_timestamp: now,
        last_login: now,
        metadata: {},
      };

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("users")
        .insert(newUser)
        .select("*")
        .single();
      if (insErr) {
        return jsonResponse({ ok: false, error: insErr.message }, 400);
      }

      const session = await mintSupabaseSession(
        supabaseAdmin,
        supabaseUrl,
        anonKey,
        inserted as UserRow,
      );
      return jsonResponse({ ok: true, session, user: sanitizeUser(inserted as UserRow) });
    }

    // ------------------------------------------------------------------
    // 3. GOOGLE OAUTH VERIFIED ID TOKEN LOGIN
    // ------------------------------------------------------------------
    if (action === "google_login") {
      const credential = String(body.credential || "").trim();
      if (!credential) {
        return jsonResponse({ ok: false, error: "Google credential token is required." }, 400);
      }

      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      );
      if (!verifyRes.ok) {
        return jsonResponse({ ok: false, error: "تعذر التحقق من حساب Google." }, 401);
      }
      const tokenInfo = await verifyRes.json();
      if (tokenInfo.email_verified !== "true" || !tokenInfo.email) {
        return jsonResponse({ ok: false, error: "بريد Google غير موثق." }, 401);
      }

      const googleEmail = String(tokenInfo.email).toLowerCase();
      let user = await findUserByIdentifier(supabaseAdmin, googleEmail);
      const now = Date.now();

      if (!user) {
        const baseUsername = googleEmail.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
        const uniqueUsername = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("users")
          .insert({
            id: `usr_g_${now}_${Math.random().toString(36).slice(2, 6)}`,
            username: uniqueUsername,
            email: googleEmail,
            full_name: String(tokenInfo.name || baseUsername),
            password_hash: "",
            is_admin: false,
            is_team: false,
            is_teacher: false,
            is_partner: false,
            perms: [],
            is_active: true,
            is_online: true,
            provider: "google",
            google_id: String(tokenInfo.sub || ""),
            avatar: String(tokenInfo.picture || ""),
            failed_attempts: 0,
            locked_until: 0,
            join_date: new Date().toLocaleDateString("ar-EG"),
            join_timestamp: now,
            last_login: now,
            metadata: {},
          })
          .select("*")
          .single();
        if (insErr) throw insErr;
        user = inserted as UserRow;
      } else if (user.is_active === false) {
        return jsonResponse({ ok: false, error: "هذا الحساب موقوف حالياً." }, 403);
      }

      const session = await mintSupabaseSession(supabaseAdmin, supabaseUrl, anonKey, user);
      return jsonResponse({ ok: true, session, user: sanitizeUser(user) });
    }

    // ------------------------------------------------------------------
    // 4. FORGOT PASSWORD REQUEST
    // ------------------------------------------------------------------
    if (action === "forgot_password") {
      const identifier = String(body.identifier || "").trim();
      if (!identifier || identifier.length < 2) {
        return jsonResponse({ ok: false, error: "يرجى إدخال اسم المستخدم أو البريد الإلكتروني." }, 400);
      }

      const { data: existingPending } = await supabaseAdmin
        .from("password_reset_requests")
        .select("id")
        .ilike("identifier", identifier)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      if (existingPending) {
        return jsonResponse({
          ok: true,
          already_pending: true,
          message: "لديك طلب معلق بالفعل. يرجى انتظار المدير لمعالجته.",
        });
      }

      const reqRow = {
        id: `rst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        identifier,
        status: "pending",
      };
      const { error: insErr } = await supabaseAdmin.from("password_reset_requests").insert(reqRow);
      if (insErr) throw insErr;

      return jsonResponse({ ok: true, message: "تم حفظ طلب استعادة كلمة المرور بنجاح." });
    }

    // ------------------------------------------------------------------
    // 5. SIGNED COURSE MEDIA URL (Checks paid enrollment on server)
    // ------------------------------------------------------------------
    if (action === "get_course_media_url") {
      const courseId = String(body.courseId || "").trim();
      const kind = body.kind === "image" ? "image" : "video";
      if (!courseId) return jsonResponse({ ok: false, error: "Missing courseId" }, 400);

      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .maybeSingle();
      if (!course) return jsonResponse({ ok: false, error: "Course not found" }, 404);

      const courseData = (course.data as Record<string, unknown> | null) || {};
      const path =
        kind === "image"
          ? String(courseData.thumbPath || "")
          : String(courseData.videoPath || "");
      if (!path) return jsonResponse({ ok: false, error: "No cloud media path" }, 404);

      if (kind === "video") {
        const isPaid = Boolean(courseData.isPaid) || Number(course.price || 0) > 0;
        if (isPaid) {
          const caller = await getCallerUser(req, supabaseAdmin);
          if (!caller) {
            return jsonResponse({ ok: false, error: "Authentication required for paid course" }, 401);
          }
          const isOwnerTeacher =
            caller.is_admin ||
            (caller.is_teacher && String(courseData.teacherId || "") === caller.id);
          if (!isOwnerTeacher) {
            const { data: subByUser } = await supabaseAdmin
              .from("course_subscriptions")
              .select("id")
              .eq("course_id", courseId)
              .ilike("identifier", caller.username)
              .limit(1)
              .maybeSingle();
            let subMatch = subByUser;
            if (!subMatch && caller.email) {
              const { data: subByEmail } = await supabaseAdmin
                .from("course_subscriptions")
                .select("id")
                .eq("course_id", courseId)
                .ilike("identifier", caller.email)
                .limit(1)
                .maybeSingle();
              subMatch = subByEmail;
            }
            if (!subMatch) {
              return jsonResponse({ ok: false, error: "Course subscription required" }, 403);
            }
          }
        }
      }

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("course-media")
        .createSignedUrl(path, 3600);
      if (signErr || !signed?.signedUrl) {
        return jsonResponse({ ok: false, error: signErr?.message || "Signed URL error" }, 500);
      }
      return jsonResponse({ ok: true, url: signed.signedUrl });
    }

    // ------------------------------------------------------------------
    // AUTHENTICATED USER ACTIONS
    // ------------------------------------------------------------------
    const caller = await getCallerUser(req, supabaseAdmin);
    if (!caller) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    if (action === "get_me") {
      return jsonResponse({ ok: true, user: sanitizeUser(caller) });
    }

    if (action === "update_profile") {
      const patch = (body.patch as Record<string, unknown> | undefined) || {};
      const nextFullName =
        typeof patch.name === "string"
          ? patch.name.trim()
          : typeof patch.fullName === "string"
            ? patch.fullName.trim()
            : caller.full_name;
      const nextPhone = typeof patch.phone === "string" ? patch.phone.trim() : caller.phone;
      const nextAvatar = typeof patch.avatar === "string" ? patch.avatar.trim() : caller.avatar;

      const allowedMetaKeys = [
        "bio",
        "university",
        "major",
        "year",
        "city",
        "interests",
        "linkedin",
        "github",
        "website",
        "avatarColor",
      ];
      const nextMeta: Record<string, unknown> = { ...(caller.metadata || {}) };
      for (const k of allowedMetaKeys) {
        if (k in patch) nextMeta[k] = patch[k];
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("users")
        .update({
          full_name: nextFullName,
          phone: nextPhone,
          avatar: nextAvatar,
          metadata: nextMeta,
        })
        .eq("id", caller.id)
        .select("*")
        .single();
      if (updErr) throw updErr;

      return jsonResponse({ ok: true, user: sanitizeUser(updated as UserRow) });
    }

    // ------------------------------------------------------------------
    // ADMIN-ONLY ACTIONS
    // ------------------------------------------------------------------
    if (!caller.is_admin) {
      return jsonResponse({ ok: false, error: "Admin privileges required" }, 403);
    }

    if (action === "verify_2fa" || action === "verify_vault" || action === "verify_lockdown") {
      const code = String(body.code || "").trim();
      const keyMap: Record<string, string> = {
        verify_2fa: "admin_2fa_sha256",
        verify_vault: "admin_vault_sha256",
        verify_lockdown: "admin_lockdown_sha256",
      };
      const { data: secretVal } = await supabaseAdmin.rpc("elevate_get_admin_secret", {
        p_key: keyMap[action],
      });

      const providedHash = await sha256Hex(code);
      const valid = !!(secretVal && timingSafeEqualStr(providedHash, String(secretVal)));
      return jsonResponse({ ok: valid, valid });
    }

    if (action === "change_admin_password") {
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      if (newPassword.length < 8) {
        return jsonResponse({ ok: false, error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." }, 400);
      }
      const valid = await verifyPassword(currentPassword, caller.password_hash || "");
      if (!valid) {
        return jsonResponse({ ok: false, error: "كلمة المرور الحالية غير صحيحة." }, 401);
      }
      const nextHash = await hashPassword(newPassword);
      const { error: updErr } = await supabaseAdmin
        .from("users")
        .update({ password_hash: nextHash })
        .eq("id", caller.id);
      if (updErr) throw updErr;
      return jsonResponse({ ok: true });
    }

    if (action === "change_2fa") {
      const currentCode = String(body.currentCode || "").trim();
      const newCode = String(body.newCode || "").trim();
      if (!/^\d{4}$/.test(newCode)) {
        return jsonResponse({ ok: false, error: "رمز التحقق الجديد يجب أن يكون 4 أرقام." }, 400);
      }
      const { data: secretVal } = await supabaseAdmin.rpc("elevate_get_admin_secret", {
        p_key: "admin_2fa_sha256",
      });

      const curHash = await sha256Hex(currentCode);
      if (!secretVal || !timingSafeEqualStr(curHash, String(secretVal))) {
        return jsonResponse({ ok: false, error: "رمز التحقق الحالي غير صحيح." }, 401);
      }
      const nextHash = await sha256Hex(newCode);
      const { error: secErr } = await supabaseAdmin.rpc("elevate_set_admin_secret", {
        p_key: "admin_2fa_sha256",
        p_val: nextHash,
      });
      if (secErr) throw secErr;
      return jsonResponse({ ok: true });
    }

    if (action === "admin_create_user") {
      const u = (body.user as Record<string, unknown> | undefined) || {};
      const username = String(u.username || "").trim();
      const email = String(u.email || "").trim().toLowerCase();
      const phone = String(u.phone || "").trim();
      const password = String(u.password || "");
      const fullName = String(u.fullName || username).trim();
      const isTeam = Boolean(u.isTeam);
      const isTeacher = Boolean(u.isTeacher);
      const isPartner = Boolean(u.isPartner);
      const partnerId = u.partnerId ? String(u.partnerId) : null;
      const teacherName = u.teacherName ? String(u.teacherName) : isTeacher ? fullName : "";
      const customRoleTitle = u.customRoleTitle ? String(u.customRoleTitle) : null;
      const perms = Array.isArray(u.perms) ? u.perms : [];
      const isActive = u.isActive !== false;

      if (!username || password.length < 8) {
        return jsonResponse({ ok: false, error: "اسم المستخدم وكلمة المرور (8+ أحرف) مطلوبان." }, 400);
      }

      const dup = await findUserByIdentifier(supabaseAdmin, username);
      if (dup) {
        return jsonResponse({ ok: false, error: "اسم المستخدم أو البريد مسجل مسبقاً." }, 409);
      }

      const now = Date.now();
      const pwHash = await hashPassword(password);
      const prefix = isTeacher ? "teacher_" : isTeam ? "team_" : isPartner ? "ptr_" : "usr_";
      const record = {
        id: String(u.id || `${prefix}${now}`),
        username,
        email: email || null,
        phone: phone || null,
        full_name: fullName,
        teacher_name: teacherName || null,
        password_hash: pwHash,
        is_admin: false,
        is_team: isTeam,
        is_teacher: isTeacher,
        is_partner: isPartner,
        partner_id: partnerId,
        custom_role_title: customRoleTitle,
        perms,
        is_active: isActive,
        is_online: false,
        provider: "credentials",
        failed_attempts: 0,
        locked_until: 0,
        join_date: new Date().toLocaleDateString("ar-EG"),
        join_timestamp: now,
        metadata: {},
      };

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("users")
        .insert(record)
        .select("*")
        .single();
      if (insErr) throw insErr;

      return jsonResponse({ ok: true, user: sanitizeUser(inserted as UserRow) });
    }

    if (action === "admin_update_user_password") {
      const userId = String(body.userId || "").trim();
      const newPassword = String(body.password || "");
      if (!userId || newPassword.length < 8) {
        return jsonResponse({ ok: false, error: "بيانات غير مكتملة أو كلمة المرور قصيرة." }, 400);
      }
      const pwHash = await hashPassword(newPassword);
      const { error: updErr } = await supabaseAdmin
        .from("users")
        .update({ password_hash: pwHash, failed_attempts: 0, locked_until: 0 })
        .eq("id", userId);
      if (updErr) throw updErr;
      return jsonResponse({ ok: true });
    }

    if (action === "admin_toggle_user_active") {
      const targetId = String(body.userId || "").trim();
      const targetUsername = String(body.username || "").trim();
      let query = supabaseAdmin.from("users").select("*");
      if (targetId) query = query.eq("id", targetId);
      else if (targetUsername) query = query.ilike("username", targetUsername);
      else return jsonResponse({ ok: false, error: "Missing user identifier" }, 400);

      const { data: target } = await query.maybeSingle();
      if (!target) return jsonResponse({ ok: false, error: "User not found" }, 404);
      if (target.is_admin) return jsonResponse({ ok: false, error: "Cannot suspend master admin" }, 400);

      const nextActive = body.isActive !== undefined ? Boolean(body.isActive) : target.is_active === false;
      const { error: updErr } = await supabaseAdmin
        .from("users")
        .update({ is_active: nextActive })
        .eq("id", target.id);
      if (updErr) throw updErr;

      if (target.auth_uid) {
        await supabaseAdmin.auth.admin.updateUserById(target.auth_uid, {
          ban_duration: nextActive ? "none" : "876000h",
        });
      }
      return jsonResponse({ ok: true, isActive: nextActive });
    }

    if (action === "admin_delete_user") {
      const targetId = String(body.userId || "").trim();
      if (!targetId) return jsonResponse({ ok: false, error: "Missing userId" }, 400);

      const { data: target } = await supabaseAdmin
        .from("users")
        .select("id, is_admin, auth_uid")
        .eq("id", targetId)
        .maybeSingle();
      if (!target) return jsonResponse({ ok: false, error: "User not found" }, 404);
      if (target.is_admin) return jsonResponse({ ok: false, error: "Cannot delete master admin" }, 400);

      const { error: delErr } = await supabaseAdmin.from("users").delete().eq("id", targetId);
      if (delErr) throw delErr;
      if (target.auth_uid) {
        await supabaseAdmin.auth.admin.deleteUser(target.auth_uid).catch(() => {});
      }
      return jsonResponse({ ok: true });
    }

    if (action === "admin_reset_password") {
      const reqId = String(body.requestId || "").trim();
      const identifier = String(body.identifier || body.username || "").trim();
      const newPassword = String(body.password || "");
      if (newPassword.length < 8) {
        return jsonResponse({ ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." }, 400);
      }

      const target = await findUserByIdentifier(supabaseAdmin, identifier);
      if (!target) {
        return jsonResponse({ ok: false, error: "الحساب غير موجود في قاعدة البيانات." }, 404);
      }
      if (target.is_admin) {
        return jsonResponse({ ok: false, error: "لا يمكن تغيير كلمة مرور المدير من هنا." }, 403);
      }

      const nextHash = await hashPassword(newPassword);
      const { error: updErr } = await supabaseAdmin
        .from("users")
        .update({ password_hash: nextHash, failed_attempts: 0, locked_until: 0 })
        .eq("id", target.id);
      if (updErr) throw updErr;

      if (reqId) {
        await supabaseAdmin
          .from("password_reset_requests")
          .update({
            status: "resolved",
            resolved_by: caller.username,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", reqId);
      } else {
        await supabaseAdmin
          .from("password_reset_requests")
          .update({
            status: "resolved",
            resolved_by: caller.username,
            resolved_at: new Date().toISOString(),
          })
          .ilike("identifier", identifier)
          .eq("status", "pending");
      }

      return jsonResponse({ ok: true });
    }

    if (action === "admin_reject_password_reset") {
      const reqId = String(body.requestId || "").trim();
      const identifier = String(body.identifier || body.username || "").trim();
      let q = supabaseAdmin.from("password_reset_requests").update({
        status: "rejected",
        resolved_by: caller.username,
        resolved_at: new Date().toISOString(),
      });
      if (reqId) q = q.eq("id", reqId);
      else q = q.ilike("identifier", identifier).eq("status", "pending");
      const { error: rejErr } = await q;
      if (rejErr) throw rejErr;
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth-gateway] Error:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
