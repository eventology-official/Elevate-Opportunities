/**
 * =====================================================================
 * Elevate Platform — قسم تلقي الفرص (Opportunities Intake)
 * =====================================================================
 * يسمح للمدير بمراجعة الفرص المقترحة من السوشيال ميديا
 * =====================================================================
 */

(function() {
  'use strict';

  window.OpportunitiesIntake = {
    
    init: function() {
      this.renderIntakeSection();
      this.bindEvents();
    },

    // جلب الفرص المقترحة من localStorage
    getSuggestedOpportunities: function() {
      try {
        const suggested = localStorage.getItem('luxen_suggested_opportunities');
        return suggested ? JSON.parse(suggested) : [];
      } catch (e) {
        return [];
      }
    },

    // حفظ الفرص المقترحة
    saveSuggestedOpportunities: function(opps) {
      localStorage.setItem('luxen_suggested_opportunities', JSON.stringify(opps));
    },

    // إضافة فرصة مقترحة جديدة (للتجربة)
    addSampleOpportunity: function() {
      const samples = [
        {
          id: 'sugg_' + Date.now(),
          title: 'منحة دراسية كاملة في جامعة هارفارد',
          category: 'scholarships',
          description: 'منحة ممولة بالكامل لدراسة البكالوريوس في جامعة هارفارد الأمريكية',
          link: 'https://www.harvard.edu/scholarships',
          deadline: '2026-12-31',
          source: 'Facebook',
          sourceUrl: 'https://facebook.com/harvard',
          image: '',
          tags: ['منحة', 'دراسة', 'أمريكا'],
          suggestedAt: Date.now(),
          status: 'pending' // pending, approved, rejected
        },
        {
          id: 'sugg_' + (Date.now() + 1),
          title: 'مسابقة برمجة عالمية - Google Code Jam',
          category: 'competitions',
          description: 'مسابقة برمجة عالمية من جوجل بجوائز مالية ضخمة',
          link: 'https://codingcompetitions.withgoogle.com/codejam',
          deadline: '', // بدون مدة محددة
          source: 'Twitter',
          sourceUrl: 'https://twitter.com/googledevs',
          image: '',
          tags: ['برمجة', 'مسابقة', 'جوجل'],
          suggestedAt: Date.now() + 1000,
          status: 'pending'
        },
        {
          id: 'sugg_' + (Date.now() + 2),
          title: 'فرصة تطوع مع الصليب الأحمر',
          category: 'volunteering',
          description: 'فرصة تطوع للمساعدة في الإغاثة الإنسانية',
          link: 'https://www.icrc.org/en/volunteer',
          deadline: '2027-03-15',
          source: 'LinkedIn',
          sourceUrl: 'https://linkedin.com/company/icrc',
          image: '',
          tags: ['تطوع', 'إنسانية'],
          suggestedAt: Date.now() + 2000,
          status: 'pending'
        }
      ];

      const random = samples[Math.floor(Math.random() * samples.length)];
      const opps = this.getSuggestedOpportunities();
      opps.push(random);
      this.saveSuggestedOpportunities(opps);
      this.renderIntakeSection();
      
      window.App.showToast('✅ تم إضافة فرصة مقترحة جديدة للمراجعة', 'success');
    },

    // عرض قسم تلقي الفرص
    renderIntakeSection: function() {
      const container = document.getElementById('opportunities-intake-container');
      if (!container) return;

      const opportunities = this.getSuggestedOpportunities();
      const pending = opportunities.filter(o => o.status === 'pending');

      let html = `
        <div class="admin-section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0;">
              <i class="fas fa-inbox" style="color: #f59e0b;"></i> تلقي الفرص المقترحة
            </h2>
            <p style="color: #94a3b8; font-size: 0.9rem; margin: 5px 0 0;">
              راجع واعتمد الفرص الواردة من السوشيال ميديا
            </p>
          </div>
          <button onclick="OpportunitiesIntake.addSampleOpportunity()" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fas fa-plus"></i> إضافة فرصة تجريبية
          </button>
        </div>

        <div class="intake-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
          <div class="stat-card" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 15px; border-radius: 12px;">
            <div style="font-size: 2rem; font-weight: 800; color: #f59e0b;">${pending.length}</div>
            <div style="color: #94a3b8; font-size: 0.85rem;">فرص في الانتظار</div>
          </div>
          <div class="stat-card" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 15px; border-radius: 12px;">
            <div style="font-size: 2rem; font-weight: 800; color: #10b981;">${opportunities.filter(o => o.status === 'approved').length}</div>
            <div style="color: #94a3b8; font-size: 0.85rem;">تم الموافقة</div>
          </div>
          <div class="stat-card" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 15px; border-radius: 12px;">
            <div style="font-size: 2rem; font-weight: 800; color: #ef4444;">${opportunities.filter(o => o.status === 'rejected').length}</div>
            <div style="color: #94a3b8; font-size: 0.85rem;">تم الرفض</div>
          </div>
        </div>

        <div class="opportunities-list" style="display: grid; gap: 15px;">
      `;

      if (pending.length === 0) {
        html += `
          <div style="text-align: center; padding: 60px 20px; background: rgba(255, 255, 255, 0.02); border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 16px;">
            <i class="fas fa-inbox" style="font-size: 4rem; color: #475569; margin-bottom: 20px;"></i>
            <h3 style="color: #94a3b8; font-size: 1.2rem; margin: 0 0 10px;">لا توجد فرص في الانتظار</h3>
            <p style="color: #64748b; font-size: 0.9rem;">سيتم عرض الفرص المقترحة من السوشيال ميديا هنا</p>
            <button onclick="OpportunitiesIntake.addSampleOpportunity()" class="btn btn-secondary" style="margin-top: 20px;">
              <i class="fas fa-plus"></i> إضافة فرصة تجريبية
            </button>
          </div>
        `;
      } else {
        pending.forEach(opp => {
          const categoryInfo = this.getCategoryInfo(opp.category);
          const hasDeadline = opp.deadline && opp.deadline.trim() !== '';
          const isExpired = hasDeadline && new Date(opp.deadline) < new Date();
          
          html += `
            <div class="intake-opportunity-card" style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 16px; transition: all 0.3s;">
              <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                
                <!-- Right Side: Content -->
                <div style="flex: 1; min-width: 300px;">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                    <span style="background: ${categoryInfo.bg}; color: ${categoryInfo.color}; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                      <i class="${categoryInfo.icon}"></i> ${categoryInfo.label}
                    </span>
                    ${!hasDeadline ? `
                      <span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                        <i class="fas fa-infinity"></i> بدون مدة محددة
                      </span>
                    ` : isExpired ? `
                      <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                        <i class="fas fa-exclamation-triangle"></i> انتهت المدة
                      </span>
                    ` : ''}
                    <span style="background: rgba(99, 102, 241, 0.1); color: #818cf8; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem;">
                      <i class="fab fa-${opp.source.toLowerCase()}"></i> ${opp.source}
                    </span>
                  </div>

                  <h3 style="color: #fff; font-size: 1.1rem; font-weight: 700; margin: 0 0 10px; line-height: 1.4;">
                    ${opp.title}
                  </h3>

                  <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.6; margin: 0 0 15px;">
                    ${opp.description}
                  </p>

                  <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                    ${hasDeadline ? `
                      <div style="display: inline-flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 0.85rem;">
                        <i class="fas fa-calendar-alt" style="color: #f59e0b;"></i> ${opp.deadline}
                      </div>
                    ` : ''}
                    <div style="display: inline-flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 0.85rem;">
                      <i class="fas fa-clock" style="color: #64748b;"></i> ${new Date(opp.suggestedAt).toLocaleDateString('ar-EG')}
                    </div>
                  </div>

                  ${opp.tags && opp.tags.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 15px;">
                      ${opp.tags.map(tag => `
                        <span style="background: rgba(99, 102, 241, 0.1); color: #818cf8; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem;">
                          #${tag}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}

                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="${opp.link}" target="_blank" class="btn btn-secondary" style="font-size: 0.85rem; padding: 8px 16px;">
                      <i class="fas fa-external-link-alt"></i> رابط الفرصة
                    </a>
                    ${opp.sourceUrl ? `
                      <a href="${opp.sourceUrl}" target="_blank" class="btn" style="font-size: 0.85rem; padding: 8px 16px; background: rgba(255, 255, 255, 0.05);">
                        <i class="fas fa-link"></i> المصدر
                      </a>
                    ` : ''}
                  </div>
                </div>

                <!-- Left Side: Actions -->
                <div style="display: flex; flex-direction: column; gap: 10px; min-width: 150px;">
                  <button onclick="OpportunitiesIntake.approveOpportunity('${opp.id}')" class="btn btn-primary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #10b981, #059669);">
                    <i class="fas fa-check"></i> موافقة ونشر
                  </button>
                  <button onclick="OpportunitiesIntake.editOpportunity('${opp.id}')" class="btn btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-edit"></i> تعديل
                  </button>
                  <button onclick="OpportunitiesIntake.rejectOpportunity('${opp.id}')" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <i class="fas fa-times"></i> رفض
                  </button>
                </div>
              </div>
            </div>
          `;
        });
      }

      html += '</div>';
      container.innerHTML = html;
    },

    // معلومات التصنيف
    getCategoryInfo: function(category) {
      const categories = {
        competitions: { label: 'مسابقات', icon: 'fas fa-trophy', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
        scholarships: { label: 'منح دراسية', icon: 'fas fa-graduation-cap', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
        volunteering: { label: 'تطوع', icon: 'fas fa-hands-helping', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
        jobs: { label: 'وظائف', icon: 'fas fa-briefcase', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
        events: { label: 'فعاليات', icon: 'fas fa-calendar-alt', color: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' },
        courses: { label: 'كورسات', icon: 'fas fa-book-open', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }
      };
      return categories[category] || { label: 'عام', icon: 'fas fa-star', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
    },

    // الموافقة على الفرصة ونشرها
    approveOpportunity: function(id) {
      const opps = this.getSuggestedOpportunities();
      const opp = opps.find(o => o.id === id);
      
      if (!opp) return;

      // تغيير الحالة
      opp.status = 'approved';
      this.saveSuggestedOpportunities(opps);

      // إضافة للفرص المنشورة
      const cards = JSON.parse(localStorage.getItem('luxen_general_cards') || '[]');
      cards.push({
        id: 'opp_' + Date.now(),
        title: opp.title,
        category: opp.category,
        description: opp.description,
        link: opp.link,
        deadline: opp.deadline || '',
        image: opp.image || 'images/default-opportunity.jpg',
        tags: opp.tags || [],
        createdAt: Date.now(),
        isActive: true
      });
      localStorage.setItem('luxen_general_cards', JSON.stringify(cards));

      window.App.showToast('✅ تم نشر الفرصة بنجاح في الموقع', 'success');
      this.renderIntakeSection();
      
      // تحديث الواجهة
      if (window.App && typeof App.renderOpportunities === 'function') {
        App.renderOpportunities();
      }
    },

    // تعديل الفرصة
    editOpportunity: function(id) {
      const opps = this.getSuggestedOpportunities();
      const opp = opps.find(o => o.id === id);
      
      if (!opp) return;

      // عرض نافذة التعديل
      const modal = document.createElement('div');
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; overflow-y: auto;';
      
      modal.innerHTML = `
        <div style="background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
          <h3 style="color: #fff; margin: 0 0 20px; font-size: 1.3rem;">
            <i class="fas fa-edit" style="color: #f59e0b;"></i> تعديل الفرصة
          </h3>
          
          <div style="display: flex; flex-direction: column; gap: 15px;">
            <div>
              <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 5px; display: block;">العنوان</label>
              <input type="text" id="edit-title" value="${opp.title}" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 0.9rem;">
            </div>
            
            <div>
              <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 5px; display: block;">الوصف</label>
              <textarea id="edit-description" rows="4" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 0.9rem; resize: vertical;">${opp.description}</textarea>
            </div>
            
            <div>
              <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 5px; display: block;">التصنيف</label>
              <select id="edit-category" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 0.9rem;">
                <option value="competitions" ${opp.category === 'competitions' ? 'selected' : ''}>مسابقات</option>
                <option value="scholarships" ${opp.category === 'scholarships' ? 'selected' : ''}>منح دراسية</option>
                <option value="volunteering" ${opp.category === 'volunteering' ? 'selected' : ''}>تطوع</option>
                <option value="jobs" ${opp.category === 'jobs' ? 'selected' : ''}>وظائف</option>
                <option value="events" ${opp.category === 'events' ? 'selected' : ''}>فعاليات</option>
                <option value="courses" ${opp.category === 'courses' ? 'selected' : ''}>كورسات</option>
              </select>
            </div>
            
            <div>
              <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 5px; display: block;">الرابط</label>
              <input type="url" id="edit-link" value="${opp.link}" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 0.9rem;">
            </div>
            
            <div>
              <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 5px; display: block;">آخر موعد للتقديم (اختياري)</label>
              <input type="date" id="edit-deadline" value="${opp.deadline}" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 0.9rem;">
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button onclick="OpportunitiesIntake.saveEdit('${id}')" class="btn btn-primary" style="flex: 1;">
                <i class="fas fa-save"></i> حفظ التعديلات
              </button>
              <button onclick="this.closest('[style*=fixed]').remove()" class="btn btn-secondary" style="flex: 1;">
                <i class="fas fa-times"></i> إلغاء
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
    },

    // حفظ التعديل
    saveEdit: function(id) {
      const title = document.getElementById('edit-title').value;
      const description = document.getElementById('edit-description').value;
      const category = document.getElementById('edit-category').value;
      const link = document.getElementById('edit-link').value;
      const deadline = document.getElementById('edit-deadline').value;

      const opps = this.getSuggestedOpportunities();
      const opp = opps.find(o => o.id === id);
      
      if (opp) {
        opp.title = title;
        opp.description = description;
        opp.category = category;
        opp.link = link;
        opp.deadline = deadline;
        
        this.saveSuggestedOpportunities(opps);
        window.App.showToast('✅ تم حفظ التعديلات بنجاح', 'success');
        this.renderIntakeSection();
        
        document.querySelector('[style*="position: fixed"]').remove();
      }
    },

    // رفض الفرصة
    rejectOpportunity: function(id) {
      if (!confirm('هل أنت متأكد من رفض هذه الفرصة؟')) return;

      const opps = this.getSuggestedOpportunities();
      const opp = opps.find(o => o.id === id);
      
      if (opp) {
        opp.status = 'rejected';
        this.saveSuggestedOpportunities(opps);
        window.App.showToast('✅ تم رفض الفرصة', 'info');
        this.renderIntakeSection();
      }
    },

    bindEvents: function() {
      // يمكن إضافة event listeners إضافية هنا
    }
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('opportunities-intake-container')) {
        window.OpportunitiesIntake.init();
      }
    });
  }

})();
