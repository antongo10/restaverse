#!/bin/sh
# psql against the loaded seed (mise_seed), e.g. ./psql.sh -c 'select count(*) from "posOrders"'
cd "$(dirname "$0")"
. ./env.sh
psql_ mise_seed "$@"
