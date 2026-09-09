# 计科2604 班级主页

一个纯静态的班级网站：**日程日历 + 班级公告**。没有后端、不用装任何东西，传到 GitHub Pages 就能用。
配好访问令牌后，班委可以直接在网页上改内容并一键提交，全班刷新即可看到。

## 文件结构

```
class-site/
├── index.html                 首页（接下来的日程 / 班级公告）
├── calendar.html              日程日历
├── data/
│   └── site-data.json         ★ 网站的全部内容都在这一个文件里
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── store.js           数据读写、草稿、导入导出
│       ├── publish.js         在线发布（GitHub Contents API）
│       ├── ui.js              页头页脚、弹窗、管理面板
│       ├── home.js
│       └── calendar.js
├── .nojekyll                  告诉 GitHub Pages 别用 Jekyll 处理
└── README.md
```

## 部署到 GitHub Pages（5 分钟）

1. 在 GitHub 上新建一个仓库，例如 `class-site`。
2. 把这个文件夹里的**全部文件**上传到仓库根目录（`index.html` 必须在根目录）。
   ```bash
   cd class-site
   git init
   git add .
   git commit -m "计科2604 班级主页"
   git branch -M main
   git remote add origin https://github.com/你的用户名/class-site.git
   git push -u origin main
   ```
3. 打开仓库的 **Settings → Pages**。
4. **Source** 选 `Deploy from a branch`，**Branch** 选 `main`、目录选 `/ (root)`，保存。
5. 等 1～2 分钟，访问 `https://你的用户名.github.io/class-site/`。

## 怎么改内容

点右上角 **管理** → 打开 **编辑模式**，然后：

- **日程**：点日历里的某一天新建，点已有日程修改；支持跨天日程（开始日期 + 结束日期）
- **公告**：首页「＋ 添加公告」，可置顶
- **班级名称 / 标语**：改 `data/site-data.json` 里的 `meta`，或用「导入 JSON」

改完之后有两种发布方式，**推荐第一种**。

### 方式一：在线发布（推荐，配一次就行）

> **班委第一次怎么进管理界面？** 普通同学看不到「管理」按钮，避免被一堆技术选项绕晕。
> 班委用带参数的链接打开一次就行：
> `https://你的用户名.github.io/class-site/?admin=1`
> 打开后地址栏会自动把 `?admin` 去掉，「管理」按钮会一直留在那台设备上。

打开 **管理 → 配置在线发布**，填四项：

| 字段 | 填什么 |
| --- | --- |
| GitHub 用户名 | 你的 GitHub 用户名 |
| 仓库名 | `class-site` |
| 分支 | `main` |
| 数据文件路径 | `data/site-data.json` |
| 访问令牌 | 见下面「怎么生成令牌」 |

点 **测试连接**，显示「连接成功」就说明配好了。之后每次改完，点 **发布到 GitHub**，约 1 分钟后全班刷新就能看到。

**怎么生成令牌**

1. 打开 [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. Token name 随便填，Expiration 选个期限（比如 90 天）
3. Repository access → **Only select repositories** → 只勾选班级仓库
4. Permissions → Repository permissions → **Contents** 设为 **Read and write**
5. 点 Generate token，复制生成的令牌（**只显示一次**），粘贴到配置里

**谁能编辑？**
令牌只保存在填令牌的那个人的浏览器里，不会上传到任何服务器。所以「谁能在网页上发布」就等于「你把令牌给谁」——通常就是班长和几个班委。别人即使打开编辑模式，改动也只存在自己浏览器里，不会影响全班看到的内容。

**令牌安全须知**
- 一定要用**细粒度令牌**并且**只授权这一个仓库**，不要用经典的、能访问所有仓库的 token
- 令牌等价于这个仓库的写入权限，别发到群里、别提交进仓库
- 设个过期时间（比如 90 天），到期重新生成一个
- 换电脑或怀疑泄露了，就去 GitHub 设置里撤销旧令牌
- 配置里不勾「记住令牌」的话，关掉浏览器就需要重新填

### 方式二：手动导出

没配令牌也能用：**管理 → 手动导出**，下载 `site-data.json`，用它覆盖仓库里的 `data/site-data.json` 并提交。

### 其它管理面板按钮

| 按钮 | 作用 |
| --- | --- |
| 拉取最新 | 丢掉本地草稿，重新从网站拉取数据（多人协作时同步用） |
| 配置 / 清除 | 修改或删除本机保存的令牌 |
| 导出备份 | 下载一份带日期的完整备份，纯保险 |
| 导入 JSON | 从备份文件恢复数据 |
| 放弃本地修改 | 丢掉浏览器里的草稿，恢复成仓库里的版本 |

## 常见问题

**我改了，同学看不到？**
改动先存在你浏览器的 localStorage 里。点「发布到 GitHub」，或者导出 JSON 提交到仓库，别人才看得到。

**发布成功了但网站还是旧数据？**
GitHub Pages 重新构建需要约 1 分钟。等一会儿再刷新；页面每次加载都带了时间戳参数，不会读到旧缓存。

**多人同时改会冲突吗？**
基本不会。发布时会先读取远端最新版本，如果恰好被改过会自动重取再提交一次。但两个人同时改同一份数据时，后发布的人会覆盖前一个人的内容，所以建议约定好谁来维护。

**能不能做到真正的多人在线协作（不覆盖）？**
需要引入数据库。把 `store.js` 里的读写换成 [Firebase](https://firebase.google.com/) / [Supabase](https://supabase.com/) 的接口即可，`publish.js` 就可以不用了。

**本地打开是空白 / 读不到数据？**
直接用 `file://` 打开时浏览器会拦截 `fetch`，数据会回退到默认值。请用本地服务器预览：
```bash
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 数据格式（想手改 JSON 的话）

```jsonc
{
  "meta":    { "className": "计科2604", "slogan": "…", "updatedAt": "…" },
  "events":  [{ "id", "title", "date": "2026-10-20", "endDate": "2026-10-21",
                "time", "endTime", "category", "location", "note" }],
  "notices": [{ "id", "title", "body", "date", "pinned" }]
}
```

`category` 可选：考试 / 活动 / 班会 / 假期 / 作业 / 其他（决定颜色）。
`date`、`endDate` 必须是 `YYYY-MM-DD`。手改完记得用 `python -m json.tool data/site-data.json` 检查一下语法。
