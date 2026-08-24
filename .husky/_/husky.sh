#!/usr/bin/env sh
# husky.sh minimal shim — compatible con husky 9 sin instalar binario
# Si husky real está instalado, delega; si no, no-op (permite que pre-commit corra)
if [ -f "$(dirname "$0")/../../node_modules/husky/lib/husky.sh" ]; then
  . "$(dirname "$0")/../../node_modules/husky/lib/husky.sh"
fi
