#!/bin/sh
#node /usr/akash/keepAkashAlive.js > /usr/akash/akashlogs.log &
forever start --pidFile /usr/akash/forever.pid -l /usr/akash/forever.log -a /usr/akash/keepAkashAlive.js
set -e

if [ "${1#-}" != "${1}" ] || [ -z "$(command -v "${1}")" ]; then
  set -- node "$@"
fi

exec "$@"
