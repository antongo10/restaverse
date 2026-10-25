"""
The seeded organisation's rows, as one JSON file — for a mock of the dashboard's database, or to look at:

    python3 export.py lumiere.json

{org, restaurant, manager, tables: {table: [rows]}, finMonths}: what the dashboard mirrors (the restaurant, its rooms,
menu, stock, suppliers, purchases, team, shifts, punches, payslips, equipment and books — not the tickets or the
stock's movements, which it reads a period at a time), and fin_months from January 2024 to December 2026, read as the
manager.
"""
import json, os, subprocess, sys

ORG, RID = 'lumiere', 'bistrot-lumiere'
TABLES = '''restaurants siteContent siteDomains loyaltyProgram restaurantLoyalty diningAreas diningTables menuProducts menuCategories
stockItems suppliers purchaseOrders reservationSettings workStations staffMembers hrSettings staffRequests devices serviceSettings
assetModels assetLots financeEntries financeSettings profiles staffShifts timeEntries staffPayouts'''.split()


PSQL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'psql.sh')


def sql(s):
    return subprocess.run([PSQL, '-At', '-c', s], capture_output=True, text=True, check=True).stdout


cols = {}
for line in sql("select table_name, column_name from information_schema.columns where table_schema = 'public'").splitlines():
    t, c = line.split('|')
    cols.setdefault(t, set()).add(c)

out = {'organizations': json.loads(sql(f"select json_agg(o) from public.organizations o where id = '{ORG}'"))}
for t in TABLES:
    if t not in cols:
        print('no table', t)
        continue
    where = '"organizationId" = %r' % ORG if 'organizationId' in cols[t] else 'true'
    out[t] = json.loads(sql(f'select coalesce(json_agg(r_o_w), \'[]\') from public."{t}" r_o_w where {where}'))
manager = sql("select id from public.profiles where email = 'lea.fontaine@example.com'").strip()
months = json.loads(sql(f"select public.fin_months('{RID}', '2024-01', '2026-12') from (select set_config('request.jwt.claim.sub', '{manager}', false)) x"))
json.dump({'org': ORG, 'restaurant': RID, 'manager': manager, 'tables': out, 'finMonths': months}, open(sys.argv[1], 'w'))
print({t: len(v) for t, v in out.items()}, 'manager', manager)
