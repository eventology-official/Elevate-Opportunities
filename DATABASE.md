# 🗄️ قاعدة بيانات Elevate - Supabase PostgreSQL

## نظرة عامة

منصة Elevate تستخدم **Supabase** (PostgreSQL) كقاعدة بيانات سحابية مع مزامنة تلقائية وتحديثات فورية.

---

## 📊 هيكل قاعدة البيانات

### الجداول الرئيسية

#### 1. `users` - بيانات المستخدمين

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  is_teacher BOOLEAN DEFAULT false,
  teacher_name TEXT,
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'credentials',
  google_id TEXT,
  avatar TEXT,
  join_date TEXT,
  join_timestamp BIGINT,
  last_login BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_is_teacher ON users(is_teacher);
```

**الحقول**:
- `id`: معرّف فريد للمستخدم
- `username`: اسم المستخدم (فريد)
- `email`: البريد الإلكتروني
- `phone`: رقم الهاتف
- `full_name`: الاسم الكامل
- `password_hash`: كلمة المرور المشفرة (PBKDF2)
- `is_admin`: هل المستخدم مدير؟
- `is_teacher`: هل المستخدم مدرس؟
- `is_active`: حالة الحساب
- `provider`: طريقة التسجيل (credentials/google)
- `metadata`: بيانات إضافية (JSON)

---

#### 2. `site_store` - بيانات الموقع

```sql
CREATE TABLE site_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  source TEXT DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_site_store_updated_at ON site_store(updated_at DESC);
```

**المفاتيح المحفوظة**:

| المفتاح | الوصف | نوع البيانات |
|---------|-------|--------------|
| `luxen_general_cards` | جميع الفرص (منح، مسابقات، وظائف، إلخ) | Array of Objects |
| `luxen_partners` | شركاء المنصة | Array of Objects |
| `luxen_courses` | الكورسات المجانية والمدفوعة | Array of Objects |
| `luxen_comments` | التعليقات على الفرص | Array of Objects |
| `luxen_course_comments` | التعليقات على الكورسات | Object |
| `luxen_community_messages` | رسائل المجتمع | Array of Objects |
| `luxen_private_chats` | المحادثات الخاصة | Array of Objects |
| `luxen_faq` | الأسئلة الشائعة | Array of Objects |
| `luxen_submissions` | طلبات التقديم | Array of Objects |
| `luxen_notifications` | الإشعارات | Array of Objects |
| `luxen_settings` | إعدادات الموقع | Object |
| `luxen_category_status` | حالة التصنيفات | Object |
| `luxen_lockdown_status` | حالة القفل | Boolean |
| `luxen_likes` | الإعجابات | Object |
| `luxen_views` | المشاهدات | Object |
| `luxen_votes` | التصويتات | Object |
| `luxen_bookmarks` | الحفظ | Object |
| `luxen_subscriptions` | الاشتراكات | Object |

---

## 🔄 نظام المزامنة

### كيف تعمل المزامنة؟

```javascript
// 1. عند فتح الموقع - جلب البيانات من Supabase
await ElevateSupabase.fetchStore();
await ElevateSupabase.fetchUsers();

// 2. عند التعديل - حفظ تلقائي
localStorage.setItem("luxen_general_cards", JSON.stringify(cards));
// => يتم الحفظ تلقائياً في Supabase عبر db-sync.js

// 3. تحديثات مباشرة عبر جميع الأجهزة (Real-time)
// يتم الاستماع للتغييرات وتحديث الواجهة فوراً
```

### تدفق البيانات

```
┌─────────────┐
│  المتصفح    │
│ (localStorage) │
└──────┬──────┘
       │ ↕ مزامنة تلقائية
       │
┌──────▼──────┐
│  db-sync.js │
│  (محرك المزامنة) │
└──────┬──────┘
       │ ↕ REST API
       │
┌──────▼──────┐
│  Supabase   │
│  (PostgreSQL) │
└─────────────┘
```

---

## 🔐 الأمان

### تشفير كلمات المرور

```javascript
// PBKDF2-SHA256 مع 100,000 iterations
const hash = await ElevateSupabase.hashPassword(password);
// Output: pbkdf2$100000$[salt]$[hash]

// التحقق من كلمة المرور
const isValid = await ElevateSupabase.verifyPassword(password, storedHash);
```

### صلاحيات الوصول

#### Row Level Security (RLS)

```sql
-- المستخدمون يمكنهم قراءة بياناتهم فقط
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

-- المدراء يمكنهم الوصول لكل شيء
CREATE POLICY users_admin_all ON users
  FOR ALL USING (
    (SELECT is_admin FROM users WHERE id = auth.uid()) = true
  );

-- البيانات العامة يمكن قراءتها من الجميع
CREATE POLICY site_store_public_select ON site_store
  FOR SELECT USING (true);

-- الكتابة للمدراء فقط
CREATE POLICY site_store_admin_insert ON site_store
  FOR INSERT WITH CHECK (
    (SELECT is_admin FROM users WHERE id = auth.uid()) = true
  );
```

---

## 📡 Real-time Subscriptions

### الاستماع للتحديثات المباشرة

```javascript
// الاشتراك في تغييرات جدول site_store
const channel = supabase
  .channel('elevate-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'site_store'
  }, (payload) => {
    console.log('تحديث جديد:', payload);
    // تحديث الواجهة
    updateUI(payload.new);
  })
  .subscribe();

// الاشتراك في تغييرات المستخدمين
supabase
  .channel('users-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'users'
  }, async () => {
    const users = await ElevateSupabase.fetchUsers();
    updateUsersList(users);
  })
  .subscribe();
```

---

## 🚀 الاستخدام

### إضافة فرصة جديدة

```javascript
const opportunity = {
  id: "opp_" + Date.now(),
  title: "منحة دراسية كاملة",
  category: "scholarships",
  description: "منحة ممولة بالكامل",
  deadline: "2026-12-31",
  link: "https://example.com",
  image: "https://...",
  tags: ["منحة", "دراسة", "تمويل"]
};

// الحفظ المحلي (يتم المزامنة تلقائياً)
const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
cards.push(opportunity);
localStorage.setItem("luxen_general_cards", JSON.stringify(cards));

// أو الحفظ المباشر في Supabase
await ElevateSupabase.saveStoreKey("luxen_general_cards", cards);
```

### إنشاء مستخدم جديد

```javascript
const newUser = {
  username: "ahmed123",
  email: "ahmed@example.com",
  phone: "01234567890",
  fullName: "أحمد محمد",
  password: "SecurePass@2026",
  isAdmin: false,
  isTeacher: false
};

// الحفظ في Supabase
const user = await ElevateSupabase.saveUser(newUser);
console.log("تم إنشاء المستخدم:", user.id);
```

### البحث عن مستخدم

```javascript
// بحث بأي من: username, email, phone
const user = await ElevateSupabase.findUser("ahmed123");
if (user) {
  console.log("المستخدم موجود:", user.full_name);
}
```

### التحقق من كلمة المرور

```javascript
const isValid = await ElevateSupabase.verifyPassword(
  inputPassword,
  user.password_hash
);

if (isValid) {
  // تسجيل الدخول
  localStorage.setItem("ns_user", JSON.stringify(user));
}
```

---

## 🔧 الصيانة

### النسخ الاحتياطي

```javascript
// نسخ احتياطي يدوي
async function backupDatabase() {
  const store = await ElevateSupabase.fetchStore();
  const users = await ElevateSupabase.fetchUsers();
  
  const backup = {
    timestamp: Date.now(),
    store: store,
    users: users
  };
  
  // حفظ في ملف
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `elevate-backup-${Date.now()}.json`;
  a.click();
}
```

### استعادة النسخة الاحتياطية

```javascript
async function restoreBackup(backupFile) {
  const backup = JSON.parse(await backupFile.text());
  
  // استعادة البيانات
  for (const [key, value] of Object.entries(backup.store)) {
    await ElevateSupabase.saveStoreKey(key, value);
  }
  
  // استعادة المستخدمين
  for (const user of backup.users) {
    await ElevateSupabase.saveUser(user);
  }
  
  console.log("تم استعادة النسخة الاحتياطية بنجاح!");
}
```

### تنظيف البيانات القديمة

```sql
-- حذف المستخدمين غير النشطين لأكثر من سنة
DELETE FROM users 
WHERE is_active = false 
  AND last_login < EXTRACT(EPOCH FROM NOW() - INTERVAL '1 year') * 1000;

-- حذف الفرص المنتهية منذ أكثر من 6 أشهر
-- يتم من خلال تطبيق JavaScript
```

---

## 📊 الإحصائيات والتحليلات

### استعلامات مفيدة

```sql
-- عدد المستخدمين النشطين
SELECT COUNT(*) FROM users WHERE is_active = true;

-- عدد المدراء
SELECT COUNT(*) FROM users WHERE is_admin = true;

-- عدد المدرسين
SELECT COUNT(*) FROM users WHERE is_teacher = true;

-- آخر 10 مستخدمين مسجلين
SELECT username, full_name, join_date 
FROM users 
ORDER BY join_timestamp DESC 
LIMIT 10;

-- المستخدمين الأكثر نشاطاً (بناءً على آخر دخول)
SELECT username, full_name, last_login 
FROM users 
ORDER BY last_login DESC 
LIMIT 20;
```

---

## 🔍 معالجة المشاكل

### المشكلة: البيانات لا تُحفظ

**التحقق**:
```javascript
// 1. تحقق من الاتصال
console.log(ElevateSupabase.config);

// 2. اختبار الحفظ
await ElevateSupabase.saveStoreKey("test_key", { test: "data" });

// 3. التحقق من Developer Console
// ابحث عن أخطاء في Console
```

**الحلول**:
- تحقق من صحة `SUPABASE_URL` و `ANON_KEY` في `supabase-client.js`
- تأكد من اتصال الإنترنت
- راجع صلاحيات RLS في Supabase Dashboard

### المشكلة: المزامنة بطيئة

**الحلول**:
- أضف indexes للجداول
- قلل حجم البيانات المُرسلة
- استخدم pagination للبيانات الكبيرة

```sql
-- إضافة index للأداء
CREATE INDEX idx_site_store_key ON site_store(key);
CREATE INDEX idx_users_username ON users(username);
```

---

## 🌐 الاتصال بـ Supabase

### معلومات المشروع

```javascript
const SUPABASE_CONFIG = {
  url: 'https://uhjstvlhlkcewmquhrnj.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  region: 'eu-central-1', // Frankfurt
  status: 'ACTIVE_HEALTHY'
};
```

### تهيئة العميل

```javascript
// باستخدام Supabase SDK
const supabase = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// أو باستخدام REST API
async function supabaseQuery(endpoint, options) {
  const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  
  return await response.json();
}
```

---

## 📚 موارد إضافية

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PBKDF2 Specification](https://tools.ietf.org/html/rfc2898)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**آخر تحديث**: نوفمبر 2026  
**الحالة**: ✅ متصل ونشط

