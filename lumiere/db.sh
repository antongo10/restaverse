#!/bin/sh
# The seed's throwaway PostgreSQL: a private cluster on a unix socket, and in it `mise_clean` — the test shim and every
# migration, the template load.sh copies the seed into.
#
#   ./db.sh start     start it; the first time, create the cluster and build mise_clean
#   ./db.sh rebuild   build mise_clean again, after a new migration (the loaded seed goes too: ./load.sh again)
#   ./db.sh stop      stop it — the data stays in $MISE_SEED_DIR (rm -rf it to start over)
set -e
cd "$(dirname "$0")"
. ./env.sh
DATA=$MISE_SEED_DIR/data
MIGRATIONS=../..

build() {
  psql_ postgres -c "drop database if exists mise_seed" -c "drop database if exists mise_clean" -c "create database mise_clean"
  : > "$MISE_SEED_DIR/migrate.log"
  for f in "$MIGRATIONS/test/shim.sql" "$MIGRATIONS/setup.sql" $(ls "$MIGRATIONS" | grep -E '^[0-9]{3}_.*\.sql$' | sort | sed "s|^|$MIGRATIONS/|"); do
    psql_ mise_clean -f "$f" > /dev/null 2>> "$MISE_SEED_DIR/migrate.log" || {
      echo "FAILED $f — see $MISE_SEED_DIR/migrate.log"
      exit 1
    }
  done
  echo "mise_clean: the shim and every migration, up to $(ls "$MIGRATIONS" | grep -E '^[0-9]{3}_.*\.sql$' | sort | tail -1)"
}

case "$1" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$MISE_SEED_DIR"
      initdb -D "$DATA" -U postgres --auth=trust -E UTF8 --no-sync > "$MISE_SEED_DIR/initdb.log"
    fi
    if ! pg_ctl -D "$DATA" status > /dev/null 2>&1; then
      # fast and unsafe — it is a throwaway: no fsync, no TCP
      pg_ctl -D "$DATA" -l "$MISE_SEED_DIR/postgres.log" -w start \
        -o "-p $MISE_SEED_PORT -k $MISE_SEED_DIR -c listen_addresses='' -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c max_wal_size=4GB" > /dev/null
    fi
    if [ -z "$(psql_ postgres -At -c "select 1 from pg_database where datname = 'mise_clean'")" ]; then
      build
    fi
    echo "ready — $MISE_SEED_DIR, socket $MISE_SEED_PORT"
    ;;
  rebuild)
    build
    ;;
  stop)
    pg_ctl -D "$DATA" -m fast -w stop > /dev/null
    echo stopped
    ;;
  *)
    echo "usage: ./db.sh start | rebuild | stop"
    exit 1
    ;;
esac
