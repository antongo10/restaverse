# Bistrot Lumière — a seeded year

A fictional restaurant company, **Lumière Restauration**, and its one restaurant, **Bistrot Lumière**. The data runs
from the owner's €50,000 on 1 December 2024 to the New Year's Eve dinner of 31 December 2025.

It covers:

- **Opening:** the rent deposit, set-up fees, equipment and smallwares, the licences and insurance, and the opening
  stock.
- **Every trading day:** bookings and walk-ins, tables and covers, tickets with voids, comps and cancellations, tips,
  and card, cash or meal-voucher payments.
- **Stock:** deliveries from eight suppliers, house preps, waste and monthly counts.
- **The team:** thirteen people with their rota, punches, overtime and monthly payroll.
- **The books:** the year's bills.

It exists to exercise the dashboard's Finances, Inventory, Stock and team screens on something that looks like a real
year. A local run takes about three minutes.

## Run it

You need PostgreSQL's `initdb`, `pg_ctl` and `psql`: Homebrew's on macOS, or set `PG_BIN` to their folder. You also
need Python 3.9 or later, with no packages, and the repo's `npm install` for the report.

```bash
cd supabase/seed/lumiere
./db.sh start               # a private PostgreSQL in /tmp/mise-seed; the first time, the shim and every migration
python3 generate.py out     # writes out/00-clock.sql, out/2024-12.sql … out/2025-12.sql, out/99-restore-clock.sql
./load.sh                   # mise_seed: a fresh copy of the migrated database, then the files in order
npx tsx report.mts          # report.md: the year as the Finances page works it out, and 12 checks
python3 export.py lumiere.json   # optional: the organisation's rows as JSON
./db.sh stop
```

Each step does one thing:

- `./psql.sh` opens psql on the loaded seed.
- `./db.sh rebuild` builds the migrated template again after a new migration.
- `./load.sh` always starts again from that template, so it can be re-run as often as you like.
- `MISE_SEED_DIR` and `MISE_SEED_PORT` move the cluster (see `env.sh`).

Every account is `…@example.com`. The general manager, `lea.fontaine@example.com`, is the one the report reads as.

## The files

| File | What it does |
| --- | --- |
| `catalog.py` | What the company is: its team, suppliers, ingredients and preps, the menu with its seasons, the rooms and tables, and the equipment and when it was bought. |
| `generate.py` | Simulates the year, day by day, and writes it as SQL, one transaction per day. It is deterministic: one random seed gives the same files every time. |
| `db.sh`, `env.sh` | The throwaway cluster, and the template `mise_clean`: `../../test/shim.sql`, `setup.sql` and every numbered migration. |
| `load.sh`, `psql.sh` | Load the files into `mise_seed`, with each file's output in `logs/`; open psql on it. |
| `report.mts` | Reads the database through `fin_months`, as the manager, and works the figures out with `packages/shared` exactly as the Finances page does. It then checks that sales, cost of sales, payments, purchases, house batches, payroll, equipment, cash and equity all agree. |
| `export.py` | What the dashboard keeps in memory for the restaurant, plus `fin_months`, as one JSON file, for a mocked dashboard. |

## How it is made

Nothing is written straight into the books. The money and the stock move through the app's own functions:
`ops_record_purchase`, `ops_produce`, `ops_pay_order`, `ops_cancel_order`, `ops_stock_adjust` and `ops_count_stock`.

Each call is made as the person who would have made it, so their role's rules apply. A bartender cannot take a
payment, the cooks cannot touch the bar's stock, and the porters have no account at all.

The time is faked for this. `00-clock.sql` makes `public.mise_now()` read a session setting, and each event sets it
to its simulated moment. `99-restore-clock.sql` puts the function back.

The seed stays within today's data model:

- **Deposit:** the rent deposit is owner's money going out, not an asset.
- **Suppliers:** they are paid on delivery, so there are no supplier balances.
- **Payroll:** the monthly payroll is recorded, and the employer's charges are paid the month after.
- **Holidays:** there is no holiday accrual.
- **Discounts:** the till's only discount is loyalty, so a comp is a line given free.
- **Refunds:** there are none beyond voided lines and cancelled tickets.

## Test databases only

The scripts only ever talk to the local socket, and they should stay that way. The seed redefines `mise_now()` while
it loads, and it writes `auth.users` rows directly.

Loading it anywhere real is a separate decision. If you ever do, first leave out the `emailOutbox` rows that the
website bookings queue (about two thousand), so no fake guest is ever sent an email.

Also, the app counts from the real today, so the seed's December 2025 bills will show as not paid and its equipment
services as overdue.

## Copying it to a Supabase project

`push.py` copies the loaded organisation into another database, such as a Supabase project, and can take it out
again.

It doesn't replay the year there. It copies the rows the app's functions left in `mise_seed`:

- **One transaction:** the whole copy is all or nothing.
- **Triggers off** for that transaction only (`session_replication_role = replica`): no email is queued, no stock
  moves twice, and the target's clock is never touched.
- **What stays behind:** the queued booking emails are not copied.
- **The accounts:** the 12 accounts have no password, so no one can sign in as them.

```bash
mkdir -p ~/.config/mise && chmod 700 ~/.config/mise
pbpaste > ~/.config/mise/seed-target   # the connection string, copied from Supabase → Connect (session pooler)
python3 push.py check            # read only: missing migrations, clashes, size, who can open the organisation
python3 push.py load             # a rehearsal: everything, then rolled back
python3 push.py load --commit    # kept
python3 push.py verify           # every table's rows, the accounts and fin_months against the seed
python3 push.py remove --commit  # takes it all out again (without --commit: a rehearsal)
```

Before loading a live project:

- **Migrations:** the project needs every migration the seed was made with, 030 included; `check` names any that
  are missing or that left a column a different type. Without 030, a year of averaged costs runs to a thousand digits
  and the margins and finances time out.
- **Space:** it needs room for about 200 MB. Supabase's free plan stops at 500 MB.
- **Timing:** load outside service hours. Realtime has to read every new row, so the live tills and kitchen screens
  could lag while it does.

To open the organisation, sign in to the dashboard as a platform operator and switch to Lumière Restauration.

## What to expect

With migrations up to 030, at the time of writing, `report.md` showed:

| | |
| --- | ---: |
| Reconciliation checks | 12 of 12 hold |
| 2025 revenue before VAT | about €802k |
| Food cost | 26 % |
| Staff costs | 45 % of revenue |
| EBITDA | 18 % |
| Cash at 31 December 2025 | about €155k |
| Restaurant worth | about €170k |

A change to a migration or to `packages/shared/src/finance.ts` can move these figures, and the checks are what says
whether they still hold together.
