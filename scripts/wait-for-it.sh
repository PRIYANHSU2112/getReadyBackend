#!/bin/sh
# wait-for-it.sh host:port [-- command args]
set -e
HOSTPORT="$1"
shift
HOST="${HOSTPORT%%:*}"
PORT="${HOSTPORT##*:}"

echo "Waiting for $HOST:$PORT..."
i=0
while ! nc -z "$HOST" "$PORT" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "Timeout waiting for $HOST:$PORT"
    exit 1
  fi
  sleep 1
done
echo "$HOST:$PORT is available"

if [ "$#" -gt 0 ]; then
  if [ "$1" = "--" ]; then shift; fi
  exec "$@"
fi
