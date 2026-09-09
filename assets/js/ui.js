/* =========================================================
   ui.js —— 公共界面：页头/页脚、弹窗、提示、管理面板
   ========================================================= */

const UI = (() => {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  /* ---------- 提示 ---------- */
  let toastHost = null;
  function toast(message, type = '') {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = message;
    toastHost.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, 2200);
  }

  /* ---------- 弹窗 ---------- */
  function openModal(html, { wide = false, onMount } = {}) {
    const host = document.createElement('div');
    host.className = 'modal';
    host.innerHTML = `<div class="modal-box${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(host);
    document.body.style.overflow = 'hidden';

    const close = () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      host.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    host.addEventListener('mousedown', (e) => { if (e.target === host) close(); });
    host.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));

    if (onMount) onMount(host.querySelector('.modal-box'), close);
    const firstInput = host.querySelector('input, select, textarea, button');
    if (firstInput) setTimeout(() => firstInput.focus(), 30);

    return { close, root: host };
  }

  function confirmDialog(message, { title = '确认操作', okText = '确定', danger = false } = {}) {
    return new Promise((resolve) => {
      const { close } = openModal(
        `<div class="modal-head"><h3>${esc(title)}</h3></div>
         <p style="color:var(--text-dim)">${esc(message)}</p>
         <div class="modal-actions">
           <button class="btn" data-close>取消</button>
           <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>
         </div>`,
        {
          onMount(box, closeFn) {
            box.querySelector('[data-ok]').addEventListener('click', () => { closeFn(); resolve(true); });
            box.addEventListener('click', (e) => {
              if (e.target.closest('[data-close]')) resolve(false);
            });
            box.closest('.modal').addEventListener('mousedown', (e) => {
              if (e.target === e.currentTarget) resolve(false);
            });
          }
        }
      );
      void close;
    });
  }

  /* ---------- 日期工具 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /** "2026-09-09" → "9月9日" */
  function fmtDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return value || '';
    return `${Number(m[2])}月${Number(m[3])}日`;
  }

  function fmtDateFull(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return value || '';
    return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
  }

  /** 相对日期：今天 / 明天 / 3天后 / 已结束 */
  function relDay(value) {
    if (!value) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(value + 'T00:00:00');
    const diff = Math.round((target - today) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    if (diff > 0) return `${diff} 天后`;
    return `${-diff} 天前`;
  }

  function weekdayOf(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Store.DAY_KEYS[d.getDay()];
  }

  /* ---------- 页头 / 页脚 ---------- */
  const NAV = [
    { href: 'index.html', label: '首页' },
    { href: 'calendar.html', label: '日程' }
  ];

  function renderHeader(current) {
    const slot = document.querySelector('[data-header]');
    if (!slot) return;
    const meta = Store.data.meta;
    slot.outerHTML = `
      <header class="site-header">
        <div class="wrap">
          <a class="brand" href="index.html">
            <span class="brand-mark">班</span>
            <span class="brand-text">
              <span data-bind="className">${esc(meta.className)}</span>
              <small>班级主页</small>
            </span>
          </a>
          <nav class="nav">
            ${NAV.map((n) => `<a href="${n.href}"${n.href === current ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
          </nav>
          <div class="header-tools">
            <button class="btn btn-icon btn-ghost" data-theme-toggle title="切换深浅色" aria-label="切换深浅色">
              <span data-theme-icon>🌙</span>
            </button>
            <button class="btn btn-sm" data-admin-open title="数据管理">管理</button>
          </div>
        </div>
      </header>`;
  }

  function renderFooter() {
    const slot = document.querySelector('[data-footer]');
    if (!slot) return;
    const meta = Store.data.meta;
    const stamp = meta.updatedAt ? new Date(meta.updatedAt) : null;
    const stampText = stamp && !isNaN(stamp)
      ? `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`
      : '—';
    slot.outerHTML = `
      <footer class="site-footer">
        <div class="wrap">
          <span>${esc(meta.className)} · 数据更新于 ${stampText}</span>
          <span>由 GitHub Pages 托管 · <a href="#" data-admin-open>数据管理</a></span>
        </div>
      </footer>`;
  }

  /* ---------- 在线发布配置 ---------- */
  function openPublishConfig() {
    const cfg = Publisher.getConfig();

    openModal(
      `<div class="modal-head">
         <h3>配置在线发布</h3>
         <div class="spacer"></div>
         <button class="btn btn-sm btn-ghost" data-close>关闭</button>
       </div>
       <form data-form>
         <div class="row" style="margin-bottom:12px">
           <label class="field"><span>GitHub 用户名 *</span>
             <input name="owner" value="${esc(cfg.owner)}" placeholder="例如 zhangsan" required>
           </label>
           <label class="field"><span>仓库名 *</span>
             <input name="repo" value="${esc(cfg.repo)}" placeholder="例如 class-site" required>
           </label>
         </div>
         <div class="row" style="margin-bottom:12px">
           <label class="field"><span>分支</span>
             <input name="branch" value="${esc(cfg.branch)}" placeholder="main">
           </label>
           <label class="field"><span>数据文件路径</span>
             <input name="path" value="${esc(cfg.path)}" placeholder="data/site-data.json">
           </label>
         </div>
         <label class="field"><span>访问令牌（fine-grained PAT）*</span>
           <input name="token" type="password" value="${esc(cfg.token)}" placeholder="github_pat_..." autocomplete="off" required>
         </label>
         <label class="field-inline" style="margin-bottom:12px">
           <input type="checkbox" name="remember" ${cfg.remember ? 'checked' : ''}>
           <span>在这台设备上记住令牌（不勾选则关掉浏览器就要重新填）</span>
         </label>
         <details style="margin-bottom:6px">
           <summary style="cursor:pointer;font-size:.88rem;color:var(--accent)">怎么创建一个令牌？</summary>
           <ol style="font-size:.84rem;color:var(--text-dim);padding-left:20px;margin:8px 0 0;line-height:1.8">
             <li>打开 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>
             <li>Token name 随便填，Expiration 选个期限（比如 90 天）</li>
             <li>Repository access → Only select repositories → 选中班级仓库</li>
             <li>Permissions → Repository permissions → <b>Contents</b> 设为 <b>Read and write</b></li>
             <li>Generate token 后复制令牌（只显示一次），粘贴到上面</li>
           </ol>
         </details>
         <p style="font-size:.8rem;color:var(--text-faint);margin-bottom:0">
           令牌只存在你自己的浏览器里，用来让 GitHub 认得出你。拿到令牌的人才能发布，所以「哪些人能改」就等于「你把这个令牌给谁」。
         </p>
         <div class="modal-actions">
           <button type="button" class="btn btn-sm left" data-test>测试连接</button>
           <button type="button" class="btn" data-close>取消</button>
           <button type="submit" class="btn btn-primary">保存</button>
         </div>
       </form>`,
      {
        wide: true,
        onMount(box, close) {
          const form = box.querySelector('[data-form]');
          const readForm = () => ({
            owner: form.elements.owner.value.trim(),
            repo: form.elements.repo.value.trim(),
            branch: form.elements.branch.value.trim() || 'main',
            path: form.elements.path.value.trim() || 'data/site-data.json',
            token: form.elements.token.value.trim(),
            remember: form.elements.remember.checked
          });

          box.querySelector('[data-test]').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = '测试中…';
            try {
              const info = await Publisher.testConnection(readForm());
              toast(`连接成功：${info.fullName}（默认分支 ${info.defaultBranch}）`, 'ok');
            } catch (err) {
              toast('测试失败：' + err.message, 'err');
            } finally {
              btn.disabled = false;
              btn.textContent = '测试连接';
            }
          });

          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const values = readForm();
            if (!values.owner || !values.repo) { toast('用户名和仓库名不能为空', 'err'); return; }
            if (!values.token) { toast('访问令牌不能为空', 'err'); return; }
            Publisher.saveConfig(values);
            toast('已保存，现在可以发布了', 'ok');
            close();
            openAdminPanel();
          });
        }
      }
    );
  }

  /* ---------- 管理面板 ---------- */
  function openAdminPanel() {
    const edit = Store.isEditMode();
    const draft = Store.hasDraft();
    const changes = Store.hasChanges();
    const cfg = Publisher.getConfig();
    const ready = Publisher.isConfigured();
    const last = Publisher.getLastPublish();

    const stateText = {
      ok: '已加载仓库里的 site-data.json',
      fallback: `读取 data/site-data.json 失败（${Store.loadError}），正在用本地草稿或默认数据`,
      idle: '未加载'
    }[Store.loadState] || '';

    const lastText = last
      ? `上次发布：${new Date(last.at).toLocaleString('zh-CN')}${last.url ? ` · <a href="${esc(last.url)}" target="_blank" rel="noopener">查看提交</a>` : ''}`
      : '还没有通过网页发布过';

    openModal(
      `<div class="modal-head">
         <h3>数据管理</h3>
         <div class="spacer"></div>
         <button class="btn btn-sm btn-ghost" data-close>关闭</button>
       </div>
       <p style="color:var(--text-dim);font-size:.88rem;margin-bottom:14px">${esc(stateText)}</p>

       <div class="admin-grid">
         <div class="admin-row">
           <div class="info">
             <b>编辑模式</b>
             <span>打开后，日程日期和公告都可以点击编辑</span>
           </div>
           <label class="switch">
             <input type="checkbox" aria-label="编辑模式" data-edit-toggle ${edit ? 'checked' : ''}>
             <span class="switch-track"></span>
           </label>
         </div>

         <div class="admin-row">
           <div class="info">
             <b>在线发布（GitHub）</b>
             <span>${ready
               ? `提交到 <code>${esc(cfg.owner)}/${esc(cfg.repo)}</code> · ${esc(cfg.branch)} · ${esc(cfg.path)}<br>${lastText}`
               : '配置访问令牌后，改完点一下就能提交到仓库，全班刷新即可看到'}</span>
           </div>
           <div class="admin-actions">
             ${ready
               ? `<button class="btn btn-primary btn-sm" data-publish ${changes ? '' : 'disabled'}>${changes ? '发布到 GitHub' : '没有待发布的修改'}</button>
                  <button class="btn btn-sm" data-pull>拉取最新</button>
                  <button class="btn btn-sm" data-configure>配置</button>
                  <button class="btn btn-sm btn-danger" data-forget>清除</button>`
               : `<button class="btn btn-primary btn-sm" data-configure>配置在线发布</button>`}
           </div>
         </div>

         <div class="admin-row">
           <div class="info">
             <b>手动导出</b>
             <span>导出后用文件覆盖仓库里的 <code>data/site-data.json</code>，适合没配令牌时用</span>
           </div>
           <button class="btn btn-sm" data-export>导出 site-data.json</button>
         </div>

         <div class="admin-row">
           <div class="info">
             <b>备份 / 导入</b>
             <span>备份当前全部数据，或从 JSON 文件恢复</span>
           </div>
           <button class="btn btn-sm" data-backup>导出备份</button>
           <button class="btn btn-sm" data-import>导入 JSON</button>
           <input type="file" accept=".json,application/json" data-import-input hidden>
         </div>

         <div class="admin-row">
           <div class="info">
             <b>本地草稿</b>
             <span>${draft ? '本浏览器存在未发布的修改' : '本地没有未发布的修改'}</span>
           </div>
           <button class="btn btn-sm btn-danger" data-discard ${draft ? '' : 'disabled'}>放弃本地修改</button>
         </div>
       </div>`,
      {
        onMount(box, close) {
          box.querySelector('[data-edit-toggle]').addEventListener('change', (e) => {
            Store.setEditMode(e.target.checked);
            toast(e.target.checked ? '已进入编辑模式' : '已退出编辑模式', 'ok');
            renderFooter();
          });

          /* 在线发布 */
          const publishBtn = box.querySelector('[data-publish]');
          if (publishBtn) {
            publishBtn.addEventListener('click', async () => {
              const ok = await confirmDialog(
                '把当前的修改提交到 GitHub 仓库？提交后大约 1 分钟，全班刷新就能看到。',
                { title: '发布到 GitHub', okText: '发布' }
              );
              if (!ok) return;

              publishBtn.disabled = true;
              publishBtn.textContent = '发布中…';
              try {
                const result = await Publisher.publish(Store.toJSON(), {
                  message: `更新班级数据 ${new Date().toLocaleString('zh-CN')}`
                });
                Store.markPublished();
                Publisher.setLastPublish({ at: Date.now(), url: result.commitUrl });
                toast('已提交，GitHub Pages 大约 1 分钟后更新', 'ok');
                close();
                renderFooter();
                renderDraftBar();
              } catch (err) {
                toast('发布失败：' + err.message, 'err');
                publishBtn.disabled = false;
                publishBtn.textContent = '发布到 GitHub';
              }
            });

            box.querySelector('[data-pull]').addEventListener('click', async () => {
              const ok = await confirmDialog('从网站重新拉取最新数据？本地未发布的修改会丢失。', {
                okText: '拉取'
              });
              if (!ok) return;
              await Store.refresh();
              toast('已拉取最新数据', 'ok');
              close();
              setTimeout(() => location.reload(), 350);
            });

            box.querySelector('[data-forget]').addEventListener('click', async () => {
              const ok = await confirmDialog('清除本机保存的仓库配置和访问令牌？', {
                okText: '清除', danger: true
              });
              if (!ok) return;
              Publisher.forget();
              toast('已清除在线发布配置', 'ok');
              close();
            });
          }

          const configureBtn = box.querySelector('[data-configure]');
          if (configureBtn) {
            configureBtn.addEventListener('click', () => {
              close();
              openPublishConfig();
            });
          }

          /* 手动导出 / 备份 / 导入 */
          box.querySelector('[data-export]').addEventListener('click', () => {
            Store.exportPublished();
            toast('已导出 site-data.json，提交到仓库后全班可见', 'ok');
          });

          box.querySelector('[data-backup]').addEventListener('click', () => {
            Store.exportBackup();
            toast('已导出备份', 'ok');
          });

          const fileInput = box.querySelector('[data-import-input]');
          box.querySelector('[data-import]').addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            try {
              await Store.importFile(file);
              toast('导入成功', 'ok');
              close();
              setTimeout(() => location.reload(), 400);
            } catch (err) {
              toast('导入失败：' + err.message, 'err');
            } finally {
              fileInput.value = '';
            }
          });

          box.querySelector('[data-discard]').addEventListener('click', async () => {
            const ok = await confirmDialog('放弃本地未发布的修改，恢复成仓库里的数据？', {
              okText: '放弃修改', danger: true
            });
            if (!ok) return;
            Store.discardDraft();
            toast('已恢复仓库数据', 'ok');
            close();
            setTimeout(() => location.reload(), 350);
          });
        }
      }
    );
  }

  /* ---------- 顶部提示条（有草稿时提醒） ---------- */
  function renderDraftBar() {
    const bar = document.querySelector('[data-draft-bar]');
    if (!bar) return;
    const show = Store.hasDraft();
    bar.hidden = !show;
    if (!show) return;
    bar.innerHTML = `
      <span>你在本浏览器上有未发布的修改，其他同学看不到。导出 <code>site-data.json</code> 并提交后才会生效。</span>
      <span class="spacer"></span>
      <button class="btn btn-sm btn-primary" data-draft-export>立即导出</button>`;
    bar.querySelector('[data-draft-export]').addEventListener('click', () => {
      Store.exportPublished();
      toast('已导出 site-data.json', 'ok');
    });
  }

  /* ---------- 初始化 ---------- */
  function initShell(currentPage) {
    document.documentElement.dataset.theme = Store.getTheme();
    Store.applyEditMode();

    renderHeader(currentPage);
    renderFooter();
    renderDraftBar();

    // 主题按钮
    const icon = () => document.querySelector('[data-theme-icon]');
    const paint = () => { const el = icon(); if (el) el.textContent = Store.getTheme() === 'dark' ? '☀️' : '🌙'; };
    paint();
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-theme-toggle]')) { Store.toggleTheme(); paint(); }
      if (e.target.closest('[data-admin-open]')) { e.preventDefault(); openAdminPanel(); }
    });

    // 数据变化时同步页头/提示条
    Store.onChange(() => {
      const nameEl = document.querySelector('[data-bind="className"]');
      if (nameEl) nameEl.textContent = Store.data.meta.className;
      renderDraftBar();
    });
  }

  return {
    esc, toast, openModal, confirmDialog,
    pad, iso, fmtDate, fmtDateFull, relDay, weekdayOf,
    initShell, openAdminPanel, renderFooter, renderDraftBar
  };
})();
