/**
 * =====================================================================
 * Elevate Platform — Data Health & Cache Guard
 * =====================================================================
 * يضمن تكامل الذاكرة المؤقتة ومزامنتها بسلام مع سحابة Supabase
 * =====================================================================
 */

(function() {
  'use strict';

  // Fast manual recovery trigger if user explicitly requests it
  async function triggerCloudRefresh() {
    if (window.ElevateDB && typeof window.ElevateDB.refresh === 'function') {
      console.log('[ElevateGuard] 🔄 تحديث البيانات من السحابة...');
      return await window.ElevateDB.refresh();
    }
  }

  window.ElevateRecovery = {
    forceRecovery: triggerCloudRefresh,
    hasData: function() {
      try {
        var cards = localStorage.getItem('luxen_general_cards');
        return cards !== null;
      } catch (e) {
        return false;
      }
    }
  };

  console.log('[ElevateGuard] Guard system active');
})();
