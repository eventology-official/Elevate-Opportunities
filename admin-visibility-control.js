/* ==========================================
   Elevate - نظام التحكم المباشر في ظهور العناصر للمدير
   ========================================== */

(function() {
  'use strict';

  // مفتاح التخزين
  const STORAGE_KEY = 'elevate_element_visibility';

  // حالات العناصر
  const STATES = {
    VISIBLE: 'visible',    // ظاهر
    COMING: 'coming',      // قريباً
    HIDDEN: 'hidden'       // مخفي
  };

  // ==========================================
  // إدارة حالات العناصر
  // ==========================================
  const VisibilityManager = {
    
    // قراءة جميع الحالات
    getAll() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      } catch(e) {
        return {};
      }
    },

    // حفظ جميع الحالات
    saveAll(states) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
      } catch(e) {
        console.error('Failed to save visibility states:', e);
      }
    },

    // الحصول على حالة عنصر معين
    getState(elementId) {
      const states = this.getAll();
      return states[elementId] || STATES.VISIBLE;
    },

    // تعيين حالة عنصر
    setState(elementId, state) {
      const states = this.getAll();
      states[elementId] = state;
      this.saveAll(states);
    },

    // حذف حالة عنصر (إرجاع للافتراضي)
    removeState(elementId) {
      const states = this.getAll();
      delete states[elementId];
      this.saveAll(states);
    }
  };

  // ==========================================
  // التحقق من صلاحيات المدير
  // ==========================================
  function isAdmin() {
    try {
      const user = JSON.parse(localStorage.getItem('ns_user') || 'null');
      return !!(user && user.isAdmin);
    } catch(e) {
      return false;
    }
  }

  // ==========================================
  // إنشاء أزرار التحكم
  // ==========================================
  function createControlButtons(element, elementId) {
    const currentState = VisibilityManager.getState(elementId);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-visibility-controls';
    wrapper.setAttribute('data-element-id', elementId);
    
    wrapper.innerHTML = `
      <div class="avc-buttons">
        <button class="avc-btn avc-btn-visible ${currentState === STATES.VISIBLE ? 'active' : ''}" 
                data-state="${STATES.VISIBLE}" 
                title="إظهار">
          <i class="fas fa-eye"></i>
          <span>إظهار</span>
        </button>
        <button class="avc-btn avc-btn-coming ${currentState === STATES.COMING ? 'active' : ''}" 
                data-state="${STATES.COMING}" 
                title="قريباً">
          <i class="fas fa-clock"></i>
          <span>قريباً</span>
        </button>
        <button class="avc-btn avc-btn-hidden ${currentState === STATES.HIDDEN ? 'active' : ''}" 
                data-state="${STATES.HIDDEN}" 
                title="إخفاء">
          <i class="fas fa-eye-slash"></i>
          <span>إخفاء</span>
        </button>
      </div>
    `;

    // إضافة مستمعي الأحداث
    wrapper.querySelectorAll('.avc-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const newState = this.getAttribute('data-state');
        handleStateChange(element, elementId, newState);
      });
    });

    return wrapper;
  }

  // ==========================================
  // معالجة تغيير الحالة
  // ==========================================
  function handleStateChange(element, elementId, newState) {
    // حفظ الحالة
    VisibilityManager.setState(elementId, newState);

    // تحديث الأزرار
    const controls = document.querySelector(`.admin-visibility-controls[data-element-id="${elementId}"]`);
    if (controls) {
      controls.querySelectorAll('.avc-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-state') === newState);
      });
    }

    // تطبيق الحالة على العنصر
    applyState(element, elementId, newState);
  }

  // ==========================================
  // تطبيق الحالة على العنصر
  // ==========================================
  function applyState(element, elementId, state) {
    // إزالة badge قريباً القديم
    const oldBadge = element.querySelector('.coming-soon-badge');
    if (oldBadge) oldBadge.remove();

    element.classList.remove('avc-visible', 'avc-coming', 'avc-hidden');
    element.removeAttribute('data-avc-state');

    switch(state) {
      case STATES.VISIBLE:
        element.classList.add('avc-visible');
        element.setAttribute('data-avc-state', 'visible');
        element.style.display = '';
        element.style.opacity = '';
        element.style.pointerEvents = ''; // ✅ تفعيل التفاعل
        element.style.filter = ''; // ✅ إزالة أي فلاتر
        break;

      case STATES.COMING:
        element.classList.add('avc-coming');
        element.setAttribute('data-avc-state', 'coming');
        element.style.display = '';
        element.style.pointerEvents = ''; // ✅ السماح بالضغط على الأزرار
        
        // إضافة badge "قريباً"
        const badge = document.createElement('div');
        badge.className = 'coming-soon-badge';
        badge.innerHTML = '<i class="fas fa-clock"></i> قريباً';
        
        // البحث عن أفضل مكان لإضافة الـ badge
        const header = element.querySelector('h1, h2, h3, h4, h5, h6, .card-title, .section-title');
        if (header && header.parentElement) {
          header.parentElement.style.position = 'relative';
          header.parentElement.insertBefore(badge, header.nextSibling);
        } else {
          element.style.position = 'relative';
          element.insertBefore(badge, element.firstChild);
        }
        
        // تطبيق مظهر "قريباً" فقط على المحتوى (مش على الأزرار!)
        element.style.opacity = '0.6';
        
        // تعطيل التفاعل مع المحتوى فقط (مش الأزرار!)
        const allChildren = element.querySelectorAll('*:not(.admin-visibility-controls):not(.admin-visibility-controls *)');
        allChildren.forEach(child => {
          if (!child.classList.contains('admin-visibility-controls')) {
            child.style.pointerEvents = 'none';
          }
        });
        break;

      case STATES.HIDDEN:
        element.classList.add('avc-hidden');
        element.setAttribute('data-avc-state', 'hidden');
        
        // إخفاء كل المحتوى إلا أزرار التحكم
        const allChildrenExceptControls = Array.from(element.children).filter(
          child => !child.classList.contains('admin-visibility-controls')
        );
        allChildrenExceptControls.forEach(child => {
          child.style.display = 'none';
        });
        
        // الأزرار تفضل ظاهرة
        const controls = element.querySelector('.admin-visibility-controls');
        if (controls) {
          controls.style.display = 'flex';
          controls.style.position = 'relative';
        }
        
        // العنصر نفسه يكون شبه شفاف
        element.style.opacity = '0.3';
        element.style.minHeight = '60px'; // عشان الأزرار تظهر
        element.style.pointerEvents = '';
        element.style.filter = '';
        break;
    }
  }

  // ==========================================
  // إضافة أزرار التحكم للعناصر
  // ==========================================
  function addControlsToElements() {
    if (!isAdmin()) return;

    // تحديد العناصر المستهدفة
    const selectors = [
      // الأقسام الرئيسية
      'section[id]',
      // البطاقات
      '.opportunity-card',
      '.card',
      '.partner-card',
      '.course-card',
      '.profile-card',
      // الأزرار الكبيرة
      '.feature-box',
      '.service-box',
      // رسائل المجتمع - جميع الأنواع
      '.community-message',
      '.community-post',
      '.message-item',
      '.comm-msg',
      '.chat-message',
      // المنشورات والتعليقات
      '.post-card',
      '.comment-item',
      // أي عنصر له معرف
      '[data-controllable="true"]'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));

    elements.forEach((element, index) => {
      // تخطي العناصر التي لها أزرار بالفعل
      if (element.querySelector('.admin-visibility-controls')) return;
      
      // تخطي عناصر لوحة التحكم نفسها
      if (element.closest('#prof-admin-tab, .admin-section')) return;

      // إنشاء معرف فريد
      let elementId = element.id || element.getAttribute('data-element-id');
      if (!elementId) {
        const className = element.className.split(' ')[0] || 'element';
        elementId = `avc-${className}-${index}-${Date.now()}`;
        element.setAttribute('data-element-id', elementId);
      }

      // إنشاء وإض��فة أزرار التحكم
      const controls = createControlButtons(element, elementId);
      
      // إضافة الأزرار في أول العنصر
      element.style.position = 'relative';
      element.insertBefore(controls, element.firstChild);

      // تطبيق الحالة المحفوظة
      const savedState = VisibilityManager.getState(elementId);
      applyState(element, elementId, savedState);
    });
  }

  // ==========================================
  // تطبيق الحالات للمستخدمين العاديين
  // ==========================================
  function applyStatesForUsers() {
    if (isAdmin()) return; // المدير يشوف كل حاجة

    const states = VisibilityManager.getAll();
    
    Object.keys(states).forEach(elementId => {
      const state = states[elementId];
      const element = document.querySelector(`[data-element-id="${elementId}"], #${elementId}`);
      
      if (element && state !== STATES.VISIBLE) {
        if (state === STATES.HIDDEN) {
          // ✅ للمستخدمين العاديين: إخفاء تام
          element.style.display = 'none';
        } else if (state === STATES.COMING) {
          // إظهار "قريباً" للمستخدمين
          element.style.opacity = '0.7';
          element.style.pointerEvents = 'none';
          
          const badge = document.createElement('div');
          badge.className = 'coming-soon-badge';
          badge.innerHTML = '<i class="fas fa-clock"></i> قريباً';
          
          const header = element.querySelector('h1, h2, h3, h4, h5, h6, .card-title');
          if (header && header.parentElement) {
            header.parentElement.style.position = 'relative';
            header.parentElement.insertBefore(badge, header.nextSibling);
          } else {
            element.style.position = 'relative';
            element.insertBefore(badge, element.firstChild);
          }
        }
      }
    });
  }

  // ==========================================
  // التهيئة
  // ==========================================
  function init() {
    // انتظار تحميل DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // إضافة class للـ body إذا كان مدير
    if (isAdmin()) {
      document.body.classList.add('admin-logged-in');
    } else {
      document.body.classList.remove('admin-logged-in');
    }

    // انتظار تحميل البيانات
    setTimeout(() => {
      if (isAdmin()) {
        addControlsToElements();
        
        // مراقبة التغييرات في DOM
        const observer = new MutationObserver(() => {
          setTimeout(addControlsToElements, 500);
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } else {
        applyStatesForUsers();
      }
    }, 1000);
  }

  // تصدير للاستخدام الخارجي
  window.AdminVisibilityControl = {
    addControls: addControlsToElements,
    isAdmin: isAdmin,
    VisibilityManager: VisibilityManager,
    STATES: STATES
  };

  // بدء التهيئة
  init();

})();
