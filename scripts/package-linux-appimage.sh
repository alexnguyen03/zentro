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
OUTPUT_FILE="${ROOT_DIR}/zentro-v${VERSION}-linux-amd64.AppImage"

if [[ ! -f "${BIN_FILE}" ]]; then
  echo "Binary not found: ${BIN_FILE}" >&2
  exit 1
fi
if [[ ! -f "${ICON_FILE}" ]]; then
  echo "Icon not found: ${ICON_FILE}" >&2
  exit 1
fi
if ! command -v appimagetool >/dev/null 2>&1; then
  echo "appimagetool is required but not found in PATH." >&2
  exit 1
fi

APPDIR="$(mktemp -d)"
trap 'rm -rf "${APPDIR}"' EXIT

mkdir -p "${APPDIR}/usr/bin" "${APPDIR}/usr/share/icons/hicolor/256x256/apps"
install -m 0755 "${BIN_FILE}" "${APPDIR}/usr/bin/zentro"
install -m 0644 "${ICON_FILE}" "${APPDIR}/zentro.png"
install -m 0644 "${ICON_FILE}" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/zentro.png"

cat > "${APPDIR}/AppRun" <<'EOF'
#!/usr/bin/env bash
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${SELF_DIR}/usr/bin/zentro" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

cat > "${APPDIR}/zentro.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Zentro
Comment=Cross-platform SQL IDE
Exec=zentro
Icon=zentro
Terminal=false
Categories=Development;Database;
EOF

rm -f "${OUTPUT_FILE}"
APPIMAGE_EXTRACT_AND_RUN=1 appimagetool "${APPDIR}" "${OUTPUT_FILE}"
echo "Created: ${OUTPUT_FILE}"
