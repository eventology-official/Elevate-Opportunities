/**
 * =====================================================================
 * Elevate Platform — Admin Devices Manager
 * =====================================================================
 * نظام إدارة الأجهزة المصرح لها بالوصول لحساب المدير
 * - تتبع جميع الأجهزة التي تم تسجيل الدخول منها
 * - عرض معلومات الجهاز (المتصفح، النظام، IP، الموقع، آخر نشاط)
 * - إمكانية إلغاء الوصول من أي جهاز
 * - حماية الجلسة الحالية من الإلغاء
 * =====================================================================
 */

(function (window) {
  'use strict';

  const ADMIN_DEVICES_KEY = 'elevate_admin_devices';
  const CURRENT_DEVICE_KEY = 'elevate_current_device_id';

  // Helper: Get device fingerprint (معرف فريد للجهاز)
  function getDeviceFingerprint() {
    const nav = navigator;
    const screen = window.screen;
    
    const components = [
      nav.userAgent,
      nav.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage
    ];
    
    const fingerprint = components.join('|||');
    
    // Create simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return 'device_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  }

  // Helper: Parse User Agent
  function parseUserAgent(ua) {
    ua = ua || navigator.userAgent;
    
    let browser = 'متصفح غير معروف';
    let os = 'نظام غير معروف';
    let deviceType = 'جهاز كمبيوتر';
    
    // Detect Browser
    if (ua.includes('Firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('Edg')) {
      browser = 'Microsoft Edge';
    } else if (ua.includes('Chrome') && !ua.includes('Edg')) {
      browser = 'Google Chrome';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
    } else if (ua.includes('Opera') || ua.includes('OPR')) {
      browser = 'Opera';
    }
    
    // Detect OS
    if (ua.includes('Windows NT 10')) {
      os = 'Windows 10/11';
    } else if (ua.includes('Windows NT 6.3')) {
      os = 'Windows 8.1';
    } else if (ua.includes('Windows NT 6.2')) {
      os = 'Windows 8';
    } else if (ua.includes('Windows NT 6.1')) {
      os = 'Windows 7';
    } else if (ua.includes('Windows')) {
      os = 'Windows';
    } else if (ua.includes('Mac OS X')) {
      os = 'macOS';
    } else if (ua.includes('Android')) {
      os = 'Android';
      deviceType = 'جوال';
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      os = ua.includes('iPad') ? 'iPadOS' : 'iOS';
      deviceType = ua.includes('iPad') ? 'تابلت' : 'جوال';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    }
    
    return { browser, os, deviceType };
  }

  // Helper: Get approximate location from timezone
  function getApproximateLocation() {
    const offset = new Date().getTimezoneOffset();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Egypt timezone
    if (offset === -120 || timezone.includes('Cairo')) {
      return 'مصر 🇪🇬';
    }
    
    // Saudi Arabia
    if (offset === -180 || timezone.includes('Riyadh')) {
      return 'السعودية 🇸🇦';
    }
    
    // UAE
    if (offset === -240 || timezone.includes('Dubai')) {
      return 'الإمارات 🇦🇪';
    }
    
    return timezone || 'موقع غير محدد';
  }

  const AdminDevices = {
    
    // Register current device
    registerDevice: function(user) {
      if (!user || !user.isAdmin) return null;
      
      const devices = this.getAllDevices();
      const deviceId = getDeviceFingerprint();
      const deviceInfo = parseUserAgent();
      
      const existingIndex = devices.findIndex(d => d.id === deviceId);
      
      const device = {
        id: deviceId,
        userId: user.id || user.username,
        username: user.username,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.deviceType,
        location: getApproximateLocation(),
        userAgent: navigator.userAgent,
        screenResolution: window.screen.width + 'x' + window.screen.height,
        language: navigator.language,
        firstLogin: existingIndex === -1 ? Date.now() : devices[existingIndex].firstLogin,
        lastActive: Date.now(),
        loginCount: existingIndex === -1 ? 1 : (devices[existingIndex].loginCount || 0) + 1,
        isActive: true,
        isCurrent: true
      };
      
      // Update or add device
      if (existingIndex !== -1) {
        devices[existingIndex] = device;
      } else {
        devices.push(device);
      }
      
      // Mark all other devices as not current
      devices.forEach(d => {
        if (d.id !== deviceId) {
          d.isCurrent = false;
        }
      });
      
      this.saveDevices(devices);
      localStorage.setItem(CURRENT_DEVICE_KEY, deviceId);
      
      return device;
    },
    
    // Get all devices
    getAllDevices: function() {
      try {
        const data = localStorage.getItem(ADMIN_DEVICES_KEY);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        console.error('[AdminDevices] Error loading devices:', e);
        return [];
      }
    },
    
    // Save devices
    saveDevices: function(devices) {
      try {
        localStorage.setItem(ADMIN_DEVICES_KEY, JSON.stringify(devices));
        return true;
      } catch (e) {
        console.error('[AdminDevices] Error saving devices:', e);
        return false;
      }
    },
    
    // Get current device ID
    getCurrentDeviceId: function() {
      return localStorage.getItem(CURRENT_DEVICE_KEY);
    },
    
    // Revoke device access
    revokeDevice: function(deviceId) {
      const devices = this.getAllDevices();
      const currentDeviceId = this.getCurrentDeviceId();
      
      // Prevent revoking current device
      if (deviceId === currentDeviceId) {
        return { success: false, message: 'لا يمكن إلغاء الجهاز الحالي!' };
      }
      
      const deviceIndex = devices.findIndex(d => d.id === deviceId);
      
      if (deviceIndex === -1) {
        return { success: false, message: 'الجهاز غير موجود!' };
      }
      
      // Mark as inactive
      devices[deviceIndex].isActive = false;
      devices[deviceIndex].revokedAt = Date.now();
      
      this.saveDevices(devices);
      
      return { success: true, message: 'تم إلغاء الوصول من هذا الجهاز بنجاح!' };
    },
    
    // Reactivate device
    reactivateDevice: function(deviceId) {
      const devices = this.getAllDevices();
      const deviceIndex = devices.findIndex(d => d.id === deviceId);
      
      if (deviceIndex === -1) {
        return { success: false, message: 'الجهاز غير موجود!' };
      }
      
      devices[deviceIndex].isActive = true;
      devices[deviceIndex].reactivatedAt = Date.now();
      
      this.saveDevices(devices);
      
      return { success: true, message: 'تم إعادة تفعيل الوصول من هذا الجهاز!' };
    },
    
    // Delete device permanently
    deleteDevice: function(deviceId) {
      const devices = this.getAllDevices();
      const currentDeviceId = this.getCurrentDeviceId();
      
      if (deviceId === currentDeviceId) {
        return { success: false, message: 'لا يمكن حذف الجهاز الحالي!' };
      }
      
      const filtered = devices.filter(d => d.id !== deviceId);
      
      if (filtered.length === devices.length) {
        return { success: false, message: 'الجهاز غير موجود!' };
      }
      
      this.saveDevices(filtered);
      
      return { success: true, message: 'تم حذف الجهاز نهائياً!' };
    },
    
    // Format date
    formatDate: function(timestamp) {
      if (!timestamp) return 'غير محدد';
      
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return 'منذ ' + diffMins + ' دقيقة';
      if (diffHours < 24) return 'منذ ' + diffHours + ' ساعة';
      if (diffDays < 7) return 'منذ ' + diffDays + ' يوم';
      
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    
    // Render devices list
    renderDevicesList: function() {
      const container = document.getElementById('admin-devices-list');
      if (!container) return;
      
      const devices = this.getAllDevices();
      const currentDeviceId = this.getCurrentDeviceId();
      
      if (devices.length === 0) {
        container.innerHTML = `
          <div class="admin-devices-empty">
            <i class="fas fa-laptop-mobile" style="font-size: 48px; color: #64748b; margin-bottom: 16px;"></i>
            <p style="color: #94a3b8; font-size: 1.1rem; margin: 0;">لا توجد أجهزة مسجلة حالياً</p>
            <p style="color: #64748b; font-size: 0.9rem; margin: 8px 0 0;">سيتم تسجيل الأجهزة تلقائياً عند تسجيل الدخول</p>
          </div>
        `;
        return;
      }
      
      // Sort: current first, then active, then by last active
      const sortedDevices = devices.sort((a, b) => {
        if (a.id === currentDeviceId) return -1;
        if (b.id === currentDeviceId) return 1;
        if (a.isActive !== b.isActive) return b.isActive - a.isActive;
        return b.lastActive - a.lastActive;
      });
      
      container.innerHTML = sortedDevices.map(device => {
        const isCurrent = device.id === currentDeviceId;
        const isActive = device.isActive;
        
        const statusBadge = isCurrent 
          ? '<span class="device-badge badge-current"><i class="fas fa-circle-dot"></i> الجهاز الحالي</span>'
          : isActive
            ? '<span class="device-badge badge-active"><i class="fas fa-check-circle"></i> نشط</span>'
            : '<span class="device-badge badge-revoked"><i class="fas fa-ban"></i> محظور</span>';
        
        const deviceIcon = device.deviceType === 'جوال'
          ? 'fa-mobile-screen-button'
          : device.deviceType === 'تابلت'
            ? 'fa-tablet-screen-button'
            : 'fa-desktop';
        
        return `
          <div class="admin-device-card ${isCurrent ? 'device-current' : ''} ${!isActive ? 'device-revoked' : ''}">
            <div class="device-icon">
              <i class="fas ${deviceIcon}"></i>
            </div>
            
            <div class="device-info">
              <div class="device-header">
                <h3 class="device-name">${device.browser} على ${device.os}</h3>
                ${statusBadge}
              </div>
              
              <div class="device-meta">
                <div class="device-meta-item">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>${device.location}</span>
                </div>
                <div class="device-meta-item">
                  <i class="fas fa-mobile-screen"></i>
                  <span>${device.deviceType} · ${device.screenResolution}</span>
                </div>
                <div class="device-meta-item">
                  <i class="fas fa-clock"></i>
                  <span>آخر نشاط: ${this.formatDate(device.lastActive)}</span>
                </div>
                <div class="device-meta-item">
                  <i class="fas fa-calendar-plus"></i>
                  <span>أول تسجيل: ${this.formatDate(device.firstLogin)}</span>
                </div>
                <div class="device-meta-item">
                  <i class="fas fa-sign-in-alt"></i>
                  <span>عدد مرات الدخول: ${device.loginCount || 1}</span>
                </div>
              </div>
            </div>
            
            <div class="device-actions">
              ${isCurrent ? `
                <button class="device-action-btn btn-current-device" disabled>
                  <i class="fas fa-shield-halved"></i>
                  <span>الجهاز النشط</span>
                </button>
              ` : isActive ? `
                <button class="device-action-btn btn-revoke" onclick="AdminDevices.confirmRevokeDevice('${device.id}')">
                  <i class="fas fa-ban"></i>
                  <span>إلغاء الوصول</span>
                </button>
                <button class="device-action-btn btn-delete" onclick="AdminDevices.confirmDeleteDevice('${device.id}')">
                  <i class="fas fa-trash-alt"></i>
                  <span>حذف</span>
                </button>
              ` : `
                <button class="device-action-btn btn-reactivate" onclick="AdminDevices.handleReactivateDevice('${device.id}')">
                  <i class="fas fa-rotate-right"></i>
                  <span>إعادة تفعيل</span>
                </button>
                <button class="device-action-btn btn-delete" onclick="AdminDevices.confirmDeleteDevice('${device.id}')">
                  <i class="fas fa-trash-alt"></i>
                  <span>حذف نهائياً</span>
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    },
    
    // Confirm revoke device
    confirmRevokeDevice: function(deviceId) {
      if (confirm('هل أنت متأكد من إلغاء الوصول من هذا الجهاز؟\n\nسيتم منع تسجيل الدخول من هذا الجهاز مستقبلاً.')) {
        this.handleRevokeDevice(deviceId);
      }
    },
    
    // Handle revoke device
    handleRevokeDevice: function(deviceId) {
      const result = this.revokeDevice(deviceId);
      
      if (result.success) {
        this.showToast(result.message, 'success');
        this.renderDevicesList();
      } else {
        this.showToast(result.message, 'error');
      }
    },
    
    // Handle reactivate device
    handleReactivateDevice: function(deviceId) {
      const result = this.reactivateDevice(deviceId);
      
      if (result.success) {
        this.showToast(result.message, 'success');
        this.renderDevicesList();
      } else {
        this.showToast(result.message, 'error');
      }
    },
    
    // Confirm delete device
    confirmDeleteDevice: function(deviceId) {
      if (confirm('هل أنت متأكد من حذف هذا الجهاز نهائياً؟\n\nلا يمكن التراجع عن هذا الإجراء.')) {
        this.handleDeleteDevice(deviceId);
      }
    },
    
    // Handle delete device
    handleDeleteDevice: function(deviceId) {
      const result = this.deleteDevice(deviceId);
      
      if (result.success) {
        this.showToast(result.message, 'success');
        this.renderDevicesList();
      } else {
        this.showToast(result.message, 'error');
      }
    },
    
    // Show toast notification
    showToast: function(message, type) {
      // Create toast element
      const toast = document.createElement('div');
      toast.className = 'admin-devices-toast toast-' + type;
      toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
      `;
      
      document.body.appendChild(toast);
      
      // Show toast
      setTimeout(() => toast.classList.add('toast-show'), 10);
      
      // Hide and remove toast
      setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // Export to global
  window.AdminDevices = AdminDevices;
  
})(window);


// =====================================================================
// Auto-Integration with Admin Panel
// =====================================================================

// Hook into Admin.switchSection to render devices when section is opened
(function() {
  if (window.Admin && typeof Admin.switchSection === 'function') {
    const originalSwitchSection = Admin.switchSection;
    
    Admin.switchSection = function(sectionId) {
      // Call original function
      const result = originalSwitchSection.apply(this, arguments);
      
      // If switching to devices section, render devices list
      if (sectionId === 'adm-sec-devices') {
        setTimeout(function() {
          AdminDevices.renderDevicesList();
          updateDevicesStats();
        }, 100);
      }
      
      return result;
    };
  }
})();

// Update devices statistics
function updateDevicesStats() {
  const devices = AdminDevices.getAllDevices();
  const activeDevices = devices.filter(d => d.isActive);
  const revokedDevices = devices.filter(d => !d.isActive);
  
  // Update badge
  const badge = document.getElementById('admin-nav-devices-badge');
  if (badge) {
    badge.textContent = devices.length;
  }
  
  // Update stats cards
  const totalEl = document.getElementById('stat-total-devices');
  if (totalEl) totalEl.textContent = devices.length;
  
  const activeEl = document.getElementById('stat-active-devices');
  if (activeEl) activeEl.textContent = activeDevices.length;
  
  const revokedEl = document.getElementById('stat-revoked-devices');
  if (revokedEl) revokedEl.textContent = revokedDevices.length;
}

// Auto-register device on admin login
if (window.addEventListener) {
  window.addEventListener('DOMContentLoaded', function() {
    // Check if user is admin and register device
    setTimeout(function() {
      try {
        const user = JSON.parse(localStorage.getItem('ns_user') || '{}');
        if (user.isAdmin || user.username === 'admin@elevate.com' || user.username === 'admin') {
          AdminDevices.registerDevice(user);
          console.log('[AdminDevices] ✓ تم تسجيل الجهاز الحالي للمدير');
        }
      } catch (e) {
        console.error('[AdminDevices] Error registering device:', e);
      }
    }, 1000);
  });
}
