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

// Initialize function
Admin.init = function() {
  console.log('[Admin] Core initialized');
  
  // Setup nav button click handlers
  const navButtons = document.querySelectorAll('.admin-nav-btn');
  navButtons.forEach(function(btn) {
    const sectionId = btn.getAttribute('data-sec');
    if (sectionId) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        Admin.switchSection(sectionId);
      });
    }
  });
  
  // Render admin data lists
  if (typeof Admin.renderManageList === 'function') {
    console.log('[Admin] Rendering opportunities list...');
    Admin.renderManageList();
  }
  
  if (typeof Admin.renderDatedList === 'function') {
    console.log('[Admin] Rendering dated opportunities...');
    Admin.renderDatedList();
  }
  
  if (typeof Admin.renderUndatedList === 'function') {
    console.log('[Admin] Rendering undated opportunities...');
    Admin.renderUndatedList();
  }
  
  if (typeof Admin.updateCounters === 'function') {
    console.log('[Admin] Updating counters...');
    Admin.updateCounters();
  }
  
  // Initialize admin sections that need data
  if (typeof AdminTeachersApp !== 'undefined' && typeof AdminTeachersApp.init === 'function') {
    console.log('[Admin] Initializing teachers management...');
    AdminTeachersApp.init();
  }
  
  // Show first section by default
  setTimeout(function() {
    const firstSection = document.querySelector('.admin-section');
    if (firstSection && firstSection.id) {
      Admin.switchSection(firstSection.id);
    }
  }, 100);
  
  console.log('[Admin] ✓ Initialization complete');
};

console.log('[Admin] Core module loaded');
