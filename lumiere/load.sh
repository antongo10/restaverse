#!/bin/sh
# Loads the files generate.py wrote into a fresh copy of mise_clean, named mise_seed: the clock first, then the months in
# order, then the clock put back. Stops at the first error; what each file printed is kept in logs/.
set -e
cd "$(dirname "$0")"
. ./env.sh
[ -f out/00-clock.sql ] || {
  echo "Nothing to load yet: python3 generate.py out"
  exit 1
}
psql_ postgres -c "drop database if exists mise_seed" -c "create database mise_seed template mise_clean"
mkdir -p logs
for f in out/00-clock.sql out/20*.sql out/99-restore-clock.sql; do
  log=logs/$(basename "$f" .sql).log
  start=$(date +%s)
  psql_ mise_seed -f "$f" > "$log" 2>&1 || {
    echo "FAILED $f"
    grep -m3 ERROR "$log"
    exit 1
  }
  echo "$f $(($(date +%s) - start))s"
done
