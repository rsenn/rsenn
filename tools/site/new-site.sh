#!/bin/sh
# Scaffold sites/<name>/ from tools/site/templates/ and fill the mechanical
# placeholders. The prose placeholders (__HEADLINE__, __LEDE__, ...) stay
# in landing.html on purpose: they need writing, not substituting.
#
#   tools/site/new-site.sh <name> --tagline TEXT --description TEXT \
#       [--repo owner/name] [--mark TEXT] [--license TEXT] [--accent '#rrggbb'] [--art]
#
# --art also copies the example artwork (templates/art/: logo, decor sprites,
# live wallpaper + script, dot-matrix font sheet) and enables it in the config.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)

name=${1:?usage: new-site.sh <name> --tagline TEXT --description TEXT}; shift
repo=rsenn/$name; mark='{ }'; license=MIT; accent='#0b7c72'; tagline=; desc=; art=0
while [ $# -gt 0 ]; do
  [ "$1" = --art ] && { art=1; shift; continue; }
  case $1 in
    --repo) repo=$2 ;; --mark) mark=$2 ;; --license) license=$2 ;;
    --accent) accent=$2 ;; --tagline) tagline=$2 ;; --description) desc=$2 ;;
    *) echo "new-site.sh: unknown option $1" >&2; exit 1 ;;
  esac
  shift 2
done

dest="$root/sites/$name"
[ ! -e "$dest" ] || { echo "new-site.sh: $dest exists" >&2; exit 1; }
mkdir -p "$dest"

# soft accent tints: mix with white (light) / near-black (dark) in awk
tint() { awk -v c="${1#\#}" -v m="$2" -v b="$3" 'BEGIN{
  for(i=0;i<3;i++){v=strtonum("0x" substr(c,1+2*i,2)); o[i]=int(v*m+b*(1-m)+.5)}
  printf "#%02x%02x%02x", o[0],o[1],o[2]}' 2>/dev/null || printf '%s' "$1"; }
soft_l=$(tint "$accent" 0.12 255); soft_d=$(tint "$accent" 0.18 17)
accent_d=$(tint "$accent" 0.55 255)

for f in site.config.js landing.html theme.css favicon.svg; do
  sed -e "s|__NAME__|$name|g" -e "s|__REPO__|$repo|g" -e "s|__MARK__|$mark|g" \
      -e "s|__TAGLINE__|$tagline|g" -e "s|__DESCRIPTION__|$desc|g" -e "s|__LICENSE__|$license|g" \
      -e "s|__ACCENT_L__|$accent|g" -e "s|__ACCENT_D__|$accent_d|g" \
      -e "s|__SOFT_L__|$soft_l|g" -e "s|__SOFT_D__|$soft_d|g" \
      "$here/templates/$f" > "$dest/$f"
done
if [ "$art" = 1 ]; then
  mkdir -p "$dest/art"
  cp "$here"/templates/art/* "$dest/art/"
  rm -f "$dest/art/make-dotfont.py"
  sed -i '/\/\/ART-START/,/\/\/ART-END/{s|^  // |  |;/ART-START/d;/ART-END/d}' "$dest/site.config.js"
else
  sed -i '/\/\/ART-START/d;/\/\/ART-END/d' "$dest/site.config.js"
fi
echo "created $dest"
echo "next: add '$name=/path/to/checkout' to sites.local, fill the __PLACEHOLDERS__ in landing.html, then"
echo "      node tools/site/build.js $name"
