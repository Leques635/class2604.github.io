/* =========================================================
   home.js —— 首页
   ========================================================= */

(() => {
  const heroHost = document.querySelector('[data-hero]');
  const statsHost = document.querySelector('[data-stats]');
  const upcomingHost = document.querySelector('[data-upcoming]');
  const noticesHost = document.querySelector('[data-notices]');

  const CATEGORY_COLORS = {
    '考试': '#e5484d',
    '活动': '#8b5cf6',
    '班会': '#4f6ef7',
    '假期': '#0f9d76',
    '作业': '#f59e0b',
    '其他': '#64748b'
  };

  /* ---------- 首页各区块 ---------- */
  function render() {
    const { meta, notices } = Store.data;
    const todayISO = Store.todayISO();
    const todayEvents = Store.eventsByDate()[todayISO] || [];
    const upcoming = Store.upcomingEvents(5);
    const stamp = meta.updatedAt ? new Date(meta.updatedAt) : null;
    const stampText = stamp && !isNaN(stamp)
      ? `${stamp.getFullYear()}-${UI.pad(stamp.getMonth() + 1)}-${UI.pad(stamp.getDate())}`
      : '—';

    /* 头部 */
    heroHost.innerHTML = `
      <div class="hero">
        <div class="hero-meta">
          <span class="badge badge-accent badge-dot">${UI.esc(UI.fmtDateFull(todayISO))} ${UI.weekdayOf(todayISO)}</span>
          <span class="badge">数据更新于 ${stampText}</span>
        </div>
        <h1>${UI.esc(meta.className)}</h1>
        <p class="lead">${UI.esc(meta.slogan || '班级日程与公告，都在这一页。')}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="calendar.html">日程日历</a>
          <button class="btn btn-ghost no-print" data-admin-open>数据管理</button>
        </div>
      </div>`;

    /* 数据卡片 */
    statsHost.innerHTML = `
      <div class="grid grid-3">
        <div class="stat"><b>${countThisWeek()}</b><span>本周日程</span></div>
        <div class="stat"><b>${countThisMonth()}</b><span>本月日程</span></div>
        <div class="stat"><b>${notices.length}</b><span>条公告</span></div>
      </div>`;

    /* 今天 + 接下来 */
    const blocks = [];
    if (todayEvents.length) {
      blocks.push(`<div style="margin-bottom:14px">
        <h3 style="margin-bottom:8px">今天的日程</h3>
        <ul class="ev-list">${todayEvents.map(evListItem).join('')}</ul>
      </div>`);
    }
    if (upcoming.length) {
      blocks.push(`<h3 style="margin-bottom:8px">接下来</h3>
        <ul class="ev-list">${upcoming.map(evListItem).join('')}</ul>`);
    }
    upcomingHost.innerHTML = blocks.length
      ? blocks.join('')
      : `<div class="empty">近期没有日程安排。${Store.isEditMode() ? '去日历里点一天就能添加。' : '打开「管理 → 编辑模式」就可以添加。'}</div>`;

    /* 公告 */
    if (!notices.length) {
      noticesHost.innerHTML = `<div class="empty">还没有公告。${Store.isEditMode() ? '点右上角「＋ 添加公告」。' : ''}</div>`;
    } else {
      const sorted = [...notices].sort((a, b) => (b.pinned - a.pinned) || (b.date || '').localeCompare(a.date || ''));
      noticesHost.innerHTML = sorted.map((n) => `
        <div class="notice-item" data-notice="${UI.esc(n.id)}"
             style="${Store.isEditMode() ? 'cursor:pointer' : ''}">
          <div class="notice-body">
            <h3>${n.pinned ? '📌 ' : ''}${UI.esc(n.title)}</h3>
            <p>${UI.esc(n.body)}</p>
            ${n.date ? `<span class="notice-date">${UI.esc(UI.fmtDateFull(n.date))}</span>` : ''}
          </div>
          ${Store.isEditMode() ? `<button class="btn btn-sm btn-ghost" data-notice="${UI.esc(n.id)}" title="编辑">✏️</button>` : ''}
        </div>`).join('');
    }

    /* 只在编辑模式显示的按钮 */
    document.querySelectorAll('[data-edit-only]').forEach((el) => {
      el.hidden = !Store.isEditMode();
    });
  }

  function evListItem(ev) {
    const c = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS['其他'];
    const time = ev.time ? `${ev.time}${ev.endTime ? '–' + ev.endTime : ''}` : '';
    const span = ev.endDate && ev.endDate !== ev.date ? `至 ${UI.fmtDate(ev.endDate)}` : '';
    return `<li class="ev-item" style="--c:${c}">
      <div class="ev-date"><b>${UI.fmtDate(ev.date)}</b>${UI.relDay(ev.date)}</div>
      <div class="ev-body">
        <div class="ev-title">${UI.esc(ev.title)}</div>
        <div class="ev-meta">
          ${time ? `<span>🕘 ${UI.esc(time)}</span>` : ''}
          ${span ? `<span>${UI.esc(span)}</span>` : ''}
          ${ev.location ? `<span>📍 ${UI.esc(ev.location)}</span>` : ''}
        </div>
      </div>
    </li>`;
  }

  /** 与本周（周一至周日）有交集的日程数 */
  function countThisWeek() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay() === 0 ? 7 : now.getDay();   // 周一为一周开始
    const monday = new Date(now); monday.setDate(now.getDate() - (day - 1));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return countInRange(UI.iso(monday), UI.iso(sunday));
  }

  /** 与本月有交集的日程数 */
  function countThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return countInRange(UI.iso(first), UI.iso(last));
  }

  function countInRange(from, to) {
    return Store.data.events.filter((ev) => {
      const start = ev.date;
      const end = ev.endDate || ev.date;
      return start <= to && end >= from;
    }).length;
  }

  /* ---------- 公告编辑 ---------- */
  function openNoticeEditor(id) {
    if (!Store.isEditMode()) { UI.toast('先在「管理」里打开编辑模式'); return; }
    const isNew = !id;
    const n = isNew
      ? { title: '', body: '', date: Store.todayISO(), pinned: false }
      : Store.data.notices.find((x) => x.id === id);
    if (!n) return;

    UI.openModal(
      `<div class="modal-head">
         <h3>${isNew ? '添加公告' : '编辑公告'}</h3>
         <div class="spacer"></div>
         <button class="btn btn-sm btn-ghost" data-close>关闭</button>
       </div>
       <form data-form>
         <label class="field"><span>标题 *</span>
           <input type="text" name="title" value="${UI.esc(n.title)}" placeholder="如：选课截止提醒" required>
         </label>
         <label class="field"><span>内容</span>
           <textarea name="body" placeholder="写点什么……">${UI.esc(n.body)}</textarea>
         </label>
         <div class="row" style="margin-bottom:12px">
           <label class="field"><span>日期</span>
             <input type="date" name="date" value="${UI.esc(n.date)}">
           </label>
           <div class="field" style="flex:0 0 auto">
             <span>置顶</span>
             <label class="switch" style="height:38px">
               <input type="checkbox" aria-label="置顶" name="pinned" ${n.pinned ? 'checked' : ''}>
               <span class="switch-track"></span>
             </label>
           </div>
         </div>
         <div class="modal-actions">
           ${isNew ? '' : '<button type="button" class="btn btn-danger btn-sm left" data-del>删除</button>'}
           <button type="button" class="btn" data-close>取消</button>
           <button type="submit" class="btn btn-primary">保存</button>
         </div>
       </form>`,
      {
        onMount(box, close) {
          const form = box.querySelector('[data-form]');
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const title = String(fd.get('title') || '').trim();
            if (!title) { UI.toast('标题不能为空', 'err'); return; }
            const payload = {
              title,
              body: String(fd.get('body') || '').trim(),
              date: String(fd.get('date') || ''),
              pinned: fd.get('pinned') === 'on'
            };
            Store.save((d) => {
              if (isNew) d.notices.unshift({ id: Store.uid('nt'), ...payload });
              else {
                const target = d.notices.find((x) => x.id === id);
                if (target) Object.assign(target, payload);
              }
            });
            UI.toast(isNew ? '公告已添加' : '公告已更新', 'ok');
            close();
          });

          const delBtn = box.querySelector('[data-del]');
          if (delBtn) {
            delBtn.addEventListener('click', async () => {
              const ok = await UI.confirmDialog(`删除公告「${n.title}」？`, { okText: '删除', danger: true });
              if (!ok) return;
              Store.save((d) => { d.notices = d.notices.filter((x) => x.id !== id); });
              UI.toast('已删除', 'ok');
              close();
            });
          }
        }
      }
    );
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener('click', (e) => {
    const notice = e.target.closest('[data-notice]');
    if (notice) { openNoticeEditor(notice.dataset.notice); return; }
    if (e.target.closest('[data-new-notice]')) { openNoticeEditor(null); }
  });

  /* ---------- 启动 ---------- */
  (async () => {
    await Store.load();
    UI.initShell('index.html');
    render();
    Store.onChange(render);
  })();
})();
