/**
 * =====================================================================
 * Desktop Mode Toggle for Mobile
 * =====================================================================
 * زرار للتبديل بين mobile view و desktop view على الموبايل
 * =====================================================================
 */

(function() {
  'use strict';
  
  // Check if mobile
  function isMobile() {
    return window.innerWidth <= 768;
  }
  
  // Create toggle button
  function createToggleButton() {
    if (!isMobile()) return;
    
    const button = document.createElement('button');
    button.className = 'desktop-mode-toggle';
    button.innerHTML = '<i class="fas fa-desktop"></i><span>عرض الكمبيوتر</span>';
    button.setAttribute('aria-label', 'Toggle desktop mode');
    
    // Check saved preference
    const isDesktopMode = localStorage.getItem('force_desktop_mode') === 'true';
    
    if (isDesktopMode) {
      document.body.classList.add('force-desktop-mode');
      button.innerHTML = '<i class="fas fa-mobile-screen-button"></i><span>عرض الموبايل</span>';
    }
    
    // Toggle on click
    button.addEventListener('click', function() {
      const currentMode = document.body.classList.contains('force-desktop-mode');
      
      if (currentMode) {
        // Switch to mobile mode
        document.body.classList.remove('force-desktop-mode');
        localStorage.setItem('force_desktop_mode', 'false');
        button.innerHTML = '<i class="fas fa-desktop"></i><span>عرض الكمبيوتر</span>';
        
        // Reset viewport
        let viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
        }
      } else {
        // Switch to desktop mode
        document.body.classList.add('force-desktop-mode');
        localStorage.setItem('force_desktop_mode', 'true');
        button.innerHTML = '<i class="fas fa-mobile-screen-button"></i><span>عرض الموبايل</span>';
        
        // Set desktop viewport
        let viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=1024');
        }
      }
      
      // Show notification
      showModeNotification(currentMode ? 'تم التبديل لعرض الموبايل' : 'تم التبديل لعرض الكمبيوتر');
    });
    
    document.body.appendChild(button);
  }
  
  // Show notification
  function showModeNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      color: #38bdf8;
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.3);
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      opacity: 0;
      transition: all 0.3s ease;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggleButton);
  } else {
    createToggleButton();
  }
  
})();
