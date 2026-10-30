#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"; H=${HELIUM:?HELIUM must point at a Helium checkout}; O=${OUT:-dist}; X=${MCPB:-npx -y @anthropic-ai/mcpb}; rm -rf "$O"; mkdir -p "$O"
stage() { local d="$O/$1/helium-run"; mkdir -p "$d/bin" "$d/include"; cp server.mjs README.md LICENSE "$d/"; cp -r "$H/hc/lib" "$d/lib"; cp "$H/hc/hrt.h" "$d/include/"; cp "$H/HELIUM.md" "$d/primer.md"; cp "$H/LICENSE" "$d/LICENSE-helium.txt"; cp "$2" "$d/bin/$3"; chmod 755 "$d/bin/$3"; tar -C "$O/$1" -czf "$O/helium-run-$1.tar.gz" helium-run; }
stage linux-x64 "${HCN:?HCN must point at a Linux x86-64 hcn}" hcn
stage macos "${HCMAC:?HCMAC must point at a macOS hc}" hc
V=$(node server.mjs --version); sed "s/\"version\": \"0.0.0\"/\"version\": \"$V\"/" manifest.json > "$O/macos/helium-run/manifest.json"
$X validate "$O/macos/helium-run/manifest.json"; $X pack "$O/macos/helium-run" "$O/helium-run-macos.mcpb"
rm -rf "$O/linux-x64" "$O/macos"; (cd "$O" && sha256sum helium-run-* > SHA256SUMS); ls -la "$O"
