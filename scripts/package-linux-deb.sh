#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
BINARY_PATH="${2:-}"

if [[ -z "${VERSION}" || -z "${BINARY_PATH}" ]]; then
  echo "Usage: $0 <version> <binary_path>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_FILE="${ROOT_DIR}/${BINARY_PATH}"
ICON_FILE="${ROOT_DIR}/frontend/src/assets/images/appicon.png"
OUTPUT_FILE="${ROOT_DIR}/zentro-v${VERSION}-linux-amd64.deb"
PKG_ROOT="$(mktemp -d)"
trap 'rm -rf "${PKG_ROOT}"' EXIT

if [[ ! -f "${BIN_FILE}" ]]; then
  echo "Binary not found: ${BIN_FILE}" >&2
  exit 1
fi
if [[ ! -f "${ICON_FILE}" ]]; then
  echo "Icon not found: ${ICON_FILE}" >&2
  exit 1
fi
if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb is required but not found in PATH." >&2
  exit 1
fi

mkdir -p "${PKG_ROOT}/DEBIAN"
mkdir -p "${PKG_ROOT}/usr/local/bin"
mkdir -p "${PKG_ROOT}/usr/share/applications"
mkdir -p "${PKG_ROOT}/usr/share/pixmaps"

install -m 0755 "${BIN_FILE}" "${PKG_ROOT}/usr/local/bin/zentro"
install -m 0644 "${ICON_FILE}" "${PKG_ROOT}/usr/share/pixmaps/zentro.png"

cat > "${PKG_ROOT}/DEBIAN/control" <<EOF
Package: zentro
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Zentro <nguyenhoainam121n@gmail.com>
Description: Zentro cross-platform SQL IDE
EOF

cat > "${PKG_ROOT}/usr/share/applications/zentro.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Zentro
Comment=Cross-platform SQL IDE
Exec=/usr/local/bin/zentro
Icon=zentro
Terminal=false
Categories=Development;Database;
EOF

rm -f "${OUTPUT_FILE}"
dpkg-deb --build "${PKG_ROOT}" "${OUTPUT_FILE}"
echo "Created: ${OUTPUT_FILE}"
