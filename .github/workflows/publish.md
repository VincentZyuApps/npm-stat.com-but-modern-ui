# 🚀 GitHub Actions Release, Gitee Mirror, GitHub Pages, and Greasy Fork

> [简体中文](publish.zh-cn.md)

`publish.yml` is the release workflow for npm-stat Modern UI. It deliberately runs only when a matching commit message is pushed or when it is started manually, so ordinary documentation and development pushes do not build or publish releases.

## 🧭 Workflow modes

Use one of these exact phrases in a commit message:

```text
build action
build release
build publish
```

| Mode | Build and validation | GitHub Release | Gitee code and Release | GitHub Pages |
| --- | --- | --- | --- | --- |
| `build action` | Yes | No | No | No |
| `build release` | Yes | Yes | Yes | No |
| `build publish` | Yes | Yes | Yes | Yes |

The same modes are available from **Actions -> Build Release Publish -> Run workflow**. The optional `tag` defaults to `v` plus `package.json`'s version. A release is deliberately marked as a GitHub prerelease while the package version contains a prerelease identifier such as `beta.6`.

Example release sequence:

```powershell
npm version 0.2.0-beta.6 --no-git-tag-version
npm run check
git add -A
git commit -m "build publish: release v0.2.0-beta.6"
git push origin main
```

The workflow publishes these assets:

```text
npm-stat-modern-ui.user.js
npm-stat-modern-ui-dist.tar.gz
SHA256SUMS.txt
```

`build publish` additionally deploys a stable userscript URL to GitHub Pages:

```text
https://vincentzyuapps.github.io/npm-stat.com-but-modern-ui/npm-stat-modern-ui.user.js
```

Enable GitHub Pages once in the repository's **Settings -> Pages**, choose **GitHub Actions** as the source, and keep the repository public before distributing this URL.

## 🪞 Gitee mirror and Release configuration

The workflow uses `Yikun/hub-mirror-action` to mirror the organization repository to `vincent-zyu/npm-stat.com-but-modern-ui`, then `.github/scripts/sync-gitee-release.sh` recreates the GitHub Release and uploads the same three assets to Gitee.

In **Settings -> Secrets and variables -> Actions**, create these repository secrets:

| Secret | Purpose |
| --- | --- |
| `GITEE_PRIVATE_KEY` | A dedicated SSH private key for the Gitee mirror action. |
| `GITEE_TOKEN` | A dedicated Gitee personal access token with write access to the mirror repository and Release API. |

Release modes validate both secrets before creating a GitHub Release. They also check the SSH key against the Gitee repository and confirm the token has push permission. A missing or invalid credential therefore fails safely before any public Release or Pages deployment is created.

Generate an isolated key instead of sharing a personal daily-use key. It gives this automation an independent credential lifecycle, so it can be rotated or revoked without replacing the key used on your computers. Because this key is registered to a personal Gitee account, it inherits that account's repository access; it is not server-side restricted to this one mirror. For strict least privilege, use a dedicated Gitee automation account and grant it access only to this mirror repository. The public key is added to Gitee; only the private key is stored in the GitHub Actions secret.

```powershell
New-Item -ItemType Directory -Force "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key"
ssh-keygen -t ed25519 -C "npm-stat-modern-ui-gitee-mirror" -f "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror"
Get-Content "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror.pub"
```

When `ssh-keygen` asks for a passphrase and its confirmation, press Enter twice to leave the passphrase empty. PowerShell may omit the empty argument in `-N ""`, so the interactive form above is the reliable Windows command.

Add the displayed public key at `https://gitee.com/profile/sshkeys`. Create a separate Gitee token at `https://gitee.com/profile/personal_access_tokens`, grant it repository write access, and do not put either secret in Git, workflow files, screenshots, or chat.

### 🔐 Configure repository secrets with GitHub CLI

The following commands create **repository-level** Actions secrets for `VincentZyuApps/npm-stat.com-but-modern-ui`. Values are encrypted locally by `gh` before upload and are not displayed in command output.

If `gh secret set` reports insufficient OAuth scope, run this once and complete its browser/device authorization flow:

```powershell
gh auth refresh -h github.com -s repo
```

Set the private key without printing it:

```powershell
$giteePrivateKey = Get-Content -Raw "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror"
gh secret set GITEE_PRIVATE_KEY --repo VincentZyuApps/npm-stat.com-but-modern-ui --body "$giteePrivateKey"
Remove-Variable giteePrivateKey
```

Set the Gitee token through `gh`'s interactive secret prompt. Paste the token when prompted and press Enter; it is not echoed:

```powershell
gh secret set GITEE_TOKEN --repo VincentZyuApps/npm-stat.com-but-modern-ui
```

List configured Actions secret names after upload; GitHub never returns their values:

```powershell
gh secret list --app actions --repo VincentZyuApps/npm-stat.com-but-modern-ui
```

The SSH key authorizes the Gitee Git mirror action. The token authorizes Gitee API calls that create tags, recreate Releases, and upload Release assets; both are required for a complete multi-channel publication.

## 🧩 Greasy Fork first publication and updates

Greasy Fork is the user-facing discovery channel. Its first script page must be created from your logged-in browser account.

1. Publish a successful `build publish` release so the GitHub Release latest asset exists.
2. Open `https://greasyfork.org/zh-CN/scripts/new`, create the script, and upload the built `npm-stat-modern-ui.user.js` once.
3. Use the organization repository for the homepage and support links, choose MIT as the license, then publish the script page.
4. Open the script's **Admin** page and configure automatic source synchronization with this GitHub Release latest URL:

```text
https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui/releases/latest/download/npm-stat-modern-ui.user.js
```

5. Open `https://greasyfork.org/zh-CN/users/webhook-info`, generate a webhook secret, and use its displayed Payload URL and secret in GitHub **Settings -> Webhooks -> Add webhook**. Select `application/json`, enable only **Releases**, and keep the webhook active.
6. Send the final Greasy Fork script page URL back to the maintainer. Add it to the README and userscript metadata only after it is live.

GitHub's `release: published` event tells Greasy Fork to retrieve the latest Release asset. Editing an existing release does not create a new Greasy Fork script version: increment `package.json`'s version for every public update.

## ✅ Verification and recovery

After `build publish`, verify the build, Release, Pages, Gitee and Greasy Fork in that order:

1. The GitHub Actions jobs `build`, `publish-release`, `sync-gitee-code`, `sync-gitee-release`, and `publish-pages` have succeeded.
2. The GitHub Release contains all three assets and the checksums verify with `Get-FileHash`.
3. The Pages URL downloads the new `.user.js`, including the expected `@version` header.
4. Gitee has the matching commit/tag and all three Release assets.
5. GitHub's Greasy Fork webhook delivery is `2xx`; Greasy Fork then displays the same version.

For a Gitee failure, verify both secrets, the Gitee SSH public key, the account's write permission, and the configured Gitee owner/repository constants in `publish.yml`. For a Greasy Fork failure, first check that a new Release was created, the latest asset URL is public, the version changed, and the webhook secret matches both services.
