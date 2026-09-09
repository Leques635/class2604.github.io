/* =========================================================
   calendar.js —— 日程日历页
   ========================================================= */

(() => {
  const CATEGORIES = {
    '考试': '#e5484d',
    '活动': '#8b5cf6',
    '班会': '#4f6ef7',
    '假期': '#0f9d76',
    '作业': '#f59e0b',
    '其他': '#64748b'
  };
  const catColor = (name) => CATEGORIES[name] || CATEGORIES['其他'];

  const gridHost = document.querySelector('[data-cal-grid]');
  const titleHost = document.querySelector('[data-cal-title]');
  const listHost = document.querySelector('[data-ev-list]');

  const today = new Date();
  let view = { year: today.getFullYear(), month: today.getMonth() };

  /* ---------- 渲染日历 ---------- */
  function render() {
    const byDate = Store.eventsByDate();
    const todayISO = Store.todayISO();

    titleHost.textContent = `${view.year} 年 ${view.month + 1} 月`;

    const first = new Date(view.year, view.month, 1);
    const startOffset = first.getDay();            // 周日为 0
    const gridStart = new Date(view.year, view.month, 1 - startOffset);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = UI.iso(d);
      const out = d.getMonth() !== view.month;
      const list = byDate[key] || [];
      const shown = list.slice(0, 3);

      cells.push(`
        <div class="cal-day${out ? ' out' : ''}${key === todayISO ? ' today' : ''}"
             data-date="${key}">
          <div class="cal-num">
            <span>${d.getDate() === 1 ? (d.getMonth() + 1) + '月1日' : d.getDate()}</span>
            ${list.length > 3 ? `<span class="cal-more">+${list.length - 3}</span>` : ''}
          </div>
          ${shown.map((ev) => `
            <button type="button" class="cal-ev" data-ev="${UI.esc(ev.id)}"
                    style="--c:${catColor(ev.category)}"
                    title="${UI.esc(ev.title)}">
              ${ev.time ? `<span style="opacity:.75">${UI.esc(ev.time)}</span> ` : ''}${UI.esc(ev.title)}
            </button>`).join('')}
        </div>`);
    }
    gridHost.innerHTML = cells.join('');
    renderList();
  }

  /* ---------- 渲染即将到来的日程 ---------- */
  function renderList() {
    const items = Store.upcomingEvents(30);
    if (!items.length) {
      listHost.innerHTML = `<div class="empty">还没有日程。${Store.isEditMode() ? '点上面的「新建日程」，或直接点日历里的某一天。' : '打开「管理 → 编辑模式」就可以添加。'}</div>`;
      return;
    }
    listHost.innerHTML = `<ul class="ev-list">${items.map((ev) => {
      const time = ev.time ? `${ev.time}${ev.endTime ? '–' + ev.endTime : ''}` : '';
      const span = ev.endDate && ev.endDate !== ev.date ? ` 至 ${UI.fmtDate(ev.endDate)}` : '';
      return `<li class="ev-item" style="--c:${catColor(ev.category)}">
        <div class="ev-date">
          <b>${UI.fmtDate(ev.date)}</b>
          ${UI.weekdayOf(ev.date)} · ${UI.relDay(ev.date)}
        </div>
        <div class="ev-body">
          <div class="ev-title">${UI.esc(ev.title)}</div>
          <div class="ev-meta">
            <span class="badge" style="background:color-mix(in srgb,${catColor(ev.category)} 16%,transparent);color:color-mix(in srgb,${catColor(ev.category)} 78%,var(--text))">${UI.esc(ev.category)}</span>
            ${time ? `<span>🕘 ${UI.esc(time)}</span>` : ''}
            ${span ? `<span>${UI.esc(span)}</span>` : ''}
            ${ev.location ? `<span>📍 ${UI.esc(ev.location)}</span>` : ''}
          </div>
          ${ev.note ? `<div class="ev-note">${UI.esc(ev.note)}</div>` : ''}
        </div>
        <div class="ev-actions no-print">
          <button class="btn btn-sm btn-ghost" data-ev="${UI.esc(ev.id)}" title="编辑">✏️</button>
        </div>
      </li>`;
    }).join('')}</ul>`;
  }

  /* ---------- 日程编辑 ---------- */
  function openEditor(evId, presetDate) {
    const isNew = !evId;
    if (!Store.isEditMode()) {
      if (isNew) { UI.toast('先在「管理」里打开编辑模式'); return; }
      showDetail(evId);
      return;
    }

    const ev = isNew
      ? { id: '', title: '', date: presetDate || Store.todayISO(), endDate: '', time: '', endTime: '', category: '其他', location: '', note: '' }
      : Store.data.events.find((x) => x.id === evId);
    if (!ev) return;

    UI.openModal(
      `<div class="modal-head">
         <h3>${isNew ? '新建日程' : '编辑日程'}</h3>
         <div class="spacer"></div>
         <button class="btn btn-sm btn-ghost" data-close>关闭</button>
       </div>
       <form data-form>
         <label class="field"><span>标题 *</span>
           <input type="text" name="title" value="${UI.esc(ev.title)}" placeholder="如：期中考试" required>
         </label>
         <div class="row" style="margin-bottom:12px">
           <label class="field"><span>分类</span>
             <select name="category">
               ${Object.keys(CATEGORIES).map((c) => `<option value="${c}"${c === ev.category ? ' selected' : ''}>${c}</option>`).join('')}
             </select>
           </label>
           <label class="field"><span>地点</span>
             <input type="text" name="location" value="${UI.esc(ev.location)}" placeholder="如：教学楼 302">
           </label>
         </div>
         <div class="row" style="margin-bottom:12px">
           <label class="field"><span>开始日期 *</span>
             <input type="date" name="date" value="${UI.esc(ev.date)}" required>
           </label>
           <label class="field"><span>结束日期（可留空）</span>
             <input type="date" name="endDate" value="${UI.esc(ev.endDate)}">
           </label>
         </div>
         <div class="row" style="margin-bottom:12px">
           <label class="field"><span>开始时间</span>
             <input type="time" name="time" value="${UI.esc(ev.time)}">
           </label>
           <label class="field"><span>结束时间</span>
             <input type="time" name="endTime" value="${UI.esc(ev.endTime)}">
           </label>
         </div>
         <label class="field"><span>备注</span>
           <textarea name="note" placeholder="需要带什么、注意事项……">${UI.esc(ev.note)}</textarea>
         </label>
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
            const date = String(fd.get('date') || '');
            if (!title) { UI.toast('标题不能为空', 'err'); return; }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { UI.toast('请选择开始日期', 'err'); return; }

            const endDate = String(fd.get('endDate') || '');
            const payload = {
              title,
              date,
              endDate: endDate && endDate >= date ? endDate : '',
              time: String(fd.get('time') || ''),
              endTime: String(fd.get('endTime') || ''),
              category: String(fd.get('category') || '其他'),
              location: String(fd.get('location') || '').trim(),
              note: String(fd.get('note') || '').trim()
            };

            Store.save((d) => {
              if (isNew) {
                d.events.push({ id: Store.uid('ev'), ...payload });
              } else {
                const target = d.events.find((x) => x.id === evId);
                if (target) Object.assign(target, payload);
              }
              d.events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
            });
            UI.toast(isNew ? '日程已添加' : '日程已更新', 'ok');
            close();
          });

          const delBtn = box.querySelector('[data-del]');
          if (delBtn) {
            delBtn.addEventListener('click', async () => {
              const ok = await UI.confirmDialog(`删除「${ev.title}」？`, { okText: '删除', danger: true });
              if (!ok) return;
              Store.save((d) => { d.events = d.events.filter((x) => x.id !== evId); });
              UI.toast('已删除', 'ok');
              close();
            });
          }
        }
      }
    );
  }

  /* ---------- 只读详情 ---------- */
  function showDetail(evId) {
    const ev = Store.data.events.find((x) => x.id === evId);
    if (!ev) return;
    const time = ev.time ? `${ev.time}${ev.endTime ? ' – ' + ev.endTime : ''}` : '';
    const span = ev.endDate && ev.endDate !== ev.date
      ? `${UI.fmtDateFull(ev.date)} 至 ${UI.fmtDateFull(ev.endDate)}`
      : `${UI.fmtDateFull(ev.date)} ${UI.weekdayOf(ev.date)}`;

    UI.openModal(
      `<div class="modal-head">
         <span class="badge" style="background:color-mix(in srgb,${catColor(ev.category)} 16%,transparent);color:color-mix(in srgb,${catColor(ev.category)} 78%,var(--text))">${UI.esc(ev.category)}</span>
         <div class="spacer"></div>
         <button class="btn btn-sm btn-ghost" data-close>关闭</button>
       </div>
       <h2 style="margin-bottom:10px">${UI.esc(ev.title)}</h2>
       <div class="ev-meta" style="margin-bottom:10px">
         <span>📅 ${UI.esc(span)}</span>
         ${time ? `<span>🕘 ${UI.esc(time)}</span>` : ''}
         ${ev.location ? `<span>📍 ${UI.esc(ev.location)}</span>` : ''}
       </div>
       ${ev.note ? `<p style="color:var(--text-dim);white-space:pre-wrap">${UI.esc(ev.note)}</p>` : ''}
       <div class="modal-actions">
         <button class="btn" data-close>关闭</button>
         ${UI.adminUnlocked() ? '<button class="btn btn-primary" data-edit-this>编辑</button>' : ''}
       </div>`,
      {
        onMount(box, close) {
          const editBtn = box.querySelector('[data-edit-this]');
          if (editBtn) editBtn.addEventListener('click', () => {
            close();
            if (!Store.isEditMode()) { Store.setEditMode(true); UI.toast('已自动打开编辑模式', 'ok'); }
            openEditor(evId);
          });
        }
      }
    );
  }

  /* ---------- 访客视角：看某一天有什么安排 ---------- */
  function showDay(date) {
    const list = Store.eventsByDate()[date] || [];
    UI.openModal(
      `<div class="modal-head">
         <h3>${UI.esc(UI.fmtDateFull(date))} ${UI.esc(UI.weekdayOf(date))}</h3>
         <div class="spacer"></div>
         <button class="btn btn-sm btn-ghost" data-close>关闭</button>
       </div>
       ${list.length
         ? `<ul class="ev-list">${list.map((ev) => `
             <li class="ev-item" style="--c:${catColor(ev.category)}">
               <div class="ev-body">
                 <div class="ev-title">${UI.esc(ev.title)}</div>
                 <div class="ev-meta">
                   <span class="badge" style="background:color-mix(in srgb,${catColor(ev.category)} 16%,transparent);color:color-mix(in srgb,${catColor(ev.category)} 78%,var(--text))">${UI.esc(ev.category)}</span>
                   ${ev.time ? `<span>🕘 ${UI.esc(ev.time)}${ev.endTime ? '–' + UI.esc(ev.endTime) : ''}</span>` : ''}
                   ${ev.location ? `<span>📍 ${UI.esc(ev.location)}</span>` : ''}
                 </div>
                 ${ev.note ? `<div class="ev-note">${UI.esc(ev.note)}</div>` : ''}
               </div>
             </li>`).join('')}</ul>`
         : '<div class="empty">这天没有安排。</div>'}
       <div class="modal-actions">
         <button class="btn" data-close>关闭</button>
       </div>`
    );
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener('click', (e) => {
    const evBtn = e.target.closest('[data-ev]');
    if (evBtn) { e.stopPropagation(); openEditor(evBtn.dataset.ev); return; }

    const dayCell = e.target.closest('.cal-day');
    if (dayCell) {
      if (Store.isEditMode()) openEditor(null, dayCell.dataset.date);
      else showDay(dayCell.dataset.date);
      return;
    }

    if (e.target.closest('[data-nav-prev]')) { shiftMonth(-1); return; }
    if (e.target.closest('[data-nav-next]')) { shiftMonth(1); return; }
    if (e.target.closest('[data-nav-today]')) {
      view = { year: today.getFullYear(), month: today.getMonth() };
      render(); return;
    }
    if (e.target.closest('[data-new-event]')) { openEditor(null, Store.todayISO()); }
  });

  function shiftMonth(delta) {
    const d = new Date(view.year, view.month + delta, 1);
    view = { year: d.getFullYear(), month: d.getMonth() };
    render();
  }

  /* ---------- 启动 ---------- */
  (async () => {
    await Store.load();
    UI.initShell('calendar.html');
    // 普通访客不显示「新建日程」
    const newBtn = document.querySelector('[data-new-event]');
    if (newBtn && !UI.adminUnlocked()) newBtn.hidden = true;
    render();
    Store.onChange(render);
  })();
})();
