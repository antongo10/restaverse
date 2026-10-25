# Where the seed's throwaway PostgreSQL lives — sourced by db.sh, load.sh and psql.sh.
#
#   MISE_SEED_DIR   the cluster's data (in data/) and its unix socket; keep the path short, a socket's is limited to
#                   ~100 characters (default /tmp/mise-seed)
#   MISE_SEED_PORT  the socket's number — there is no TCP port (default 54329)
#   PG_BIN          the folder of initdb, pg_ctl and psql, when they are not on the PATH

MISE_SEED_DIR=${MISE_SEED_DIR:-/tmp/mise-seed}
MISE_SEED_PORT=${MISE_SEED_PORT:-54329}
[ -n "$PG_BIN" ] && PATH="$PG_BIN:$PATH"

# macOS's postmaster refuses to start under an unknown locale (as in supabase/test/db.mjs)
if [ "$(uname)" = Darwin ]; then LC_ALL=en_US.UTF-8; else LC_ALL=C.UTF-8; fi
LANG=$LC_ALL
# the migrations' and the drops' "does not exist, skipping" are not worth reading
PGOPTIONS='-c client_min_messages=warning'
export LC_ALL LANG PATH PGOPTIONS

# psql_ <database> [psql arguments…] — only ever the local socket: the seed must not reach a real database
psql_() {
  db=$1
  shift
  psql -h "$MISE_SEED_DIR" -p "$MISE_SEED_PORT" -U postgres -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"
}
