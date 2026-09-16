# GitHub Actions Release, Gitee Mirror, GitHub Pages, and Greasy Fork

`publish.yml` is the release workflow for npm-stat Modern UI. It deliberately runs only when a matching commit message is pushed or when it is started manually, so ordinary documentation and development pushes do not build or publish releases.

## Workflow modes

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

## Gitee mirror and Release configuration

The workflow uses `Yikun/hub-mirror-action` to mirror the organization repository to `vincent-zyu/npm-stat.com-but-modern-ui`, then `.github/scripts/sync-gitee-release.sh` recreates the GitHub Release and uploads the same three assets to Gitee.

In **Settings -> Secrets and variables -> Actions**, create these repository secrets:

| Secret | Purpose |
| --- | --- |
| `GITEE_PRIVATE_KEY` | A dedicated SSH private key for the Gitee mirror action. |
| `GITEE_TOKEN` | A dedicated Gitee personal access token with write access to the mirror repository and Release API. |

Generate an isolated key instead of sharing a personal daily-use key:

```powershell
New-Item -ItemType Directory -Force "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key"
ssh-keygen -t ed25519 -C "npm-stat-modern-ui-gitee-mirror" -f "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror" -N ""
Get-Content "E:\tmp\codex\npm-stat.com-but-modern-ui\release-key\gitee_mirror.pub"
```

Add that public key at `https://gitee.com/profile/sshkeys`. Copy the complete private key into GitHub secret `GITEE_PRIVATE_KEY`, including the `BEGIN` and `END` lines. Create a separate Gitee token at `https://gitee.com/profile/personal_access_tokens`, grant it repository write access, and store it as `GITEE_TOKEN`. Do not put either secret in Git, workflow files, screenshots, or chat.

## Greasy Fork first publication and updates

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

## Verification and recovery

After `build publish`, verify the build, Release, Pages, Gitee and Greasy Fork in that order:

1. The GitHub Actions jobs `build`, `publish-release`, `sync-gitee-code`, `sync-gitee-release`, and `publish-pages` have succeeded.
2. The GitHub Release contains all three assets and the checksums verify with `Get-FileHash`.
3. The Pages URL downloads the new `.user.js`, including the expected `@version` header.
4. Gitee has the matching commit/tag and all three Release assets.
5. GitHub's Greasy Fork webhook delivery is `2xx`; Greasy Fork then displays the same version.

For a Gitee failure, verify both secrets, the Gitee SSH public key, the account's write permission, and the configured Gitee owner/repository constants in `publish.yml`. For a Greasy Fork failure, first check that a new Release was created, the latest asset URL is public, the version changed, and the webhook secret matches both services.
