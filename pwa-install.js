/**
 * =====================================================================
 * Elevate Platform — PWA Install Prompt (تثبيت التطبيق)
 * =====================================================================
 * رسالة تظهر للمستخدم تقترح عليه تثبيت الموقع كتطبيق على جهازه
 * =====================================================================
 */

(function () {
  'use strict';

  let deferredPrompt = null;
  let installPromptShown = false;

  // التحقق إذا المستخدم سبق رفض التثبيت
  function wasPromptDismissed() {
    const dismissed = localStorage.getItem('elevate_pwa_dismissed');
    if (!dismissed) return false;
    
    const dismissedTime = parseInt(dismissed, 10);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    
    // إعادة عرض الرسالة بعد 7 أيام
    return daysSinceDismissed < 7;
  }

  // التحقق إذا التطبيق مثبّت فعلاً
  function isAppInstalled() {
    // إذا كان يعمل في وضع standalone معناه التطبيق مثبّت
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  // إنشاء وعرض رسالة التثبيت
  function showInstallPrompt() {
    if (installPromptShown || wasPromptDismissed() || isAppInstalled()) {
      return;
    }

    installPromptShown = true;

    const isArabic = document.documentElement.lang === 'ar';
    
    // إنشاء الرسالة
    const promptContainer = document.createElement('div');
    promptContainer.id = 'pwa-install-prompt';
    promptContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(120%);
      max-width: 420px;
      width: calc(100% - 32px);
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 27, 75, 0.98));
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 20px 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.3);
      border: 1px solid rgba(99, 102, 241, 0.3);
      z-index: 999999;
      direction: ${isArabic ? 'rtl' : 'ltr'};
      font-family: 'Cairo', 'Tajawal', sans-serif;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
      opacity: 0;
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
    `;
    icon.innerHTML = '<i class="fas fa-mobile-screen-button" style="font-size: 28px; color: #fff;"></i>';

    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0 0 8px;
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
      text-align: center;
      letter-spacing: -0.3px;
    `;
    title.textContent = isArabic ? '📱 ثبّت تطبيق Elevate' : '📱 Install Elevate App';

    const description = document.createElement('p');
    description.style.cssText = `
      margin: 0 0 20px;
      font-size: 0.9rem;
      color: #cbd5e1;
      text-align: center;
      line-height: 1.6;
    `;
    description.textContent = isArabic 
      ? 'نزّل التطبيق على جهازك واستمتع بتجربة أسرع وإشعارات فورية بالفرص الجديدة!'
      : 'Install the app on your device for a faster experience and instant notifications!';

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      flex-direction: ${isArabic ? 'row-reverse' : 'row'};
    `;

    const installButton = document.createElement('button');
    installButton.style.cssText = `
      flex: 1;
      padding: 13px 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      border-radius: 12px;
      color: #fff;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
    `;
    installButton.innerHTML = isArabic 
      ? '<i class="fas fa-download"></i> <span>تثبيت الآن</span>'
      : '<i class="fas fa-download"></i> <span>Install Now</span>';

    installButton.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.5)';
    });

    installButton.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.4)';
    });

    installButton.addEventListener('click', async function() {
      if (deferredPrompt) {
        // عرض نافذة التثبيت الأصلية
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log(`PWA Install: User chose ${outcome}`);
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
        } else {
          console.log('❌ User dismissed the install prompt');
          localStorage.setItem('elevate_pwa_dismissed', Date.now().toString());
        }
        
        deferredPrompt = null;
      } else {
        // إذا مفيش prompt متاح، اعرض تعليمات يدوية
        showManualInstructions();
      }
      
      hidePrompt();
    });

    const laterButton = document.createElement('button');
    laterButton.style.cssText = `
      flex: 1;
      padding: 13px 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      color: #cbd5e1;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    `;
    laterButton.textContent = isArabic ? 'ليس الآن' : 'Not Now';

    laterButton.addEventListener('mouseenter', function() {
      this.style.background = 'rgba(255, 255, 255, 0.1)';
      this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    laterButton.addEventListener('mouseleave', function() {
      this.style.background = 'rgba(255, 255, 255, 0.05)';
      this.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    });

    laterButton.addEventListener('click', function() {
      localStorage.setItem('elevate_pwa_dismissed', Date.now().toString());
      hidePrompt();
    });

    buttonsContainer.appendChild(installButton);
    buttonsContainer.appendChild(laterButton);

    promptContainer.appendChild(icon);
    promptContainer.appendChild(title);
    promptContainer.appendChild(description);
    promptContainer.appendChild(buttonsContainer);

    document.body.appendChild(promptContainer);

    // Animation: إظهار الرسالة
    setTimeout(function() {
      promptContainer.style.opacity = '1';
      promptContainer.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);

    // إخفاء تلقائي بعد 15 ثانية
    setTimeout(function() {
      if (document.getElementById('pwa-install-prompt')) {
        hidePrompt();
      }
    }, 15000);
  }

  // إخفاء الرسالة
  function hidePrompt() {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
      prompt.style.opacity = '0';
      prompt.style.transform = 'translateX(-50%) translateY(120%)';
      setTimeout(function() {
        if (prompt.parentNode) {
          prompt.parentNode.removeChild(prompt);
        }
      }, 400);
    }
  }

  // عرض تعليمات التثبيت اليدوي
  function showManualInstructions() {
    const isArabic = document.documentElement.lang === 'ar';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
      instructions = isArabic
        ? '📱 للتثبيت على iPhone:\n\n1. اضغط على زر المشاركة ⬆️\n2. اختر "إضافة إلى الشاشة الرئيسية"\n3. اضغط "إضافة"'
        : '📱 To install on iPhone:\n\n1. Tap the Share button ⬆️\n2. Select "Add to Home Screen"\n3. Tap "Add"';
    } else {
      instructions = isArabic
        ? '📱 للتثبيت على Android:\n\n1. اضغط على القائمة (⋮)\n2. اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"\n3. اضغط "تثبيت"'
        : '📱 To install on Android:\n\n1. Tap the menu (⋮)\n2. Select "Install app" or "Add to Home screen"\n3. Tap "Install"';
    }
    
    alert(instructions);
  }

  // استماع لحدث beforeinstallprompt
  window.addEventListener('beforeinstallprompt', function(e) {
    // منع عرض الرسالة الافتراضية من المتصفح
    e.preventDefault();
    
    // حفظ الحدث للاستخدام لاحقاً
    deferredPrompt = e;
    
    console.log('✅ PWA Install prompt is ready');
    
    // عرض رسالتنا المخصصة بعد 3 ثواني
    setTimeout(showInstallPrompt, 3000);
  });

  // استماع لحدث التثبيت
  window.addEventListener('appinstalled', function() {
    console.log('✅ PWA was installed successfully!');
    deferredPrompt = null;
    
    // حفظ أن التطبيق تم تثبيته
    localStorage.setItem('elevate_pwa_installed', 'true');
    
    // إخفاء الرسالة إذا كانت مفتوحة
    hidePrompt();
  });

  // للأجهزة اللي مش بتدعم beforeinstallprompt (مثل iOS)
  // عرض الرسالة بعد 5 ثواني من تحميل الصفحة
  if (!isAppInstalled() && !wasPromptDismissed()) {
    setTimeout(function() {
      // إذا مفيش deferredPrompt متاح (iOS مثلاً)
      if (!deferredPrompt && !installPromptShown) {
        showInstallPrompt();
      }
    }, 5000);
  }

  // إضافة زر "ثبّت التطبيق" في القائمة (اختياري)
  window.ElevatePWA = {
    showInstallPrompt: showInstallPrompt,
    isInstalled: isAppInstalled,
    canInstall: function() {
      return !isAppInstalled() && !wasPromptDismissed();
    }
  };

  console.log('✅ PWA Install prompt initialized');
})();
