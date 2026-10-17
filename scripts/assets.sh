#!/usr/bin/env bash
# Holt Supabase-Bibliothek und Schriften (fest eingestellte Versionen) nach vendor/ und fonts/.
# Läuft automatisch beim Veröffentlichen (GitHub Actions) und lässt sich lokal genauso starten.
set -euo pipefail
cd "$(dirname "$0")/.."
SUPABASE_JS="2.45.4"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

hol () { # paket@version -> entpackt nach $tmp/<name>
  local spec="$1" name="$2"
  (cd "$tmp" && npm pack --silent "$spec" >/dev/null && mkdir -p "$name" && tar -xzf ./*.tgz -C "$name" && rm ./*.tgz)
  echo "geholt: $(node -p "require('$tmp/$name/package/package.json').name+'@'+require('$tmp/$name/package/package.json').version")"
}

hol "@supabase/supabase-js@${SUPABASE_JS}" supabase
mkdir -p vendor && cp "$tmp/supabase/package/dist/umd/supabase.js" vendor/supabase.js

hol "@fontsource-variable/bricolage-grotesque@5" bricolage
hol "@fontsource-variable/figtree@5" figtree
hol "@fontsource/ibm-plex-mono@5" plexmono
cp "$tmp/bricolage/package/files/bricolage-grotesque-latin-full-normal.woff2" fonts/bricolage-grotesque.woff2
cp "$tmp/figtree/package/files/figtree-latin-wght-normal.woff2"              fonts/figtree.woff2
cp "$tmp/plexmono/package/files/ibm-plex-mono-latin-400-normal.woff2"        fonts/ibm-plex-mono-400.woff2
cp "$tmp/plexmono/package/files/ibm-plex-mono-latin-500-normal.woff2"        fonts/ibm-plex-mono-500.woff2
ls -l vendor fonts
