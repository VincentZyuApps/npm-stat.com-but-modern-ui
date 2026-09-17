# 🚀 GitHub Actions 发版、Gitee 镜像、GitHub Pages 与 Greasy Fork

> [English](publish.md)

`publish.yml` 是 npm-stat Modern UI 的发版工作流。它只会在推送包含匹配关键字的提交，或手动启动时运行；普通文档和开发提交不会构建或发布 Release。

## 🧭 工作流模式

在提交信息中使用下列精确短语之一：

```text
[build-action]
[build-release]
[build-publish]
```

| 模式 | 构建与验证 | GitHub Release | Gitee 代码与 Release | GitHub Pages |
| --- | --- | --- | --- | --- |
| `[build-action]` | 是 | 否 | 否 | 否 |
| `[build-release]` | 是 | 是 | 是 | 否 |
| `[build-publish]` | 是 | 是 | 是 | 是 |

也可以通过 **Actions -> Build Release Publish -> Run workflow** 手动选择同样的模式。可选的 `tag` 默认为 `v` 加上 `package.json` 中的版本号。版本包含 `beta.6` 之类预发布标识时，Release 会被标记为 GitHub prerelease。

发版示例：

```powershell
npm version 0.2.0-beta.7+20260917 --no-git-tag-version
npm run check
git add -A
git commit -m "[build-publish] release v0.2.0-beta.7+20260917"
git push origin main
```

工作流发布以下附件：

```text
npm-stat-modern-ui.user.js
npm-stat-modern-ui-dist.tar.gz
SHA256SUMS.txt
```

`[build-publish]` 还会将稳定的用户脚本地址部署到 GitHub Pages：

```text
https://vincentzyuapps.github.io/npm-stat.com-but-modern-ui/npm-stat-modern-ui.user.js
```

首次需要在仓库 **Settings -> Pages** 中启用 GitHub Pages，来源选择 **GitHub Actions**，并在分发此地址前保持仓库公开。

## 🪞 Gitee 镜像与 Release 配置

工作流使用 `Yikun/hub-mirror-action` 将组织仓库镜像到 `vincent-zyu/npm-stat.com-but-modern-ui`，然后由 `.github/scripts/sync-gitee-release.sh` 重新创建 Gitee Release，并上传同样的三个附件。

在 **Settings -> Secrets and variables -> Actions** 中创建以下 Repository secret：

| Secret | 用途 |
| --- | --- |
| `GITEE_PRIVATE_KEY` | 供 Gitee 镜像 action 使用的专用 SSH 私钥。 |
| `GITEE_TOKEN` | 对镜像仓库和 Release API 具有写权限的专用 Gitee 私人令牌。 |

Release 模式会在创建 GitHub Release 之前验证两个 Secret，同时检查 SSH key 能否连接 Gitee 仓库，以及 Token 是否具有 push 权限。缺少或无效的凭据会在创建公开 Release 或部署 Pages 之前安全失败。

请生成独立 key，而不是复用日常使用的个人 SSH key。它让这套自动化具有独立的凭据生命周期，可以单独轮换或吊销，而无需替换你电脑上使用的 key。因为该 key 注册到个人 Gitee 账号，它会继承这个账号的仓库访问权限，并不会在服务端天然限制为此镜像仓库。若需要严格的最小权限，请单独创建 Gitee 自动化账号，并且只授予它此镜像仓库的访问权。公钥添加到 Gitee；只有私钥存入 GitHub Actions Secret。

```powershell
New-Item -ItemType Directory -Force "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key"
ssh-keygen -t ed25519 -C "npm-stat-modern-ui-gitee-mirror" -f "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror"
Get-Content "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror.pub"
```

当 `ssh-keygen` 提示输入 passphrase 及确认时，连续按两次 Enter，保持空 passphrase。PowerShell 有时会在 `-N ""` 中省略空参数，因此上面的交互式写法是可靠的 Windows 命令。

在 `https://gitee.com/profile/sshkeys` 添加显示出的公钥。随后到 `https://gitee.com/profile/personal_access_tokens` 创建独立的 Gitee Token，授予仓库写权限。不要将私钥或 Token 写进 Git、工作流文件、截图或聊天记录。

### 🔐 使用 GitHub CLI 配置 Repository Secret

以下命令会为 `VincentZyuApps/npm-stat.com-but-modern-ui` 创建 **repository-level** Actions Secret。`gh` 会在本地加密 Secret 值再上传，命令输出不会显示值。

若 `gh secret set` 提示 OAuth scope 不足，先执行以下命令并完成浏览器或设备授权流程：

```powershell
gh auth refresh -h github.com -s repo
```

不输出私钥地设置 SSH key：

```powershell
$giteePrivateKey = Get-Content -Raw "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror"
gh secret set GITEE_PRIVATE_KEY --repo VincentZyuApps/npm-stat.com-but-modern-ui --body "$giteePrivateKey"
Remove-Variable giteePrivateKey
```

通过 `gh` 的交互式 Secret 提示设置 Gitee Token。出现提示后粘贴 Token 并按 Enter；它不会回显：

```powershell
gh secret set GITEE_TOKEN --repo VincentZyuApps/npm-stat.com-but-modern-ui
```

上传后可列出已配置的 Actions Secret 名称；GitHub 不会返回其值：

```powershell
gh secret list --app actions --repo VincentZyuApps/npm-stat.com-but-modern-ui
```

SSH key 用于授权 Gitee Git 镜像 action。Token 用于授权 Gitee API 创建 tag、重新创建 Release 和上传 Release 附件；完整的多渠道发版需要两者。

## 🧩 Greasy Fork 首次发布与更新

Greasy Fork 是面向用户的发现渠道。首次创建脚本页必须由你在已登录的浏览器账号中完成。

1. 先成功执行一次 `[build-publish]`，使 GitHub Release 的 latest 附件存在。
2. 打开 `https://greasyfork.org/zh-CN/scripts/new`，创建脚本，并首次上传构建出的 `npm-stat-modern-ui.user.js`。
3. 主页和支持链接使用组织仓库，许可证选择 MIT，然后发布脚本页。
4. 打开脚本的 **Admin** 页面，并将自动源代码同步配置为此 GitHub Release latest URL：

```text
https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui/releases/latest/download/npm-stat-modern-ui.user.js
```

5. 打开 `https://greasyfork.org/zh-CN/users/webhook-info`，生成 webhook secret，并将页面显示的 Payload URL 和 secret 填到 GitHub **Settings -> Webhooks -> Add webhook**。Content type 选择 `application/json`，仅启用 **Releases**，并保持 webhook active。
6. 将最终 Greasy Fork 脚本页 URL 发给维护者。只有页面已上线后，才把它写进 README 和 userscript metadata。

GitHub 的 `release: published` 事件会通知 Greasy Fork 获取 latest Release 附件。编辑已存在的 Release 不会创建新的 Greasy Fork 脚本版本：每次公开更新都必须递增 `package.json` 版本。

## ✅ 验证与恢复

执行 `[build-publish]` 后，按以下顺序验证构建、Release、Pages、Gitee 与 Greasy Fork：

1. GitHub Actions 中的 `build`、`publish-release`、`sync-gitee-code`、`sync-gitee-release` 和 `publish-pages` 均成功。
2. GitHub Release 包含全部三个附件，并可用 `Get-FileHash` 验证校验和。
3. Pages URL 可下载新 `.user.js`，且包含预期的 `@version` 头部。
4. Gitee 具有相同的 commit/tag 与全部三个 Release 附件。
5. GitHub 的 Greasy Fork webhook 投递为 `2xx`；随后 Greasy Fork 展示相同版本。

若 Gitee 失败，检查两个 Secret、Gitee SSH 公钥、账号写权限，以及 `publish.yml` 中配置的 Gitee owner/repository 常量。若 Greasy Fork 未更新，先检查是否创建了新 Release、latest 附件 URL 是否公开、版本是否递增，以及 webhook secret 是否在两侧一致。
