# 🚀 Elevate Platform - منصة Elevate للفرص

<div align="center">

![Elevate Logo](images/Elevate.png)

**منصتك الشاملة لاكتشاف الفرص التعليمية والمهنية**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Database](https://img.shields.io/badge/Database-Supabase-green.svg)](https://supabase.com)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)](https://github.com/luxentech/Elevate-Opportunities)

[الموقع المباشر](https://luxentech.github.io/Elevate-Opportunities) • [التوثيق](docs/) • [الدعم](#-الدعم-والمساعدة)

</div>

---

## 📖 نظرة عامة

**Elevate** هي منصة عربية شاملة ومتطورة توفر للطلاب والخريجين إمكانية اكتشاف والتقديم على:

- 🏆 **المسابقات** - مسابقات محلية وعالمية
- 🎓 **المنح الدراسية** - فرص تعليم مجانية وممولة
- 🤝 **فرص التطوع** - برامج تطوعية مؤثرة
- 💼 **الوظائف** - فرص عمل للطلاب والخريجين
- 📚 **الكورسات** - كورسات مجانية ومدفوعة
- 🎬 **الفعاليات والورش** - ورش عمل وفعاليات حية
- ✈️ **فرص السفر** - برامج سفر ممولة
- 👥 **المجتمع** - تواصل مع الطلاب والمهتمين

---

## ✨ المميزات الرئيسية

### 🎯 للمستخدمين
- ✅ واجهة عربية حديثة ومتجاوبة
- ✅ نظام بحث متقدم وفلترة ذكية
- ✅ حفظ الفرص المفضلة والإشعارات
- ✅ نظام تعليقات وتفاعل مجتمعي
- ✅ صفحة شخصية كاملة
- ✅ دعم التسجيل عبر Google

### 🛠️ للإدارة
- ✅ لوحة تحكم شاملة ومتطورة
- ✅ إدارة الفرص والشركاء
- ✅ إدارة المستخدمين والصلاحيات
- ✅ نظام إحصائيات متقدم
- ✅ تحكم كامل في المحتوى
- ✅ نظام أمان متعدد الطبقات (2FA)

### 👨‍🏫 للمدرسين
- ✅ لوحة تحكم مستقلة لرفع الكورسات
- ✅ إدارة الكورسات والاشتراكات
- ✅ متابعة الإحصائيات والتفاعل
- ✅ نظام تعليقات وتقييمات

---

## 🗄️ البنية التقنية

### قاعدة البيانات (Supabase PostgreSQL)

```
📦 Database Schema:
├── 👥 users              - بيانات المستخدمين والصلاحيات
├── 📦 site_store         - بيانات الموقع (فرص، كورسات، إعدادات)
├── 💬 comments           - التعليقات والتفاعلات
├── 🔔 notifications      - الإشعارات
└── 📊 analytics          - الإحصائيات والتحليلات
```

### التقنيات المستخدمة

```
Frontend:
├── HTML5, CSS3, JavaScript (ES6+)
├── Font Awesome 6.5 للأيقونات
├── Google Fonts (Cairo, Inter, Tajawal)
└── Responsive Design (Mobile-First)

Backend & Database:
├── Supabase (PostgreSQL)
├── REST API
├── Real-time Subscriptions
└── Authentication & Authorization

Security:
├── PBKDF2 Password Hashing
├── 2FA للمدراء
├── XSS Protection
├── CSRF Protection
└── Input Sanitization
```

---

## 🚀 التثبيت والتشغيل

### 1️⃣ استنساخ المشروع

```bash
git clone https://github.com/luxentech/Elevate-Opportunities.git
cd Elevate-Opportunities
```

### 2️⃣ فتح الموقع

**الطريقة الأسهل** (يعمل بدون سيرفر):

```bash
# افتح index.html مباشرة في المتصفح
start index.html  # Windows
# أو انقر مرتين على index.html
```

**مع سيرفر محلي** (اختياري):

```bash
# باستخدام Python
python -m http.server 8000

# أو باستخدام Node.js
npx http-server -p 8000

# افتح المتصفح على: http://localhost:8000
```

---

## 🔐 بيانات الدخول الافتراضية

### حساب المدير

```
اسم المستخدم: admin@elevate.com
            أو: admin
            أو: 01000000000

كلمة المرور: Elevate@Admin#2026
رمز 2FA: 2026
```

> ⚠️ **مهم جداً**: غيّر كلمة المرور ورمز 2FA من صفحة الإعدادات بعد أول تسجيل دخول!

### إنشاء حساب مستخدم جديد

1. اذهب إلى صفحة التسجيل
2. املأ البيانات المطلوبة
3. سيتم حفظ حسابك تلقائياً في قاعدة البيانات

---

## 📂 هيكل المشروع

```
Elevate-Opportunities/
├── 📄 index.html                      - الصفحة الرئيسية
├── 📄 login.html                      - صفحة تسجيل الدخول
├── 📄 style.css                       - التنسيقات الرئيسية
├── 📄 script.js                       - البرمجة الرئيسية
│
├── 🗄️ Database Integration
│   ├── supabase-client.js             - عميل Supabase
│   ├── db-sync.js                     - محرك المزامنة
│   └── elevate-security.js            - نظام الأمان
│
├── 🎨 UI Components
│   ├── courses.js                     - قسم الكورسات
│   ├── community.js                   - المجتمع
│   ├── admin-plus.js                  - لوحة التحكم
│   └── profile-plus.js                - الصفحة الشخصية
│
├── 🛠️ Utilities
│   ├── language.js                    - تعدد اللغات
│   ├── lockdown-system.js             - نظام القفل
│   └── opp-filters.js                 - الفلاتر
│
├── 📁 images/                         - الصور والشعارات
│
└── 📚 Documentation
    ├── README.md                      - هذا الملف
    ├── CREDENTIALS.md                 - بيانات الدخول
    ├── OFFLINE-CHANGES.md             - سجل التغييرات
    └── SUPABASE-SETUP.md              - دليل إعداد قاعدة البيانات
```

---

## 🔄 ميزات قاعدة البيانات

### 1. المزامنة التلقائية ☁️
- حفظ فوري لكل تغيير في السحابة
- جلب البيانات المحدثة عند فتح الموقع
- مزامنة ثنائية الاتجاه

### 2. Real-time Updates ⚡
- تحديثات مباشرة عبر جميع الأجهزة
- إشعارات فورية بالتغييرات
- تزامن لحظي للتعليقات والإعجابات

### 3. النسخ الاحتياطي 💾
- نسخ احتياطي تلقائي
- استعادة سهلة للبيانات
- حماية من فقدان البيانات

### 4. الأمان 🔒
- تشفير كلمات المرور (PBKDF2)
- نظام 2FA للمدراء
- حماية من SQL Injection
- Sanitization للمدخلات

---

## 📊 استخدام قاعدة البيانات

### إضافة فرصة جديدة

```javascript
// الفرصة تُحفظ تلقائياً في Supabase
const opportunity = {
  id: "opp_" + Date.now(),
  title: "منحة دراسية كاملة",
  category: "scholarships",
  description: "...",
  deadline: "2026-12-31",
  link: "https://..."
};

localStorage.setItem("luxen_general_cards", JSON.stringify([opportunity]));
// يتم الحفظ تلقائياً في Supabase عبر db-sync.js
```

### جلب البيانات

```javascript
// البيانات تُجلب تلقائياً عند فتح الموقع
// يمكن إعادة المزامنة يدوياً:
await ElevateDB.refresh();
```

---

## 🎓 الاستخدام

### للمستخدمين

1. **التسجيل**: أنشئ حساب مجاني
2. **تصفح الفرص**: استكشف آلاف الفرص
3. **التقديم**: قدم على الفرص المناسبة
4. **المتابعة**: احفظ الفرص وفعّل الإشعارات
5. **التفاعل**: شارك في المجتمع

### للمدراء

1. **تسجيل الدخول**: استخدم حساب المدير
2. **إضافة فرص**: أضف فرص جديدة
3. **إدارة المحتوى**: عدّل وحذف المحتوى
4. **متابعة الإحصائيات**: راقب نشاط الموقع
5. **إدارة المستخدمين**: تحكم بالصلاحيات

### للمدرسين

1. **الدخول للوحة المدرسين**: من القائمة الرئيسية
2. **رفع كورسات**: أضف كورساتك (فيديو + ملفات)
3. **إدارة الاشتراكات**: تفعيل/إلغاء اشتراكات الطلاب
4. **متابعة التفاعل**: مشاهدة الإحصائيات والتعليقات

---

## 🔧 التخصيص والتطوير

### تعديل الألوان

```css
/* في ملف style.css */
:root {
  --primary-color: #6366f1;
  --secondary-color: #38bdf8;
  --accent-color: #10b981;
}
```

### إضافة قسم جديد

1. أنشئ ملف جديد: `my-section.js`
2. أضف التنسيقات: `my-section.css`
3. أضف الملفات في `index.html`
4. سجّل القسم في `script.js`

### إعداد قاعدة بيانات خاصة

راجع ملف [SUPABASE-SETUP.md](SUPABASE-SETUP.md) للتفاصيل الكاملة.

---

## 🐛 معالجة المشاكل الشائعة

### المشكلة: البيانات لا تُحفظ

**الحل**:
1. تأكد من اتصال الإنترنت
2. افتح Developer Console (F12) وتحقق من الأخطاء
3. تأكد من صحة إعدادات Supabase في `supabase-client.js`

### المشكلة: لا أستطيع تسجيل الدخول

**الحل**:
1. تأكد من صحة اسم المستخدم وكلمة المرور
2. امسح cache المتصفح
3. تحقق من Developer Console
4. راجع ملف [CREDENTIALS.md](CREDENTIALS.md)

### المشكلة: الكورسات لا تظهر

**الحل**:
1. تحقق من وجود كورسات في قاعدة البيانات
2. افحص Developer Console للأخطاء
3. أعد تحميل الصفحة (Ctrl+F5)

---

## 🔐 الأمان والخصوصية

### تدابير الأمان المُطبقة

✅ **تشفير كلمات المرور**: PBKDF2-SHA256 (100,000 iterations)  
✅ **نظام 2FA**: رمز تحقق إضافي للمدراء  
✅ **حماية XSS**: تنظيف جميع المدخلات  
✅ **CSRF Protection**: حماية من الطلبات المزورة  
✅ **Input Validation**: التحقق من صحة البيانات  
✅ **Session Management**: إدارة آمنة للجلسات  
✅ **Rate Limiting**: حماية من الهجمات  

### أفضل الممارسات

- 🔒 غيّر كلمات المرور بشكل دوري
- 🔑 لا تشارك بيانات المدير
- 💾 احفظ نسخ احتياطية منتظمة
- 🔄 حدّث الموقع بانتظام
- 📊 راقب سجلات الأمان

---

## 🤝 المساهمة

نرحب بمساهماتكم! إذا كنت ترغب في المساهمة:

1. Fork المشروع
2. أنشئ branch جديد (`git checkout -b feature/AmazingFeature`)
3. Commit تغييراتك (`git commit -m 'Add some AmazingFeature'`)
4. Push للـ branch (`git push origin feature/AmazingFeature`)
5. افتح Pull Request

### مجالات المساهمة المطلوبة

- 🐛 إصلاح الأخطاء
- ✨ إضافة ميزات جديدة
- 📝 تحسين التوثيق
- 🎨 تحسين التصميم
- 🌍 إضافة لغات جديدة
- ⚡ تحسين الأداء

---

## 📄 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Luxen Tech

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🆘 الدعم والمساعدة

### تواصل معنا

📧 **البريد الإلكتروني**: contact.luxentech@gmail.com  
💬 **واتساب**: [+20 112 431 0907](https://wa.me/201124310907)  
🌐 **الموقع**: [elevate-platform.com](#)  
💼 **LinkedIn**: [Luxen Tech](#)  

### روابط مفيدة

- [📚 التوثيق الكامل](docs/)
- [🐛 الإبلاغ عن مشكلة](https://github.com/luxentech/Elevate-Opportunities/issues)
- [💡 طلب ميزة جديدة](https://github.com/luxentech/Elevate-Opportunities/issues/new)
- [❓ الأسئلة الشائعة](docs/FAQ.md)

---

## 🙏 شكر وتقدير

نشكر جميع من ساهم في تطوير هذا المشروع:

- 👨‍💻 **فريق Luxen Tech** - التطوير والتصميم
- 🎨 **المصممين** - الواجهة والتجربة
- 🧪 **المختبرين** - ضمان الجودة
- 👥 **المجتمع** - الملاحظات والاقتراحات

---

## 📅 خارطة الطريق

### النسخة الحالية (v1.0.0) ✅
- ✅ قاعدة بيانات Supabase
- ✅ نظام أمان متقدم
- ✅ لوحة تحكم شاملة
- ✅ نظام الكورسات
- ✅ المجتمع والتفاعل

### القادم (v1.1.0) 🚀
- 📱 تطبيق موبايل (React Native)
- 🤖 مساعد ذكي AI محسّن
- 📊 تحليلات متقدمة
- 🔔 نظام إشعارات push
- 🌍 دعم لغات إضافية

### المستقبل (v2.0.0) 🌟
- 💳 نظام دفع إلكتروني
- 🎓 شهادات رقمية
- 🏆 نظام نقاط ومكافآت
- 📹 بث مباشر محسّن
- 🤝 شراكات جامعية

---

## 📊 الإحصائيات

<div align="center">

| المقياس | القيمة |
|---------|--------|
| 👥 المستخدمين | 1000+ |
| 🎯 الفرص | 500+ |
| 📚 الكورسات | 100+ |
| ⭐ التقييم | 4.8/5 |

</div>

---

<div align="center">

### صُنع بـ ❤️ في مصر

**Elevate Platform** © 2026 [Luxen Tech](https://github.com/luxentech)

[⬆ العودة للأعلى](#-elevate-platform---منصة-elevate-للفرص)

</div>
