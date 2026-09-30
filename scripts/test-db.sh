#!/usr/bin/env sh
# Throwaway Postgres for the jest suite (podman or docker).
#   scripts/test-db.sh up | down
set -e
ENGINE=${CONTAINER_ENGINE:-podman}
NAME=advocate-leads-testdb
case "$1" in
  up)
    $ENGINE run -d --rm --name $NAME -e POSTGRES_USER=adv_test -e POSTGRES_PASSWORD=adv_test \
      -e POSTGRES_DB=advocate_test -p 127.0.0.1:55432:5432 docker.io/library/postgres:16-alpine
    until $ENGINE exec $NAME pg_isready -U adv_test -d advocate_test >/dev/null 2>&1; do sleep 1; done
    echo "test db ready on 127.0.0.1:55432" ;;
  down)
    $ENGINE rm -f $NAME ;;
  *)
    echo "usage: $0 up|down"; exit 1 ;;
esac
