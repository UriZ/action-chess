#!/usr/bin/env bash
# Copy the newest Gemini download to <dest>, refusing to accept one we already
# have. A mis-aimed click in the Gemini UI opens the image editor instead of
# downloading, and then `ls -t | head -1` silently hands back the PREVIOUS
# image -- which gets sliced and committed as the wrong piece. Fail instead.
set -euo pipefail
dest="$1"
src=$(ls -t ~/Downloads/Gemini_Generated_Image_* 2>/dev/null | head -1)
[ -n "$src" ] || { echo "FAIL: no Gemini download found"; exit 1; }
sum=$(md5 -q "$src")
dir=$(dirname "$dest")
mkdir -p "$dir"
for f in "$dir"/*.jpg; do
  [ -e "$f" ] || continue
  [ "$f" = "$dest" ] && continue
  if [ "$(md5 -q "$f")" = "$sum" ]; then
    echo "FAIL: newest download is identical to $(basename "$f") -- the download did not happen"
    exit 1
  fi
done
cp "$src" "$dest"
echo "ok: $dest"
