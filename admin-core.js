/**
 * =====================================================================
 * Elevate Platform — Admin Core Functions
 * =====================================================================
 * الدوال الأساسية للوحة تحكم المدير
 * =====================================================================
 */

// Create Admin object if not exists
if (typeof window.Admin === 'undefined') {
  window.Admin = {};
}

// Switch between admin sections
Admin.switchSection = function(sectionId) {
  console.log('[Admin] Switching to section:', sectionId);
  
  // Hide all sections
  const sections = document.querySelectorAll('.admin-section');
  sections.forEach(function(section) {
    section.style.display = 'none';
    section.classList.remove('active');
  });
  
  // Remove active class from all nav buttons
  const navButtons = document.querySelectorAll('.admin-nav-btn');
  navButtons.forEach(function(btn) {
    btn.classList.remove('active');
  });
  
  // Show target section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.style.display = 'block';
    targetSection.classList.add('active');
    console.log('[Admin] ✓ Section shown:', sectionId);
  } else {
    console.error('[Admin] ✗ Section not found:', sectionId);
  }
  
  // Add active class to clicked button
  const targetButton = document.querySelector('.admin-nav-btn[data-sec="' + sectionId + '"]');
  if (targetButton) {
    targetButton.classList.add('active');
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Initialize function - محسّن للسرعة
Admin.init = function() {
  console.log('[Admin] تهيئة سريعة...');
  
  // Setup nav buttons - بدون await
  const navButtons = document.querySelectorAll('.admin-nav-btn');
  navButtons.forEach(function(btn) {
    const sectionId = btn.getAttribute('data-sec');
    if (sectionId && !btn.dataset.listenerAdded) {
      btn.dataset.listenerAdded = 'true';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        Admin.switchSection(sectionId);
      });
    }
  });
  
  // Render data lists - فقط اللي موجود
  setTimeout(function() {
    if (typeof Admin.renderManageList === 'function') {
      Admin.renderManageList();
    }
    
    if (typeof Admin.renderPartnersList === 'function') {
      Admin.renderPartnersList();
    }
    
    if (typeof Admin.updateCounters === 'function') {
      Admin.updateCounters();
    }
  }, 50);
  
  console.log('[Admin] ✓ جاهز');
};

console.log('[Admin] Core module loaded');
