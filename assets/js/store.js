/* =========================================================
   store.js —— 数据层
   ---------------------------------------------------------
   GitHub Pages 是纯静态托管，没有后端，所以数据分两份：
     1. data/site-data.json   ← 仓库里的“正式数据”，所有访客都看到它
     2. localStorage 草稿      ← 你在页面上编辑的内容，只存在你自己浏览器
   编辑完点“导出 site-data.json”，把它提交到仓库，全班就都能看到新数据。
   ========================================================= */

const Store = (() => {
  const PUBLISHED_URL = 'data/site-data.json';
  const DRAFT_KEY = 'class-site.draft.v1';
  const EDIT_KEY = 'class-site.edit';
  const THEME_KEY = 'class-site.theme';

  /* ---------- 默认结构（首次打开或数据损坏时的兜底） ---------- */
  function emptyData() {
    return {
      meta: {
        version: 1,
        className: '我的班级',
        slogan: '一起把日子过明白',
        updatedAt: new Date().toISOString()
      },
      events: [],
      notices: []
    };
  }

  /* ---------- 内部状态 ---------- */
  let data = emptyData();
  let published = null;          // 仓库里读到的原始数据（用于“恢复”）
  let loadState = 'idle';        // idle | ok | fallback
  let loadError = '';
  const listeners = new Set();

  /* ---------- 工具 ---------- */
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const uid = (p = 'id') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /** 把任意输入规整成合法结构，缺字段就补默认值，防止页面崩掉 */
  function normalize(raw) {
    const out = emptyData();
    if (!isPlainObject(raw)) return out;

    if (isPlainObject(raw.meta)) {
      out.meta = {
        version: Number(raw.meta.version) || 1,
        className: String(raw.meta.className || out.meta.className),
        slogan: String(raw.meta.slogan ?? out.meta.slogan),
        updatedAt: String(raw.meta.updatedAt || new Date().toISOString())
      };
    }

    if (Array.isArray(raw.events)) {
      out.events = raw.events
        .filter(isPlainObject)
        .map((e) => ({
          id: String(e.id || uid('ev')),
          title: String(e.title || '未命名日程'),
          date: String(e.date || ''),
          endDate: String(e.endDate || ''),
          time: String(e.time || ''),
          endTime: String(e.endTime || ''),
          category: String(e.category || '其他'),
          location: String(e.location || ''),
          note: String(e.note || '')
        }))
        .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }

    if (Array.isArray(raw.notices)) {
      out.notices = raw.notices
        .filter(isPlainObject)
        .map((n) => ({
          id: String(n.id || uid('nt')),
          title: String(n.title || ''),
          body: String(n.body || ''),
          date: String(n.date || ''),
          pinned: !!n.pinned
        }))
        .filter((n) => n.title || n.body);
    }

    return out;
  }

  /* ---------- 读取 ---------- */
  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeDraft(value) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('[store] 草稿保存失败', err);
      return false;
    }
  }

  async function load() {
    let publishedData = null;
    try {
      // 带时间戳绕过 GitHub Pages 的 CDN 缓存，保证拿到刚发布的数据
      const res = await fetch(PUBLISHED_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      publishedData = normalize(await res.json());
      loadState = 'ok';
    } catch (err) {
      loadState = 'fallback';
      loadError = err.message || String(err);
      console.warn('[store] 读取 ' + PUBLISHED_URL + ' 失败，使用本地/默认数据：', err);
    }

    published = publishedData;
    const draft = readDraft();
    data = draft ? normalize(draft) : publishedData ? clone(publishedData) : emptyData();

    // 草稿和发布数据内容一致时，丢掉草稿，避免一直提示“有未发布修改”
    if (draft && publishedData && contentSignature(normalize(draft)) === contentSignature(publishedData)) {
      localStorage.removeItem(DRAFT_KEY);
      data = clone(publishedData);
    }

    notify();
    return data;
  }

  /* ---------- 写入 ---------- */
  function save(mutator) {
    if (typeof mutator === 'function') mutator(data);
    data.meta.updatedAt = new Date().toISOString();
    writeDraft(data);
    notify();
    return data;
  }

  function replace(next, { asDraft = true } = {}) {
    data = normalize(next);
    data.meta.updatedAt = new Date().toISOString();
    if (asDraft) writeDraft(data);
    notify();
    return data;
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    data = published ? clone(published) : emptyData();
    notify();
    return data;
  }

  function hasDraft() {
    return localStorage.getItem(DRAFT_KEY) !== null;
  }

  /* ---------- 与“已发布版本”的对比 ---------- */
  /** 内容指纹：忽略 updatedAt，只看真正的内容 */
  function contentSignature(value) {
    const copy = clone(value);
    if (copy.meta) delete copy.meta.updatedAt;
    return JSON.stringify(copy);
  }

  function hasChanges() {
    if (!published) return true;
    return contentSignature(data) !== contentSignature(published);
  }

  /** 发布成功后调用：把当前数据记为已发布基线，并清掉草稿标记 */
  function markPublished() {
    published = clone(data);
    localStorage.removeItem(DRAFT_KEY);
    notify();
  }

  /** 丢弃本地草稿并重新从网站拉取最新数据 */
  async function refresh() {
    localStorage.removeItem(DRAFT_KEY);
    return load();
  }

  /* ---------- 导入 / 导出 ---------- */
  function toJSON() {
    return JSON.stringify(data, null, 2) + '\n';
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportPublished() {
    download('site-data.json', toJSON());
  }

  function exportBackup() {
    const stamp = new Date().toISOString().slice(0, 10);
    download(`班级数据备份-${stamp}.json`, toJSON());
  }

  async function importFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);   // 抛错交给调用方
    return replace(parsed);
  }

  /* ---------- 编辑模式 / 主题 ---------- */
  function isEditMode() {
    return localStorage.getItem(EDIT_KEY) === 'on';
  }

  function setEditMode(on) {
    localStorage.setItem(EDIT_KEY, on ? 'on' : 'off');
    applyEditMode();
    notify();
  }

  function applyEditMode() {
    document.body.dataset.edit = isEditMode() ? 'on' : 'off';
  }

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    notify();
  }

  function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  /* ---------- 订阅 ---------- */
  function notify() {
    for (const fn of listeners) {
      try { fn(data); } catch (err) { console.error(err); }
    }
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* ---------- 查询辅助 ---------- */
  const DAY_KEYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** 展开多天日程，返回 { 'YYYY-MM-DD': [event, ...] } */
  function eventsByDate() {
    const map = {};
    for (const ev of data.events) {
      const start = ev.date;
      const end = ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date;
      let cur = new Date(start + 'T00:00:00');
      const last = new Date(end + 'T00:00:00');
      let guard = 0;
      while (cur <= last && guard++ < 400) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        (map[key] || (map[key] = [])).push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    }
    return map;
  }

  function upcomingEvents(limit = 5) {
    const today = todayISO();
    return data.events
      .filter((ev) => (ev.endDate || ev.date) >= today)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, limit);
  }

  return {
    // 状态
    get data() { return data; },
    get published() { return published; },
    get loadState() { return loadState; },
    get loadError() { return loadError; },
    emptyData, normalize, uid,
    // 读写
    load, save, replace, discardDraft, hasDraft, onChange, refresh,
    contentSignature, hasChanges, markPublished,
    // 导入导出
    toJSON, download, exportPublished, exportBackup, importFile,
    // 界面状态
    isEditMode, setEditMode, applyEditMode,
    getTheme, setTheme, toggleTheme,
    // 查询
    DAY_KEYS, todayISO, eventsByDate, upcomingEvents
  };
})();
