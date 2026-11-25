/**
 * =====================================================================
 * Elevate Platform — Admin Core Functions (Speed & Navigation Engine)
 * =====================================================================
 * يضمن التنقل الفوري اللحظي بين أقسام لوحة الإدارة وتحديث القوائم والشركاء فوراً
 * =====================================================================
 */

if (typeof window.Admin === 'undefined') {
  window.Admin = {};
}

// Ensure alias between renderManagePartners and renderPartnersList
Admin.renderPartnersList = function() {
  if (typeof Admin.renderManagePartners === 'function') {
    Admin.renderManagePartners();
  }
};

// Switch between admin sections with instant dynamic rendering
Admin.switchSection = function(sectionId) {
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
  }
  
  // Add active class to clicked button
  const targetButton = document.querySelector('.admin-nav-btn[data-sec="' + sectionId + '"]');
  if (targetButton) {
    targetButton.classList.add('active');
  }
  
  // Render section data immediately
  try {
    if (sectionId === 'adm-sec-opps') {
      if (typeof Admin.renderManageList === 'function') Admin.renderManageList();
    } else if (sectionId === 'adm-sec-partners') {
      if (typeof Admin.renderManagePartners === 'function') Admin.renderManagePartners();
    } else if (sectionId === 'adm-sec-dates') {
      if (typeof Admin.renderDatedList === 'function') Admin.renderDatedList();
      if (typeof Admin.renderUndatedList === 'function') Admin.renderUndatedList();
    } else if (sectionId === 'adm-sec-members') {
      if (typeof Admin.renderMembers === 'function') Admin.renderMembers();
    } else if (sectionId === 'adm-sec-team') {
      if (typeof Admin.renderTeam === 'function') Admin.renderTeam();
    } else if (sectionId === 'adm-sec-visibility') {
      if (typeof Admin.renderSectionsVisibility === 'function') Admin.renderSectionsVisibility();
    } else if (sectionId === 'adm-sec-vault' && window.CommunityAdmin && typeof CommunityAdmin.render === 'function') {
      CommunityAdmin.render();
    } else if (sectionId === 'adm-sec-teachers' && window.AdminTeachersApp && typeof AdminTeachersApp.init === 'function') {
      AdminTeachersApp.init();
    } else if (sectionId === 'adm-sec-lockdown' && window.ElevateLockdown && typeof ElevateLockdown.renderAdminSectionUI === 'function') {
      ElevateLockdown.renderAdminSectionUI();
    }

    if (typeof Admin.updateCounters === 'function') {
      Admin.updateCounters();
    }
  } catch (e) {
    console.warn('[Admin] Render section notice:', e);
  }

  // Smooth scroll to top of panel
  try {
    const container = document.getElementById('prof-admin-tab');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (e) {}
};

// Master Admin.init
Admin.init = function() {
  console.log('[Admin] تهيئة سريعة وشاملة...');
  
  // Setup nav buttons listeners
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

  // Render everything immediately (0ms)
  try {
    if (typeof Admin.updateCounters === 'function') Admin.updateCounters();
    if (typeof Admin.renderManageList === 'function') Admin.renderManageList();
    if (typeof Admin.renderDatedList === 'function') Admin.renderDatedList();
    if (typeof Admin.renderUndatedList === 'function') Admin.renderUndatedList();
    if (typeof Admin.renderManagePartners === 'function') Admin.renderManagePartners();
    if (typeof Admin.renderMembers === 'function') Admin.renderMembers();
    if (typeof Admin.renderTeam === 'function') Admin.renderTeam();
    if (typeof Admin.renderSectionsVisibility === 'function') Admin.renderSectionsVisibility();
    if (window.AdminTeachersApp && typeof AdminTeachersApp.init === 'function') AdminTeachersApp.init();
  } catch (e) {
    console.warn('[Admin] Init render error:', e);
  }
};

console.log('[Admin] Core module loaded with full navigation');
