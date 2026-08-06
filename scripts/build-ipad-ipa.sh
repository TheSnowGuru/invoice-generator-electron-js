#!/usr/bin/env bash
# Build MyFinance for iPad (IPA) into ./release/
# Requires: full Xcode from the App Store, Apple ID signing in Xcode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! xcodebuild -version &>/dev/null; then
  echo "ERROR: Full Xcode is required (not only Command Line Tools)."
  echo "Install Xcode from the App Store, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

echo "→ Web build for Capacitor…"
npm run build:capacitor

echo "→ Sync iOS project…"
./node_modules/.bin/cap sync ios

WORKSPACE="$ROOT/ios/App/App.xcworkspace"
SCHEME="App"
ARCHIVE="$ROOT/release/MyFinance-ios.xcarchive"
EXPORT_DIR="$ROOT/release/ios-export"
IPA_OUT="$ROOT/release/MyFinance-1.0.0-ipad.ipa"

mkdir -p "$ROOT/release"
rm -rf "$ARCHIVE" "$EXPORT_DIR"

echo "→ Archive (Release)…"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID:-}"

EXPORT_PLIST="$ROOT/scripts/ExportOptions.plist"
cat > "$EXPORT_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>development</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
PLIST

echo "→ Export IPA…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST"

FOUND_IPA="$(find "$EXPORT_DIR" -name '*.ipa' -print -quit)"
if [[ -z "$FOUND_IPA" ]]; then
  echo "ERROR: No IPA produced. Open Xcode → App target → Signing & Capabilities, select your Team, then retry."
  exit 1
fi

cp "$FOUND_IPA" "$IPA_OUT"
echo ""
echo "Done: $IPA_OUT"
echo "Install on iPad: Apple Configurator, Xcode Devices window, or TestFlight after upload."
