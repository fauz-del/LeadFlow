/* =====================================================
   LeadFlow — app.js
   Single-page app controller. No frameworks.
   ===================================================== */

const API = '';  // Same origin — Express serves both

/* ── Utility: fetch wrapper ──────────────────────────────────────────────── */
async function api(path, opts = {}) {
  try {
    const res  = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    return await res.json();
  } catch (err) {
    console.error('[API]', path, err);
    return { success: false, message: err.message };
  }
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
const Toast = {
  el: null,
  timer: null,
  show(msg, type = 'default') {
    if (!this.el) this.el = document.getElementById('toast');
    this.el.textContent = msg;
    this.el.className   = 'toast show';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('show'), 3000);
  }
};

/* ── Router / Page navigation ────────────────────────────────────────────── */
const App = {
  currentPage: 'dashboard',

  go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar__link').forEach(l => l.classList.remove('active'));

    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');

    const link = document.querySelector(`.sidebar__link[data-page="${page}"]`);
    if (link) link.classList.add('active');

    this.currentPage = page;

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');

    // Load page data
    const loaders = {
      dashboard:  Dashboard.load,
      leads:      Leads.load,
      discover:   Discover.loadJobs,
      sites:      SitesPage.load,
      outreach:   OutreachPage.load,
      templates:  TemplatesPage.load,
      settings:   Settings.load,
    };
    if (loaders[page]) loaders[page]();
  },

  init() {
    // Sidebar nav clicks
    document.querySelectorAll('.sidebar__link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.go(link.dataset.page);
      });
    });

    // Mobile menu
    document.getElementById('menuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
      const html = document.documentElement;
      const dark = html.getAttribute('data-theme') === 'dark';
      html.setAttribute('data-theme', dark ? 'light' : 'dark');
      const icon = document.querySelector('#themeToggle i');
      icon.className = dark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      localStorage.setItem('lf-theme', dark ? 'light' : 'dark');
    });

    // Restore theme
    const saved = localStorage.getItem('lf-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    // Load dashboard
    Dashboard.load();
    this.updateBadges();
  },

  async updateBadges() {
    const res = await api('/api/stats');
    if (!res.success) return;
    document.getElementById('badge-leads').textContent   = res.data.total_leads || 0;
    document.getElementById('badge-outreach').textContent = res.data.outreach_sent || 0;
  }
};

/* ── Dashboard ───────────────────────────────────────────────────────────── */
const Dashboard = {
  async load() {
    const res = await api('/api/stats');
    if (!res.success) return;
    const d = res.data;

    // Stats
    document.getElementById('stat-total').textContent     = d.total_leads || 0;
    document.getElementById('stat-nosite').textContent    = d.no_website   || 0;
    document.getElementById('stat-sites').textContent     = d.sites_generated || 0;
    document.getElementById('stat-sent').textContent      = d.outreach_sent   || 0;
    document.getElementById('stat-replied').textContent   = d.replied         || 0;
    document.getElementById('stat-converted').textContent = d.converted        || 0;

    // Opportunities
    this.renderOpportunities(d.top_opportunities || []);

    // Activity
    this.renderActivity(d.recent_activity || []);

    // Niche bars
    this.renderNicheBars(d.niche_breakdown || []);

    // Pipeline
    this.renderPipeline(d.status_breakdown || []);
  },

  renderOpportunities(items) {
    const el = document.getElementById('topOpportunities');
    if (!items.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>No leads yet.</p></div>`; return; }
    el.innerHTML = items.map(l => `
      <div class="opp-item" onclick="Drawer.open('${l.id}')">
        <div class="opp-score ${l.opportunity_score >= 60 ? 'high' : ''}">${l.opportunity_score}</div>
        <div>
          <div class="opp-name">${esc(l.business_name)}</div>
          <div class="opp-meta">${esc(l.city || '')} · ${esc(l.niche || 'general')}</div>
        </div>
        <span class="status-badge s-${l.status}">${statusLabel(l.status)}</span>
      </div>
    `).join('');
  },

  renderActivity(items) {
    const el = document.getElementById('recentActivity');
    if (!items.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No activity yet.</p></div>`; return; }
    el.innerHTML = items.map(a => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-body">
          <span class="activity-lead">${esc(a.business_name)}</span>
          <span class="activity-desc"> — ${esc(a.description || '')}</span>
          <div class="activity-time">${timeAgo(a.created_at)}</div>
        </div>
      </div>
    `).join('');
  },

  renderNicheBars(items) {
    const el  = document.getElementById('nicheBreakdown');
    if (!items.length) { el.innerHTML = '<div class="empty-state small"><p>No data yet.</p></div>'; return; }
    const max = Math.max(...items.map(i => i.count), 1);
    el.innerHTML = items.map(i => `
      <div class="niche-bar-row">
        <div class="niche-bar-label"><span>${capitalize(i.niche || 'general')}</span><span>${i.count}</span></div>
        <div class="niche-bar-track"><div class="niche-bar-fill" style="width:${(i.count/max*100).toFixed(1)}%"></div></div>
      </div>
    `).join('');
  },

  renderPipeline(items) {
    const el = document.getElementById('pipelineStatus');
    const icons = { new:'fa-plus',enriched:'fa-star',outreach_sent:'fa-paper-plane',responded:'fa-reply',converted:'fa-handshake',lost:'fa-ban' };
    if (!items.length) { el.innerHTML = '<div class="empty-state small"><p>No data yet.</p></div>'; return; }
    el.innerHTML = items.map(i => `
      <div class="pipeline-item">
        <span class="pipeline-label"><i class="fa-solid ${icons[i.status]||'fa-circle'}"></i> ${statusLabel(i.status)}</span>
        <span class="pipeline-count">${i.count}</span>
      </div>
    `).join('');
  }
};

/* ── Leads ───────────────────────────────────────────────────────────────── */
const Leads = {
  page: 1,
  limit: 20,

  async load() {
    const search  = document.getElementById('leadsSearch')?.value || '';
    const status  = document.getElementById('filterStatus')?.value || '';
    const niche   = document.getElementById('filterNiche')?.value || '';
    const hasWeb  = document.getElementById('filterWebsite')?.value;

    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (search)              params.set('search', search);
    if (status)              params.set('status', status);
    if (niche)               params.set('niche', niche);
    if (hasWeb !== undefined && hasWeb !== '') params.set('has_website', hasWeb);

    const res = await api(`/api/leads?${params}`);
    if (!res.success) { Toast.show('Failed to load leads'); return; }

    this.renderTable(res.data, res.total);
    this.renderPagination(res.total);
    App.updateBadges();
  },

  renderTable(rows, total) {
    const el = document.getElementById('leadsTable');
    if (!rows.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><p>No leads found. Try adjusting filters or <a href="#" onclick="App.go('discover');return false" style="color:var(--accent)">discover businesses</a>.</p></div>`;
      return;
    }
    el.innerHTML = `
      <table class="leads-table">
        <thead>
          <tr>
            <th>Business</th>
            <th>Niche</th>
            <th>Phone</th>
            <th>Score</th>
            <th>Status</th>
            <th>Site</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr onclick="Drawer.open('${r.id}')">
              <td>
                <div class="lead-name">${esc(r.business_name)}</div>
                <div class="lead-city">${esc(r.city || '')} ${r.has_website ? '' : '<span class="no-site">· No website</span>'}</div>
              </td>
              <td><span class="niche-tag">${capitalize(r.niche || 'general')}</span></td>
              <td>${esc(r.phone || '—')}</td>
              <td><span class="score-pill ${r.opportunity_score >= 60 ? 'high' : r.opportunity_score >= 30 ? 'med' : 'low'}">${r.opportunity_score}</span></td>
              <td><span class="status-badge s-${r.status}">${statusLabel(r.status)}</span></td>
              <td>${r.site_url ? `<a href="${r.site_url}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:.78rem">Preview ↗</a>` : '<span style="color:var(--text-3);font-size:.76rem">—</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="padding:10px 14px;font-size:.76rem;color:var(--text-3)">${total} total leads</p>
    `;
  },

  renderPagination(total) {
    const pages = Math.ceil(total / this.limit);
    const el    = document.getElementById('leadsPagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="pag-btn" onclick="Leads.goPage(${this.page-1})" ${this.page===1?'disabled':''}><i class="fa-solid fa-chevron-left"></i></button>`;
    for (let i = 1; i <= pages; i++) {
      if (Math.abs(i - this.page) <= 2 || i === 1 || i === pages) {
        html += `<button class="pag-btn ${i===this.page?'active':''}" onclick="Leads.goPage(${i})">${i}</button>`;
      } else if (Math.abs(i - this.page) === 3) {
        html += `<span style="padding:0 6px;color:var(--text-3)">…</span>`;
      }
    }
    html += `<button class="pag-btn" onclick="Leads.goPage(${this.page+1})" ${this.page===pages?'disabled':''}><i class="fa-solid fa-chevron-right"></i></button>`;
    el.innerHTML = html;
  },

  goPage(p) { this.page = Math.max(1, p); this.load(); },

  openAddModal()  { document.getElementById('addLeadOverlay').classList.add('open'); },
  closeAddModal() { document.getElementById('addLeadOverlay').classList.remove('open'); },

  async submitAdd() {
    const name  = document.getElementById('ml-name').value.trim();
    if (!name) { Toast.show('Business name is required'); return; }

    const payload = {
      business_name: name,
      category:  document.getElementById('ml-cat').value,
      city:      document.getElementById('ml-city').value,
      phone:     document.getElementById('ml-phone').value,
      address:   document.getElementById('ml-addr').value,
      website:   document.getElementById('ml-web').value,
      has_website: document.getElementById('ml-web').value ? 1 : 0,
      notes:     document.getElementById('ml-notes').value,
    };

    const res = await api('/api/leads', { method: 'POST', body: payload });
    if (res.success) {
      Toast.show('✓ Lead added');
      this.closeAddModal();
      this.load();
      ['ml-name','ml-cat','ml-city','ml-phone','ml-addr','ml-web','ml-notes'].forEach(id => { document.getElementById(id).value = ''; });
    } else {
      Toast.show('Failed to add lead: ' + (res.message || 'Error'));
    }
  },

  async updateStatus(id, newStatus) {
    const res = await api(`/api/leads/${id}`, { method: 'PATCH', body: { status: newStatus } });
    if (res.success) { Toast.show('Status updated'); this.load(); }
  },

  async deleteLead(id) {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    const res = await api(`/api/leads/${id}`, { method: 'DELETE' });
    if (res.success) { Toast.show('Lead deleted'); Drawer.close(); this.load(); }
  }
};

/* ── Lead Drawer ─────────────────────────────────────────────────────────── */
const Drawer = {
  currentId: null,

  async open(id) {
    this.currentId = id;
    const res = await api(`/api/leads/${id}`);
    if (!res.success) { Toast.show('Could not load lead'); return; }

    const l = res.data;
    document.getElementById('drawerTitle').textContent    = l.business_name;
    document.getElementById('drawerSubtitle').textContent = `${l.city || ''} · ${capitalize(l.niche || 'general')}`;

    document.getElementById('drawerBody').innerHTML = this.buildBody(l);
    document.getElementById('drawerOverlay').classList.add('open');
    document.getElementById('drawer').classList.add('open');
  },

  buildBody(l) {
    const waUrl   = l.phone ? `https://wa.me/${l.phone.replace(/\D/g,'')}` : null;
    const hasSite = l.sites && l.sites.length > 0;
    const site    = hasSite ? l.sites[0] : null;

    return `
      <!-- Status + Score -->
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span class="status-badge s-${l.status}">${statusLabel(l.status)}</span>
        <span class="score-pill ${l.opportunity_score >= 60 ? 'high' : l.opportunity_score >= 30 ? 'med' : 'low'}">Score: ${l.opportunity_score}</span>
        ${l.has_website ? '' : '<span style="background:var(--amber-soft);color:var(--amber);padding:3px 9px;border-radius:99px;font-size:.72rem;font-weight:700">No Website</span>'}
      </div>

      <!-- Update status -->
      <div class="drawer-section">
        <div class="drawer-section__title">Update Status</div>
        <select class="status-select" onchange="Leads.updateStatus('${l.id}', this.value)">
          <option value="new" ${l.status==='new'?'selected':''}>New</option>
          <option value="enriched" ${l.status==='enriched'?'selected':''}>Enriched</option>
          <option value="outreach_sent" ${l.status==='outreach_sent'?'selected':''}>Outreach Sent</option>
          <option value="responded" ${l.status==='responded'?'selected':''}>Responded</option>
          <option value="converted" ${l.status==='converted'?'selected':''}>Converted</option>
          <option value="lost" ${l.status==='lost'?'selected':''}>Lost</option>
        </select>
      </div>

      <!-- Contact info -->
      <div class="drawer-section">
        <div class="drawer-section__title">Contact Details</div>
        <div class="drawer-field"><span class="drawer-field__key">Name</span><span class="drawer-field__val">${esc(l.business_name)}</span></div>
        <div class="drawer-field"><span class="drawer-field__key">Phone</span><span class="drawer-field__val">${l.phone ? `<a href="tel:${esc(l.phone)}" style="color:var(--accent)">${esc(l.phone)}</a>` : '—'}</span></div>
        <div class="drawer-field"><span class="drawer-field__key">Address</span><span class="drawer-field__val">${esc(l.address || '—')}</span></div>
        <div class="drawer-field"><span class="drawer-field__key">City</span><span class="drawer-field__val">${esc(l.city || '—')}</span></div>
        <div class="drawer-field"><span class="drawer-field__key">Category</span><span class="drawer-field__val">${esc(l.category || '—')}</span></div>
        <div class="drawer-field"><span class="drawer-field__key">Existing site</span><span class="drawer-field__val">${l.website ? `<a href="${esc(l.website)}" target="_blank" style="color:var(--accent)">Visit ↗</a>` : 'None'}</span></div>
        ${l.rating ? `<div class="drawer-field"><span class="drawer-field__key">Rating</span><span class="drawer-field__val">⭐ ${l.rating} (${l.review_count} reviews)</span></div>` : ''}
        ${l.notes ? `<div class="drawer-field"><span class="drawer-field__key">Notes</span><span class="drawer-field__val" style="white-space:pre-line">${esc(l.notes)}</span></div>` : ''}
      </div>

      <!-- Actions -->
      <div class="drawer-section">
        <div class="drawer-section__title">Actions</div>
        <div class="drawer-ctas">
          ${waUrl ? `<button class="btn btn--wa btn--sm" onclick="Outreach.openChat('${l.id}')"><i class="fa-brands fa-whatsapp"></i> Let's Chat</button>` : ''}
          <button class="btn btn--primary btn--sm" onclick="Sites.openGenModal('${l.id}')"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate Site</button>
          <button class="btn btn--ghost btn--sm" onclick="Leads.deleteLead('${l.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>

      <!-- Generated site preview -->
      ${site ? `
        <div class="drawer-section">
          <div class="drawer-section__title">Generated Website</div>
          <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:10px">
            <div style="background:var(--accent-soft);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px">
              <span style="font-size:.8rem;font-weight:600;color:var(--accent)"><i class="fa-solid fa-globe"></i> ${l.business_name} — Preview</span>
              <div style="display:flex;gap:7px">
                <a href="${site.preview_url}" target="_blank" class="btn btn--ghost btn--sm">Open ↗</a>
                <button class="btn btn--ghost btn--sm" onclick="Sites.openGenModal('${l.id}')">Regenerate</button>
              </div>
            </div>
          </div>
          <div style="font-size:.75rem;color:var(--text-3)">${site.view_count || 0} views · Created ${timeAgo(site.created_at)}</div>
        </div>
      ` : ''}

      <!-- Outreach messages -->
      ${l.outreach && l.outreach.length ? `
        <div class="drawer-section">
          <div class="drawer-section__title">Outreach History</div>
          ${l.outreach.map(o => `
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:11px 13px;margin-bottom:8px;font-size:.82rem">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span class="status-badge s-${o.status === 'replied' ? 'responded' : 'enriched'}">${o.status}</span>
                <span style="color:var(--text-3);font-size:.72rem">${timeAgo(o.created_at)}</span>
              </div>
              <div style="color:var(--text-2);line-height:1.5">${esc(o.message.substring(0,180))}${o.message.length>180?'…':''}</div>
              ${o.reply_preview ? `<div style="margin-top:8px;padding:8px;background:var(--green-soft);border-radius:6px;font-size:.78rem;color:var(--green)">Reply: ${esc(o.reply_preview)}</div>` : ''}
              ${o.status === 'sent' ? `<button class="btn btn--ghost btn--sm" style="margin-top:8px" onclick="Outreach.recordReply('${o.id}')">Mark as replied</button>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Timeline -->
      ${l.activities && l.activities.length ? `
        <div class="drawer-section">
          <div class="drawer-section__title">Activity Timeline</div>
          <div class="timeline">
            ${l.activities.map(a => `
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-desc">${esc(a.description || a.type)}</div>
                  <div class="timeline-time">${timeAgo(a.created_at)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  },

  close() {
    document.getElementById('drawerOverlay').classList.remove('open');
    document.getElementById('drawer').classList.remove('open');
    this.currentId = null;
  }
};

/* ── Discover ─────────────────────────────────────────────────────────────── */
const Discover = {
  async run() {
    const query = document.getElementById('discoverQuery').value.trim();
    const city  = document.getElementById('discoverCity').value.trim();
    if (!query) { Toast.show('Enter a business type to search'); return; }

    const btn = document.getElementById('discoverBtn');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching…';

    const res = await api('/api/jobs', { method: 'POST', body: { query, city } });
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Find Businesses';

    if (res.success) {
      Toast.show('✓ Search started — results will appear in Leads shortly');
      this.loadJobs();
      // Auto-refresh jobs after 5 seconds
      setTimeout(() => this.loadJobs(), 5000);
    } else {
      Toast.show('Failed to start search: ' + (res.message || 'Error'));
    }
  },

  quickSearch(query, city) {
    document.getElementById('discoverQuery').value = query;
    document.getElementById('discoverCity').value  = city;
    this.run();
  },

  async loadJobs() {
    const res = await api('/api/jobs');
    if (!res.success) return;
    const el = document.getElementById('jobsList');
    if (!res.data.length) {
      el.innerHTML = `<div class="empty-state small"><i class="fa-solid fa-clock"></i><p>No searches yet.</p></div>`;
      return;
    }
    el.innerHTML = res.data.map(j => `
      <div class="job-item">
        <div class="job-icon">${j.status === 'running' ? '<i class="fa-solid fa-spinner fa-spin" style="color:var(--amber)"></i>' : j.status === 'done' ? '<i class="fa-solid fa-check" style="color:var(--green)"></i>' : '<i class="fa-solid fa-search" style="color:var(--text-3)"></i>'}</div>
        <div>
          <div class="job-query">"${esc(j.query)}" ${j.city ? `in ${esc(j.city)}` : ''}</div>
          <div class="job-meta">${j.imported || 0} imported · ${timeAgo(j.created_at)}</div>
        </div>
        <span class="job-status js-${j.status}">${j.status}</span>
      </div>
    `).join('');
  }
};

/* ── Sites ────────────────────────────────────────────────────────────────── */
const Sites = {
  selectedTemplate: null,
  currentLeadId:    null,

  async load() {
    const res = await api('/api/leads?limit=100&sort=updated_at&order=DESC');
    if (!res.success) return;

    const withSites = res.data.filter(l => l.site_url);
    const el        = document.getElementById('sitesGrid');

    if (!withSites.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-globe"></i><p>No sites generated yet. Open a lead and click "Generate Site".</p></div>`;
      return;
    }

    el.innerHTML = withSites.map(l => `
      <div class="site-card">
        <div class="site-card__preview"><i class="fa-solid fa-globe"></i></div>
        <div class="site-card__body">
          <div class="site-card__name">${esc(l.business_name)}</div>
          <div class="site-card__meta">${capitalize(l.niche || 'general')} · ${l.city || ''}</div>
          <div class="site-card__actions">
            <a href="${l.site_url}" target="_blank" class="btn btn--ghost btn--sm">Preview ↗</a>
            <button class="btn btn--primary btn--sm" onclick="Drawer.open('${l.id}')">Open Lead</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  openGenModal(leadId) {
    this.currentLeadId    = leadId;
    this.selectedTemplate = null;
    this.loadTemplateSelector();
    document.getElementById('genSiteOverlay').classList.add('open');
  },

  closeGenModal() {
    document.getElementById('genSiteOverlay').classList.remove('open');
    this.currentLeadId    = null;
    this.selectedTemplate = null;
  },

  async loadTemplateSelector() {
    const res = await api('/api/templates');
    if (!res.success) return;
    const el = document.getElementById('templateSelector');
    el.innerHTML = res.data.map(t => `
      <div class="template-card" onclick="Sites.selectTemplate('${t.id}', this)">
        <div class="template-card__icon" style="background:var(--accent-soft);color:var(--accent)">${nicheIcon(t.niche)}</div>
        <div class="template-card__name">${esc(t.name)}</div>
        <div class="template-card__desc">${esc(t.description || '')}</div>
        <div class="template-card__uses">Used ${t.use_count} times</div>
      </div>
    `).join('');
  },

  selectTemplate(id, el) {
    this.selectedTemplate = id;
    document.querySelectorAll('#templateSelector .template-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  },

  async generate() {
    if (!this.selectedTemplate) { Toast.show('Please select a template first'); return; }

    const btn = document.getElementById('genSiteBtn');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…';

    const res = await api('/api/sites/generate', {
      method: 'POST',
      body:   { lead_id: this.currentLeadId, template_id: this.selectedTemplate }
    });

    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate';

    if (res.success) {
      Toast.show('✓ Website generated!');
      this.closeGenModal();
      window.open(res.data.preview_url, '_blank');
      if (Drawer.currentId) Drawer.open(Drawer.currentId);  // Refresh drawer
    } else {
      Toast.show('Generation failed: ' + (res.message || 'Error'));
    }
  }
};

/* ── Outreach ─────────────────────────────────────────────────────────────── */
const Outreach = {
  async openChat(leadId) {
    const res = await api('/api/outreach/compose', { method: 'POST', body: { lead_id: leadId } });
    if (!res.success) { Toast.show('Failed to compose message'); return; }

    const { message, whatsapp_url } = res.data;

    // Show composed message in a simple dialog
    const confirmed = confirm(`MESSAGE PREVIEW:\n\n${message}\n\nClick OK to open WhatsApp and mark as sent.`);
    if (!confirmed) return;

    if (whatsapp_url) window.open(whatsapp_url, '_blank');

    // Mark as sent
    const sendRes = await api('/api/outreach/send', { method: 'POST', body: { lead_id: leadId, message } });
    if (sendRes.success) {
      Toast.show('✓ Marked as sent. Remember to check for replies!');
      Leads.load();
      if (Drawer.currentId) Drawer.open(Drawer.currentId);
    }
  },

  async recordReply(outreachId) {
    const reply = prompt('What did they say? (brief summary)');
    if (!reply) return;
    const res = await api(`/api/outreach/${outreachId}/reply`, { method: 'PATCH', body: { reply_preview: reply } });
    if (res.success) {
      Toast.show('✓ Reply recorded — status updated to Responded');
      if (Drawer.currentId) Drawer.open(Drawer.currentId);
      Leads.load();
    }
  }
};

/* ── Outreach Page ───────────────────────────────────────────────────────── */
const OutreachPage = {
  async load() {
    const status = document.getElementById('outreachFilter')?.value || '';
    const params = status ? `?status=${status}` : '';
    const res    = await api(`/api/outreach${params}`);
    if (!res.success) return;

    const el = document.getElementById('outreachList');
    if (!res.data.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-brands fa-whatsapp"></i><p>No messages yet. Find a lead and click "Let's Chat" to compose your first message.</p></div>`;
      return;
    }

    el.innerHTML = res.data.map(o => `
      <div class="outreach-card">
        <div class="outreach-card__top">
          <div>
            <div class="outreach-card__name">${esc(o.business_name)}</div>
            <div class="outreach-card__date">${timeAgo(o.created_at)} · ${o.channel}</div>
          </div>
          <span class="status-badge s-${o.status === 'replied' ? 'responded' : 'enriched'}">${o.status}</span>
        </div>
        <div class="outreach-card__msg">${esc(o.message)}</div>
        ${o.reply_preview ? `<div style="background:var(--green-soft);border-radius:var(--r);padding:10px 12px;font-size:.82rem;color:var(--green);margin-bottom:12px"><strong>Reply:</strong> ${esc(o.reply_preview)}</div>` : ''}
        <div class="outreach-card__actions">
          <button class="btn btn--ghost btn--sm" onclick="Drawer.open('${o.lead_id}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> View Lead</button>
          ${o.status === 'sent' ? `<button class="btn btn--primary btn--sm" onclick="Outreach.recordReply('${o.id}')"><i class="fa-solid fa-reply"></i> Record Reply</button>` : ''}
          ${o.lead_id && o.phone ? `<a href="https://wa.me/${o.phone?.replace(/\D/g,'')}" target="_blank" class="btn btn--wa btn--sm"><i class="fa-brands fa-whatsapp"></i> Open Chat</a>` : ''}
        </div>
      </div>
    `).join('');
  }
};

/* ── Templates Page ──────────────────────────────────────────────────────── */
const TemplatesPage = {
  async load() {
    const res = await api('/api/templates');
    if (!res.success) return;
    const el = document.getElementById('templatesGrid');
    el.innerHTML = res.data.map(t => `
      <div class="template-card">
        <div class="template-card__icon" style="background:var(--accent-soft);color:var(--accent)">${nicheIcon(t.niche)}</div>
        <div class="template-card__name">${esc(t.name)}</div>
        <div class="template-card__desc">${esc(t.description || '')}</div>
        <div class="template-card__uses">Used ${t.use_count} times · ${(t.convert_rate*100).toFixed(0)}% conversion</div>
      </div>
    `).join('');
  }
};

/* ── Settings ─────────────────────────────────────────────────────────────── */
const Settings = {
  async load() {
    const res = await api('/api/settings');
    if (!res.success) return;
    const d = res.data;
    document.getElementById('s-name').value  = d.business_name  || '';
    document.getElementById('s-wa').value    = d.whatsapp_number|| '';
    document.getElementById('s-city').value  = d.default_city   || '';
    document.getElementById('s-limit').value = d.daily_limit    || '20';
    document.getElementById('s-delay').value = d.message_delay  || '45';
  },

  async save() {
    const payload = {
      business_name:   document.getElementById('s-name').value,
      whatsapp_number: document.getElementById('s-wa').value,
      default_city:    document.getElementById('s-city').value,
      daily_limit:     document.getElementById('s-limit').value,
      message_delay:   document.getElementById('s-delay').value,
    };
    const res = await api('/api/settings', { method: 'PATCH', body: payload });
    if (res.success) Toast.show('✓ Settings saved');
    else Toast.show('Failed to save settings');
  }
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusLabel(s) {
  return { new:'New', enriched:'Enriched', outreach_sent:'Outreach Sent', responded:'Responded', converted:'Converted', lost:'Lost' }[s] || s;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function nicheIcon(niche) {
  const icons = { 
    salon: '💇', 
    restaurant: '🍽️', 
    clinic: '🏥', 
    retail: '🛍️', 
    education: '📚', 
    hospitality: '🏨', 
    fitness: '💪', 
    general: '🏢',
    plumber: '🔧',
    locksmith: '🔒',
    contractor: '🏗️'
  };
  return icons[niche] || '🏢';
}

/* ── Boot ──────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());
