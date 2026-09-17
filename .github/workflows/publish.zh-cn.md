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

也可以通过 **Actions -> Build Release Publish -> Run workflow** 手动选择同样的模式。可选的 `tag` 默认为 `v` 加上 `package.json` 中的版本号。所有已发布的 alpha、beta、rc 与正式版本都会标记为 GitHub latest，使稳定的 Release 下载 URL 始终可解析。

发版示例：

```powershell
npm version 0.2.0-rc.3+20260917 --no-git-tag-version
npm run check
git add -A
git commit -m "[build-publish] release v0.2.0-rc.3+20260917"
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

### 📝 创建首个脚本页

1. 先成功执行一次 `[build-publish]`，然后确认 GitHub Release 已包含当前用户脚本附件。
2. 登录计划作为首位脚本作者的 Greasy Fork 账号；该账号会成为脚本的首位作者。
3. 打开 `https://greasyfork.org/zh-CN/script_versions/new`；不要使用无效的 `/scripts/new` 路径。
4. 上传本地 `dist/npm-stat-modern-ui.user.js`，或把其完整构建内容粘贴到源码输入区域。
5. 保留自动识别的用户脚本元数据，尤其不要改动 `@name`、`@namespace`、`@version`、`@match`、`@run-at` 与 `@license`。
6. 将当前 `docs/introduction.md` 的完整内容填入初始脚本版本的 Greasy Fork「附加信息」区域。
7. 主页使用组织仓库，支持链接使用其 Issues 页面：

```text
Homepage: https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui
Support:  https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui/issues
License:  MIT
```

8. 当 Greasy Fork 要求选择语言或受众范围时，选择覆盖全部语言的选项，因为脚本面向全球的 npm-stat.com 用户。
9. 提交并发布初始版本，然后打开公开脚本页并点击一次安装按钮，确认 Greasy Fork 提供的是预期版本。
10. 保存公开脚本页 URL；它可以安全分享，且后续需要用于仓库 badge 与元数据。

### 🔄 配置自动源码同步

11. 打开已发布脚本的 **Admin** 页面，并将自动源码同步配置为此自动生成的 GitHub Raw URL：

```text
https://raw.githubusercontent.com/VincentZyuApps/npm-stat.com-but-modern-ui/greasyfork/npm-stat-modern-ui.user.js
```

12. 保存源码设置。发版工作流会在每次发布 Release 前更新这个仅含脚本的 `greasyfork` 分支；执行一次手动同步并确认 `@version`。

### 📣 配置 GitHub push Webhook

13. 保持登录并打开 `https://greasyfork.org/zh-CN/users/webhook-info`，创建 webhook 配置。
14. 将页面显示的 Payload URL 与 secret 保持私密，填入 GitHub 的 **Webhook Secret** 字段；不要放入 Actions Secret、Git、Issue 或聊天记录。
15. 打开 `https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui/settings/hooks`，选择 **Add webhook**，并填入 Greasy Fork 提供的 Payload URL 和 secret。
16. Content type 选 `application/json`，选择 **Let me select individual events**，仅启用 **Pushes**，并保持 webhook active；重置这个账号级 secret 后，须更新全部现有的 Greasy Fork GitHub webhook。
17. GitHub 接受 webhook 后，只将公开的 Greasy Fork 脚本页 URL 发给维护者；不要发送 webhook secret。

工作流会先更新生成的 `greasyfork` 分支，GitHub 对应的 `push` 事件随即通知 Greasy Fork 拉取其 Raw 用户脚本。初始脚本版本须手动上传；之后每次公开更新都须递增 `package.json` 版本，并创建新的 `[build-publish]` Release。

## ✅ 验证与恢复

执行 `[build-publish]` 后，按以下顺序验证构建、Release、Pages、Gitee 与 Greasy Fork：

1. GitHub Actions 中的 `build`、`publish-greasyfork-source`、`publish-release`、`sync-gitee-code`、`sync-gitee-release` 和 `publish-pages` 均成功。
2. GitHub Release 包含全部三个附件，并可用 `Get-FileHash` 验证校验和。
3. Pages URL 可下载新 `.user.js`，且包含预期的 `@version` 头部。
4. Gitee 具有相同的 commit/tag 与全部三个 Release 附件。
5. GitHub 的 Greasy Fork `push` webhook 投递为 `2xx`；随后 Greasy Fork 展示相同版本。

若 Gitee 失败，检查两个 Secret、Gitee SSH 公钥、账号写权限，以及 `publish.yml` 中配置的 Gitee owner/repository 常量。若 Greasy Fork 未更新，检查生成分支文件、Raw 源码 URL、版本是否递增、`push` webhook 事件与两侧一致的 webhook secret。
