/**
 * =====================================================================
 * Elevate Platform — Automatic Data Recovery System (Optimized)
 * =====================================================================
 * نظام استرجاع تلقائي محسّن - سريع وخفيف
 * =====================================================================
 */

(function() {
  'use strict';

  const RECOVERY_CONFIG = {
    checkInterval: 60000, // فحص كل دقيقة بدل 30 ثانية
    minDataThreshold: 1,
    supabaseUrl: 'https://uhjstvlhlkcewmquhrnj.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoanN0dmxobGtjZXdtcXVocm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNzU3MDUsImV4cCI6MjExMDk1MTcwNX0.XpTZ-mxoY89WDcQ4dYzubev65hcxFOJ67iK7ikoVNuA'
  };

  const CRITICAL_KEYS = ['luxen_general_cards', 'luxen_all_users', 'luxen_partners'];
  
  let recoveryInProgress = false;
  let lastCheckTime = 0;

  // ============================================
  // Simple Data Check
  // ============================================

  function hasData() {
    try {
      const cards = localStorage.getItem('luxen_general_cards');
      return cards && JSON.parse(cards).length > 0;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // Fast Recovery from Supabase
  // ============================================

  async function quickRecovery() {
    if (recoveryInProgress || hasData()) return;
    
    recoveryInProgress = true;
    console.log('[Recovery] 🔄 استرجاع سريع...');
    
    try {
      const response = await fetch(`${RECOVERY_CONFIG.supabaseUrl}/rest/v1/site_store?select=*`, {
        headers: {
          'apikey': RECOVERY_CONFIG.supabaseKey,
          'Authorization': `Bearer ${RECOVERY_CONFIG.supabaseKey}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.key && item.value) {
              const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
              localStorage.setItem(item.key, value);
            }
          });
          
          console.log('[Recovery] ✅ تم الاسترجاع');
          
          // Re-render
          setTimeout(() => {
            if (window.App?.renderOpportunities) App.renderOpportunities();
            if (window.Admin?.renderManageList) Admin.renderManageList();
            if (window.Admin?.renderPartnersList) Admin.renderPartnersList();
          }, 100);
        }
      }
    } catch (e) {
      console.warn('[Recovery] فشل:', e.message);
    } finally {
      recoveryInProgress = false;
    }
  }

  // ============================================
  // Periodic Check (Light)
  // ============================================

  function lightCheck() {
    const now = Date.now();
    if (now - lastCheckTime < RECOVERY_CONFIG.checkInterval) return;
    
    lastCheckTime = now;
    
    if (!hasData()) {
      quickRecovery();
    }
  }

  // ============================================
  // Initialize
  // ============================================

  function init() {
    // Initial check
    if (!hasData()) {
      console.log('[Recovery] 🚀 لا توجد بيانات - بدء الاسترجاع...');
      quickRecovery();
    }
    
    // Periodic light checks
    setInterval(lightCheck, RECOVERY_CONFIG.checkInterval);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Public API
  window.ElevateRecovery = {
    forceRecovery: quickRecovery,
    hasData: hasData
  };

})();

