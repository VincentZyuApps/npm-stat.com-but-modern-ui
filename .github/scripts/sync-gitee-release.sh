#!/usr/bin/env bash

set -Eeuo pipefail

required_env=(GH_REPO GH_TOKEN GITEE_TOKEN GITEE_OWNER GITEE_REPO RELEASE_TAG)

die() {
  echo "::error::$*" >&2
  exit 1
}

for name in "${required_env[@]}"; do
  [ -n "${!name:-}" ] || die "${name} is not configured."
done

for command in gh git curl jq find stat; do
  command -v "${command}" >/dev/null 2>&1 || die "${command} is unavailable."
done

api_base="https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}"
work_dir="$(mktemp -d)"
assets_dir="${work_dir}/assets"
release_body="${work_dir}/release.md"
tag="${RELEASE_TAG}"

cleanup() {
  rm -rf "${work_dir}"
}
trap cleanup EXIT

github_tag_sha() {
  git ls-remote "https://github.com/${GH_REPO}.git" "refs/tags/${tag}^{}" "refs/tags/${tag}" \
    | awk '/\^\{\}$/ { print $1; found=1; exit } !found { value=$1 } END { if (!found && value) print value }'
}

gitee_tag_sha() {
  git ls-remote "https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}.git" "refs/tags/${tag}^{}" "refs/tags/${tag}" \
    | awk '/\^\{\}$/ { print $1; found=1; exit } !found { value=$1 } END { if (!found && value) print value }'
}

mkdir -p "${assets_dir}"
release_json="$(gh release view "${tag}" --repo "${GH_REPO}" --json name,body)"
release_name="$(jq -r --arg tag "${tag}" '.name // $tag' <<<"${release_json}")"
jq -r '.body // ""' <<<"${release_json}" > "${release_body}"
gh release download "${tag}" --repo "${GH_REPO}" --pattern '*' --dir "${assets_dir}"

test -f "${assets_dir}/npm-stat-modern-ui.user.js"
test -f "${assets_dir}/npm-stat-modern-ui-dist.tar.gz"
test -f "${assets_dir}/SHA256SUMS.txt"

source_sha="$(github_tag_sha)"
[ -n "${source_sha}" ] || die "GitHub tag ${tag} does not exist."
mirror_sha="$(gitee_tag_sha)"
if [ -z "${mirror_sha}" ]; then
  curl --fail-with-body --silent --show-error \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg token "${GITEE_TOKEN}" --arg name "${tag}" --arg sha "${source_sha}" '{access_token: $token, tag_name: $name, refs: $sha, tag_message: ("Release " + $name)}')" \
    "${api_base}/tags" >/dev/null
  for attempt in 1 2 3 4 5; do
    mirror_sha="$(gitee_tag_sha)"
    [ "${mirror_sha}" = "${source_sha}" ] && break
    sleep 2
  done
fi
[ "${mirror_sha}" = "${source_sha}" ] || die "Gitee tag ${tag} does not match GitHub."

encoded_tag="$(jq -rn --arg value "${tag}" '$value | @uri')"
existing="$(curl --silent --show-error --write-out '\n%{http_code}' "${api_base}/releases/tags/${encoded_tag}?access_token=${GITEE_TOKEN}")"
status="${existing##*$'\n'}"
body="${existing%$'\n'*}"
if [ "${status}" = '200' ]; then
  response_type="$(jq -r 'type' <<<"${body}")"
  if [ "${response_type}" = 'object' ] && jq -e 'has("id")' <<<"${body}" >/dev/null; then
    release_id="$(jq -r '.id' <<<"${body}")"
    curl --fail-with-body --silent --show-error -X DELETE \
      "${api_base}/releases/${release_id}?access_token=${GITEE_TOKEN}" >/dev/null
    deleted=false
    for attempt in 1 2 3 4 5; do
      remaining="$(curl --silent --show-error --write-out '\n%{http_code}' "${api_base}/releases/tags/${encoded_tag}?access_token=${GITEE_TOKEN}")"
      remaining_status="${remaining##*$'\n'}"
      if [ "${remaining_status}" = '404' ] || [ "${remaining%$'\n'*}" = 'null' ]; then
        deleted=true
        break
      fi
      sleep 2
    done
    [ "${deleted}" = true ] || die "Gitee release ${tag} was not deleted in time."
  elif [ "${response_type}" != 'null' ]; then
    die "Gitee release lookup returned an unexpected ${response_type} response."
  fi
elif [ "${status}" != '404' ]; then
  die "Gitee release lookup failed with HTTP ${status}."
fi

new_release="$(curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg token "${GITEE_TOKEN}" --arg name "${release_name}" --arg tag "${tag}" --arg target "${source_sha}" --rawfile description "${release_body}" '{access_token: $token, tag_name: $tag, name: $name, body: $description, target_commitish: $target, prerelease: false}')" \
  "${api_base}/releases")"
new_release_id="$(jq -r '.id // empty' <<<"${new_release}")"
[ -n "${new_release_id}" ] || die "Gitee did not return a release id."

for asset in "${assets_dir}"/*; do
  [ -f "${asset}" ] || continue
  curl --fail-with-body --silent --show-error \
    -F "access_token=${GITEE_TOKEN}" \
    -F "file=@${asset}" \
    "${api_base}/releases/${new_release_id}/attach_files" >/dev/null
  echo "Uploaded $(basename "${asset}") to Gitee."
done
