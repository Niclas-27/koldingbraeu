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
# Datei im Paket finden: erstes passendes Muster gewinnt (Namen unterscheiden sich je nach Version)
nimm () {
  local dir="$1" ziel="$2"; shift 2
  for muster in "$@"; do
    local f; f="$(ls "$dir" | grep -E "^${muster}$" | head -1 || true)"
    if [ -n "$f" ]; then cp "$dir/$f" "$ziel"; echo "$ziel <- $f"; return 0; fi
  done
  echo "Keine passende Datei in $dir. Vorhanden:" >&2; ls "$dir" | grep -- '-latin-' >&2; return 1
}
nimm "$tmp/bricolage/package/files" fonts/bricolage-grotesque.woff2 \
  'bricolage-grotesque-latin-full-normal\.woff2' 'bricolage-grotesque-latin-standard-normal\.woff2' \
  'bricolage-grotesque-latin-opsz-wdth-wght-normal\.woff2' 'bricolage-grotesque-latin-wdth-wght-normal\.woff2' \
  'bricolage-grotesque-latin-wght-normal\.woff2'
nimm "$tmp/figtree/package/files" fonts/figtree.woff2 'figtree-latin-wght-normal\.woff2' 'figtree-latin-.*-normal\.woff2'
nimm "$tmp/plexmono/package/files" fonts/ibm-plex-mono-400.woff2 'ibm-plex-mono-latin-400-normal\.woff2'
nimm "$tmp/plexmono/package/files" fonts/ibm-plex-mono-500.woff2 'ibm-plex-mono-latin-500-normal\.woff2'
ls -l vendor fonts
