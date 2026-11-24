/**
 * =====================================================================
 * Elevate Platform — Automatic Data Recovery System
 * =====================================================================
 * نظام استرجاع تلقائي للبيانات - يضمن عدم فقدان البيانات أبداً
 * 
 * الميزات:
 * 1. فحص دوري كل 30 ثانية للتأكد من وجود البيانات
 * 2. استرجاع تلقائي من Supabase إذا فقدت البيانات
 * 3. نسخ احتياطية محلية في IndexedDB
 * 4. إعادة محاولة ذكية في حالة الفشل
 * 5. تنبيهات للمدير في حالة المشاكل
 * =====================================================================
 */

(function() {
  'use strict';

  const RECOVERY_CONFIG = {
    checkInterval: 30000, // فحص كل 30 ثانية
    retryAttempts: 3, // عدد المحاولات
    retryDelay: 5000, // 5 ثواني بين كل محاولة
    minDataThreshold: 1, // الحد الأدنى للبيانات
    supabaseUrl: 'https://uhjstvlhlkcewmquhrnj.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoanN0dmxobGtjZXdtcXVocm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNzU3MDUsImV4cCI6MjExMDk1MTcwNX0.XpTZ-mxoY89WDcQ4dYzubev65hcxFOJ67iK7ikoVNuA'
  };

  const CRITICAL_KEYS = [
    'luxen_general_cards',
    'luxen_all_users',
    'luxen_partners',
    'luxen_courses'
  ];

  let recoveryInProgress = false;
  let lastCheckTime = 0;
  let consecutiveFailures = 0;

  // ============================================
  // IndexedDB Backup System
  // ============================================
  
  let db = null;

  async function initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ElevateBackup', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'key' });
        }
      };
    });
  }

  async function saveToIndexedDB(key, value) {
    if (!db) await initIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['backups'], 'readwrite');
      const store = transaction.objectStore('backups');
      const request = store.put({
        key: key,
        value: value,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function getFromIndexedDB(key) {
    if (!db) await initIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['backups'], 'readonly');
      const store = transaction.objectStore('backups');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Data Validation
  // ============================================

  function validateData(key, data) {
    if (!data) return false;
    
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (key === 'luxen_general_cards' || key === 'luxen_all_users' || 
          key === 'luxen_partners' || key === 'luxen_courses') {
        return Array.isArray(parsed) && parsed.length >= RECOVERY_CONFIG.minDataThreshold;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  function checkDataIntegrity() {
    const issues = [];
    
    CRITICAL_KEYS.forEach(key => {
      const data = localStorage.getItem(key);
      
      if (!data) {
        issues.push(`${key}: مفقود تماماً`);
      } else if (!validateData(key, data)) {
        issues.push(`${key}: بيانات تالفة أو فارغة`);
      }
    });
    
    return {
      healthy: issues.length === 0,
      issues: issues,
      timestamp: Date.now()
    };
  }

  // ============================================
  // Recovery from Supabase
  // ============================================

  async function fetchFromSupabase(endpoint) {
    const response = await fetch(`${RECOVERY_CONFIG.supabaseUrl}/rest/v1/${endpoint}?select=*`, {
      headers: {
        'apikey': RECOVERY_CONFIG.supabaseKey,
        'Authorization': `Bearer ${RECOVERY_CONFIG.supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }
    
    return await response.json();
  }

  async function recoverFromSupabase(attempt = 1) {
    console.log(`[Recovery] 🔄 محاولة استرجاع البيانات (${attempt}/${RECOVERY_CONFIG.retryAttempts})...`);
    
    try {
      // 1. Fetch Store Data
      const storeData = await fetchFromSupabase('site_store');
      let recoveredKeys = 0;
      
      if (Array.isArray(storeData)) {
        for (const item of storeData) {
          if (item.key && item.value) {
            const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
            localStorage.setItem(item.key, value);
            
            // Backup to IndexedDB
            await saveToIndexedDB(item.key, value).catch(e => console.warn('IndexedDB backup failed:', e));
            
            recoveredKeys++;
          }
        }
      }
      
      // 2. Fetch Users
      const usersData = await fetchFromSupabase('users');
      
      if (Array.isArray(usersData)) {
        const mappedUsers = usersData.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email || '',
          phone: u.phone || '',
          fullName: u.full_name || u.username,
          full_name: u.full_name || u.username,
          password_hash: u.password_hash || '',
          isAdmin: Boolean(u.is_admin),
          isTeacher: Boolean(u.is_teacher),
          isActive: Boolean(u.is_active),
          provider: u.provider || 'credentials',
          avatar: u.avatar || '',
          join_date: u.join_date || '',
          last_login: u.last_login || Date.now()
        }));
        
        localStorage.setItem('luxen_all_users', JSON.stringify(mappedUsers));
        await saveToIndexedDB('luxen_all_users', JSON.stringify(mappedUsers)).catch(e => {});
        recoveredKeys++;
      }
      
      console.log(`[Recovery] ✅ تم استرجاع ${recoveredKeys} مفتاح بنجاح من Supabase`);
      
      // Re-render UI
      if (window.App && typeof App.renderOpportunities === 'function') {
        App.renderOpportunities();
      }
      if (window.Admin && typeof Admin.renderManageList === 'function') {
        Admin.renderManageList();
      }
      
      consecutiveFailures = 0;
      return true;
      
    } catch (error) {
      console.error(`[Recovery] ❌ فشل الاسترجاع (محاولة ${attempt}):`, error);
      
      if (attempt < RECOVERY_CONFIG.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, RECOVERY_CONFIG.retryDelay));
        return await recoverFromSupabase(attempt + 1);
      }
      
      consecutiveFailures++;
      return false;
    }
  }

  // ============================================
  // Recovery from IndexedDB
  // ============================================

  async function recoverFromIndexedDB() {
    console.log('[Recovery] 💾 محاولة الاسترجاع من IndexedDB...');
    
    try {
      let recoveredKeys = 0;
      
      for (const key of CRITICAL_KEYS) {
        const backup = await getFromIndexedDB(key);
        
        if (backup && validateData(key, backup)) {
          localStorage.setItem(key, backup);
          recoveredKeys++;
        }
      }
      
      if (recoveredKeys > 0) {
        console.log(`[Recovery] ✅ تم استرجاع ${recoveredKeys} مفتاح من IndexedDB`);
        return true;
      }
      
      console.warn('[Recovery] ⚠️ لا توجد نسخ احتياطية صالحة في IndexedDB');
      return false;
      
    } catch (error) {
      console.error('[Recovery] ❌ فشل الاسترجاع من IndexedDB:', error);
      return false;
    }
  }

  // ============================================
  // Auto Backup System
  // ============================================

  function setupAutoBackup() {
    // Backup on every localStorage write
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      originalSetItem(key, value);
      
      if (CRITICAL_KEYS.includes(key)) {
        saveToIndexedDB(key, value).catch(e => 
          console.warn(`[Backup] فشل حفظ ${key} في IndexedDB:`, e)
        );
      }
    };
    
    console.log('[Recovery] ✓ نظام النسخ الاحتياطي التلقائي مفعّل');
  }

  // ============================================
  // Periodic Health Check
  // ============================================

  async function performHealthCheck() {
    if (recoveryInProgress) {
      console.log('[Recovery] ⏳ استرجاع قيد التنفيذ، تخطي الفحص');
      return;
    }
    
    const now = Date.now();
    if (now - lastCheckTime < RECOVERY_CONFIG.checkInterval) {
      return;
    }
    
    lastCheckTime = now;
    
    const health = checkDataIntegrity();
    
    if (!health.healthy) {
      console.warn('[Recovery] ⚠️ تم اكتشاف مشاكل في البيانات:', health.issues);
      
      recoveryInProgress = true;
      
      // Try IndexedDB first (faster)
      let recovered = await recoverFromIndexedDB();
      
      // If IndexedDB fails, try Supabase
      if (!recovered) {
        recovered = await recoverFromSupabase();
      }
      
      if (recovered) {
        // Verify recovery
        const afterRecovery = checkDataIntegrity();
        
        if (afterRecovery.healthy) {
          console.log('[Recovery] ✅ تم استرجاع البيانات بنجاح وتم التحقق من سلامتها');
          
          // Notify admin if logged in
          notifyAdmin('تم استرجاع البيانات تلقائياً بنجاح ✅');
        } else {
          console.error('[Recovery] ❌ فشل التحقق من البيانات بعد الاسترجاع');
          notifyAdmin('فشل استرجاع البيانات - يرجى التواصل مع الدعم الفني ⚠️', true);
        }
      } else {
        console.error('[Recovery] ❌ فشل استرجاع البيانات من جميع المصادر');
        notifyAdmin('فشل حاسم في استرجاع البيانات! يرجى التواصل الفوري مع الدعم الفني 🚨', true);
      }
      
      recoveryInProgress = false;
    }
    
    // Alert if too many consecutive failures
    if (consecutiveFailures >= 3) {
      console.error('[Recovery] 🚨 تحذير: 3 محاولات فاشلة متتالية!');
      notifyAdmin('تحذير: مشكلة متكررة في النظام - يرجى التحقق من الاتصال بالإنترنت 🚨', true);
    }
  }

  // ============================================
  // Admin Notification
  // ============================================

  function notifyAdmin(message, isError = false) {
    // Check if user is admin
    try {
      const user = JSON.parse(localStorage.getItem('ns_user') || 'null');
      if (!user || !user.isAdmin) return;
      
      // Show notification in UI
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isError ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 999999;
        max-width: 400px;
        font-weight: 600;
        animation: slideIn 0.3s ease;
      `;
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <i class="fas fa-${isError ? 'exclamation-triangle' : 'check-circle'}" style="font-size: 24px;"></i>
          <div>
            <div style="font-size: 14px; opacity: 0.9;">نظام استرجاع البيانات</div>
            <div style="font-size: 16px; margin-top: 4px;">${message}</div>
          </div>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }, isError ? 10000 : 5000);
      
    } catch (e) {
      console.warn('[Recovery] فشل إرسال الإشعار للمدير:', e);
    }
  }

  // ============================================
  // Initialize Recovery System
  // ============================================

  async function init() {
    console.log('[Recovery] 🚀 تهيئة نظام الاسترجاع التلقائي...');
    
    try {
      // Initialize IndexedDB
      await initIndexedDB();
      console.log('[Recovery] ✓ IndexedDB جاهز');
      
      // Setup auto backup
      setupAutoBackup();
      
      // Initial health check
      const initialHealth = checkDataIntegrity();
      console.log('[Recovery] الحالة الأولية:', initialHealth.healthy ? '✅ سليمة' : '⚠️ تحتاج إصلاح');
      
      if (!initialHealth.healthy) {
        console.warn('[Recovery] مشاكل مكتشفة عند البدء:', initialHealth.issues);
        await performHealthCheck();
      }
      
      // Start periodic checks
      setInterval(performHealthCheck, RECOVERY_CONFIG.checkInterval);
      console.log(`[Recovery] ✓ الفحص الدوري مفعّل (كل ${RECOVERY_CONFIG.checkInterval / 1000} ثانية)`);
      
      // Backup critical data now
      for (const key of CRITICAL_KEYS) {
        const data = localStorage.getItem(key);
        if (data && validateData(key, data)) {
          await saveToIndexedDB(key, data).catch(e => {});
        }
      }
      console.log('[Recovery] ✓ تم إنشاء نسخة احتياطية أولية');
      
      console.log('[Recovery] ✅ النظام جاهز ويعمل');
      
    } catch (error) {
      console.error('[Recovery] ❌ فشل تهيئة النظام:', error);
    }
  }

  // ============================================
  // Start System
  // ============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================
  // Public API
  // ============================================

  window.ElevateRecovery = {
    checkHealth: checkDataIntegrity,
    forceRecovery: async () => {
      recoveryInProgress = true;
      const result = await recoverFromSupabase();
      recoveryInProgress = false;
      return result;
    },
    getStats: () => ({
      consecutiveFailures,
      lastCheckTime,
      recoveryInProgress,
      dbReady: !!db
    })
  };

})();

console.log('✅ [Elevate Recovery System] نظام الاسترجاع التلقائي محمّل ومفعّل');
