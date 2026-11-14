#!/bin/sh
# Renders the film's narration to narration/01.mp3, 02.mp3, … using a voice installed on this Mac.
# Usage:  sh narration/make.sh "Ava (Premium)"        (run from the project folder)
# List the voices you have with:  say -v '?'
# The lines are read from the <ol id="script"> in film.html, so edit the script there and re-run.
VOICE="${1:?Give a voice name, e.g. sh narration/make.sh \"Ava (Premium)\"}"
OUT="${2:-narration}"
cd "$(dirname "$0")/.." || exit 1
mkdir -p "$OUT"
i=0
grep -o '<li data-at="[^"]*">[^<]*</li>' film.html | sed 's/<[^>]*>//g' | while IFS= read -r line; do
  i=$((i + 1)); n=$(printf '%02d' "$i")
  say -v "$VOICE" -r 165 -o "$OUT/$n.aiff" "$line" && ffmpeg -loglevel error -y -i "$OUT/$n.aiff" -af "apad=pad_dur=0.2" -b:a 128k "$OUT/$n.mp3" && rm "$OUT/$n.aiff"
  echo "$n  $line"
done
