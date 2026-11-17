#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS is required to compile the .app bundle (SwiftUI/AppKit)." >&2
  exit 1
fi

cd "$ROOT"
swift test
swift build -c release --product YUGATNeoTIME

APP="$ROOT/dist/YUGATNeoTIME.app"
EXECUTABLE="$APP/Contents/MacOS/YUGATNeoTIME"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ROOT/.build/release/YUGATNeoTIME" "$EXECUTABLE"
chmod +x "$EXECUTABLE"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>YUGATNeoTIME</string>
    <key>CFBundleDisplayName</key><string>YUGATNeoTIME</string>
    <key>CFBundleIdentifier</key><string>io.github.yugatn.yugatneotime</string>
    <key>CFBundleExecutable</key><string>YUGATNeoTIME</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# Ad-hoc signing supports local testing, but this is not Apple notarization.
codesign --force --sign - "$APP"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP" "$ROOT/dist/YUGATNeoTIME-macOS.zip"
echo "Created: $APP"
echo "Created: $ROOT/dist/YUGATNeoTIME-macOS.zip"
echo "Ad-hoc signing only: notarized distribution is a separate milestone."
