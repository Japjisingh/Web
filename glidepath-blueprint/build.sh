#!/bin/bash
# usage: ./build.sh [scenes comma list | all] [outdir]
#   ./build.sh vor,hold dist-a   -> bundles only s-vor.js and s-hold.js into dist-a/app.js
#   ./build.sh                    -> all scenes into dist/
set -e
cd "$(dirname "$0")"
LIST=${1:-all}; OUT=${2:-dist}; TAG=$(echo "$OUT" | tr -c 'a-zA-Z0-9' '_')
mkdir -p "$OUT"; [ -e "$OUT/assets" ] || ln -s "$(pwd)/assets" "$OUT/assets" 2>/dev/null || true
if [ "$LIST" = all ]; then FILES=$(ls src/s-*.js); else FILES=$(for n in ${LIST//,/ }; do echo src/s-$n.js; done); fi
E=src/_entry_$TAG.js
{ echo "import { boot } from './boot.js';"; echo "const SCENES = {};";
  for f in $FILES; do n=$(basename $f .js); n=${n#s-}; echo "import s_$n from './s-$n.js'; SCENES['$n'] = s_$n;"; done
  echo "boot(SCENES);"; } > $E
./node_modules/.bin/esbuild $E --bundle --minify --format=iife --target=es2020 --outfile="$OUT/app.js" --log-level=warning
rm -f $E
cp index.html "$OUT/index.html"
echo "bundle bytes: $(stat -c %s "$OUT/app.js") -> $OUT"
