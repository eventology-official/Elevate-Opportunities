# 🚀 دليل إعداد وتكامل قاعدة بيانات Supabase السحابية - منصة Elevate

تم ربط مشروعك بنجاح وبشكل احترافي بقاعدة بيانات سحابية متطورة (PostgreSQL) على منصة **Supabase** التابعة لحسابك، ولم تعد البيانات محصورة في متصفحك أو في التخزين المحلي فقط (`localStorage`)، بل أصبحت تعمل مثل كبرى المنصات والمواقع العالمية.

---

## 📌 معلومات المشروع السحابي (Supabase Project Info)

- **اسم المنظمة:** `luxentech's Org`
- **اسم المشروع:** `elevate-platform`
- **معرف المشروع (Project Ref):** `uhjstvlhlkcewmquhrnj`
- **المنطقة (Region):** `eu-central-1` (فرانكفورت - ألمانيا، الأقرب للشرق الأوسط مع أقل زمن استجابة)
- **حالة المشروع:** `ACTIVE_HEALTHY` ✅
- **رابط الـ API السحابي:**  
  `https://uhjstvlhlkcewmquhrnj.supabase.co`

---

## 🗄️ الجداول المنشأة في قاعدة بيانات PostgreSQL (Schema)

تم إنشاء 6 جداول رئيسية مهيأة بالكامل مع فهارس أداء (Indexes) ونظام أمان متقدم (Row Level Security - RLS):

1. **`public.users`**:
   - لتخزين جميع حسابات المنصة (المدير العام، المدرسين، الطلاب).
   - كلمات المرور مشفرة بأحدث معايير التشفير (PBKDF2 مع ملح فريد Salt و SHA-256).
   - تم ترحيل جميع المستخدمين الحاليين (27 حساب) إلى قاعدة البيانات السحابية.

2. **`public.site_store`**:
   - جدول تخزين سحابي فائق السرعة لكافة محتويات وبيانات المنصة:
     - الكورسات (`luxen_courses`)
     - الفرص والمنح (`luxen_general_cards`)
     - الشركاء (`luxen_partners`)
     - التعليقات والردود (`luxen_comments`, `luxen_course_comments`)
     - الإعجابات والتفاعلات (`luxen_likes`, `luxen_views`, `luxen_votes`)
     - الإشعارات (`luxen_notifications`)
     - الإعدادات وحالات الأقسام (`luxen_settings`, `luxen_category_status`)
     - الأسئلة الشائعة والاستفسارات (`luxen_faq`, `luxen_qna`)
     - طلبات استعادة كلمة المرور (`luxen_reset_requests`)

3. **`public.courses`**:
   - جدول مخصص للكورسات والدروس مع بيانات التسعير والمدرب.

4. **`public.opportunities`**:
   - جدول مخصص لمنح وفرص المنصة والفلترة.

5. **`public.partners`**:
   - جدول مخصص لشركاء النجاح.

6. **`public.community_messages`**:
   - جدول مخصص لرسائل وتفاعلات مجتمع Elevate.

---

## 🔐 الأمان والصلاحيات (Row Level Security)

- تم تفعيل **RLS (Row Level Security)** على جميع الجداول.
- المصادقة وإدارة الصلاحيات تتم بالكامل عبر Edge Function (`auth-gateway`) و Supabase Auth JWT.
- الأسرار الإدارية (2FA / Vault / Lockdown) محفوظة ومشفّرة بـ SHA-256 في `app_private.admin_secrets` ولا تظهر في الكود الأمامي.
