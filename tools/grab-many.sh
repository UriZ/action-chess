#!/usr/bin/env bash
# Assign the N newest Gemini downloads, oldest-first, to the given destinations.
# Used when several frames are generated in a row and then downloaded in order.
# Refuses if fewer than N downloads are newer than the marker file, so a
# download that silently failed cannot shift every frame by one.
set -euo pipefail
marker="${MARKER:-/tmp/claude-grab-marker}"
n=$#
files=$(ls -t ~/Downloads/Gemini_Generated_Image_* 2>/dev/null | head -n "$n" | tail -r)
count=$(echo "$files" | grep -c . || true)
[ "$count" -eq "$n" ] || { echo "FAIL: wanted $n downloads, found $count"; exit 1; }
if [ -f "$marker" ]; then
  newer=$(find ~/Downloads -name 'Gemini_Generated_Image_*' -newer "$marker" | wc -l | tr -d ' ')
  [ "$newer" -ge "$n" ] || { echo "FAIL: only $newer new downloads since marker, wanted $n"; exit 1; }
fi
i=0
for dest in "$@"; do
  i=$((i+1))
  src=$(echo "$files" | sed -n "${i}p")
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "ok: $(basename "$dest")"
done
touch "$marker"
