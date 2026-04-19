#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
BUILD_BIN_DIR="${2:-build/bin}"

if [[ -z "${VERSION}" ]]; then
  echo "Usage: $0 <version> [build_bin_dir]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${ROOT_DIR}/${BUILD_BIN_DIR}"
ZIP_OUT="${ROOT_DIR}/zentro-v${VERSION}-macos-universal.zip"
DMG_OUT="${ROOT_DIR}/zentro-v${VERSION}-macos-universal.dmg"

if [[ ! -d "${BIN_DIR}" ]]; then
  echo "Build bin directory not found: ${BIN_DIR}" >&2
  exit 1
fi

APP_BUNDLE=""
if [[ -d "${BIN_DIR}/Zentro.app" ]]; then
  APP_BUNDLE="${BIN_DIR}/Zentro.app"
elif [[ -d "${BIN_DIR}/zentro.app" ]]; then
  APP_BUNDLE="${BIN_DIR}/zentro.app"
fi

if [[ -z "${APP_BUNDLE}" ]]; then
  echo "Could not find macOS app bundle in ${BIN_DIR}" >&2
  ls -la "${BIN_DIR}" >&2
  exit 1
fi

TMP_STAGE="$(mktemp -d)"
trap 'rm -rf "${TMP_STAGE}"' EXIT

cp -R "${APP_BUNDLE}" "${TMP_STAGE}/"
ln -s /Applications "${TMP_STAGE}/Applications"

rm -f "${ZIP_OUT}" "${DMG_OUT}"

(
  cd "${BIN_DIR}"
  APP_NAME="$(basename "${APP_BUNDLE}")"
  zip -rq "${ZIP_OUT}" "${APP_NAME}"
)

hdiutil create \
  -volname "Zentro" \
  -srcfolder "${TMP_STAGE}" \
  -ov \
  -format UDZO \
  "${DMG_OUT}"

echo "Created: ${ZIP_OUT}"
echo "Created: ${DMG_OUT}"
