/* =========================================================
   publish.js —— 在线发布（GitHub Contents API）
   ---------------------------------------------------------
   GitHub Pages 没有后端，但 GitHub 本身提供了写文件的接口。
   编辑者在浏览器里填一个「细粒度访问令牌」（只授权这一个仓库的
   Contents 读写权限），就能把修改直接提交回仓库，全班刷新即可看到。

   令牌只保存在编辑者自己的浏览器里，不会上传到任何第三方服务器；
   只有持有令牌的人（也就是仓库协作者）能发布，这就是“部分人可编辑”的边界。
   ========================================================= */

const Publisher = (() => {
  const CFG_KEY = 'class-site.publish.v1';
  const TOKEN_SESSION_KEY = 'class-site.publish.token';
  const LAST_KEY = 'class-site.publish.last';
  const API = 'https://api.github.com';

  /* ---------- 配置读写 ---------- */
  function getConfig() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    } catch {
      saved = {};
    }
    return {
      owner: String(saved.owner || ''),
      repo: String(saved.repo || ''),
      branch: String(saved.branch || 'main'),
      path: String(saved.path || 'data/site-data.json'),
      remember: saved.remember !== false,
      token: String(saved.token || sessionStorage.getItem(TOKEN_SESSION_KEY) || '')
    };
  }

  function saveConfig(input) {
    const cfg = {
      owner: String(input.owner || '').trim(),
      repo: String(input.repo || '').trim(),
      branch: String(input.branch || 'main').trim() || 'main',
      path: String(input.path || 'data/site-data.json').trim() || 'data/site-data.json',
      remember: !!input.remember
    };
    const token = String(input.token || '').trim();

    // 勾了“记住”才写 localStorage，否则只留在本次会话里
    if (cfg.remember) {
      cfg.token = token;
      sessionStorage.removeItem(TOKEN_SESSION_KEY);
    } else {
      sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    }
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    return getConfig();
  }

  function forget() {
    localStorage.removeItem(CFG_KEY);
    localStorage.removeItem(LAST_KEY);
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.owner && c.repo && c.token);
  }

  function getLastPublish() {
    try {
      return JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function setLastPublish(value) {
    localStorage.setItem(LAST_KEY, JSON.stringify(value));
  }

  /* ---------- 底层请求 ---------- */
  function headers(token) {
    return {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }

  /** UTF-8 安全的 base64（btoa 不能直接处理中文） */
  function b64encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  async function describeError(res) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body && body.message ? body.message : '';
    } catch { /* 忽略非 JSON 响应 */ }

    const known = {
      401: '令牌无效或已过期，请重新生成',
      403: '令牌权限不足，或触发了 GitHub 的速率限制',
      404: '找不到仓库或文件：检查用户名、仓库名、分支、路径，以及令牌是否授权了这个仓库',
      409: '文件冲突，稍后会自动重试',
      422: '提交被拒绝，可能是分支名或路径不对'
    };
    return (known[res.status] || `GitHub 返回 ${res.status}`) + (detail ? `：${detail}` : '');
  }

  /** 取远端文件信息（含 sha）；文件不存在返回 null */
  async function getFile(cfg) {
    const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(url, { headers: headers(cfg.token), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await describeError(res));
    return res.json();
  }

  /** 验证令牌、仓库和写权限 */
  async function testConnection(cfg) {
    if (!cfg.owner || !cfg.repo) throw new Error('请先填写用户名和仓库名');
    if (!cfg.token) throw new Error('请先填写访问令牌');

    const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, {
      headers: headers(cfg.token),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(await describeError(res));

    const repo = await res.json();
    if (!repo.permissions || !repo.permissions.push) {
      throw new Error('令牌对这个仓库没有写入权限，请把 Contents 权限设为 Read and write');
    }
    return { fullName: repo.full_name, defaultBranch: repo.default_branch };
  }

  /** 把文本提交到仓库；远端被改动过时自动重取 sha 重试一次 */
  async function publish(text, { message } = {}) {
    const cfg = getConfig();
    if (!isConfigured()) throw new Error('还没有配置在线发布');

    const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
    const content = b64encode(text);

    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await getFile(cfg);
      const body = {
        message: message || '更新班级数据',
        content,
        branch: cfg.branch
      };
      if (current && current.sha) body.sha = current.sha;

      const res = await fetch(url, {
        method: 'PUT',
        headers: headers(cfg.token),
        body: JSON.stringify(body)
      });

      if (res.status === 409 || res.status === 422) continue;   // sha 过期，重取再试

      if (!res.ok) throw new Error(await describeError(res));
      const json = await res.json();
      return {
        commitUrl: json.commit ? json.commit.html_url : '',
        sha: json.content ? json.content.sha : ''
      };
    }

    throw new Error('远端文件刚被别人改过，自动重试仍冲突，请稍后再试');
  }

  return {
    getConfig, saveConfig, forget, isConfigured,
    getLastPublish, setLastPublish,
    testConnection, publish, b64encode
  };
})();
