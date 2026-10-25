#!/usr/bin/env python3
"""
Copies the loaded seed's organisation (./load.sh) into another database — a Supabase project — and takes it out again.

    export MISE_SEED_TARGET='postgresql://…'      the target's connection string (Supabase: the session pooler or the
                                                  direct connection, as postgres — not the transaction pooler), or the
                                                  same in the file ~/.config/mise/seed-target (or MISE_SEED_TARGET_FILE)
    python3 push.py check                         read only: the target's schema, clashes, size, who can see the org
    python3 push.py load                          the whole copy in one transaction, then rolled back — a rehearsal
    python3 push.py load --commit                 the same, kept
    python3 push.py verify                        the target's rows and books against the seed's
    python3 push.py remove [--commit]             every row of the organisation and its accounts, in one transaction

The rows are copied as the seed's own functions left them, with the target's triggers off for the transaction
(session_replication_role = replica): nothing fires — no email is queued, no stock moves twice, the target's
mise_now() is never touched. The emails the website bookings queued (emailOutbox) are not copied. The accounts get
no password: no one can sign in as them.
"""
import json
import os
import subprocess
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
PUSH = os.path.join(HERE, 'out', 'push')
ORG, RID = 'lumiere', 'bistrot-lumiere'
MANAGER = 'lea.fontaine@example.com'
NOT_COPIED = {'emailOutbox'}
# the seed's rows in tables with no organizationId, and how to find them
OTHERS = {
    'organizations': f"id = '{ORG}'",
    'menuVersions': f'"restaurantId" = \'{RID}\'',
    'loyaltyNotifications': f'"memberId" in (select id from public.profiles where "organizationId" = \'{ORG}\')',
}
USER_COLUMNS = ['id', 'email', 'raw_user_meta_data', 'raw_app_meta_data', 'created_at', 'email_confirmed_at']
# what Supabase Auth reads as text and cannot read as null
AUTH_TOKENS = ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change', 'email_change_token_current',
               'phone_change', 'phone_change_token', 'reauthentication_token']


class Failed(Exception):
    pass


def fail(message):
    raise Failed(message)


def run(cmd, sql=None):
    r = subprocess.run(cmd + (['-c', sql] if sql else []), capture_output=True, text=True)
    if r.returncode != 0:
        fail((r.stderr or r.stdout).strip())
    return r.stdout.strip()


def clean(sql):
    """The same question of the migrated template, before the seed."""
    return run([os.path.join(HERE, 'psql.sh'), '-At', '-d', 'mise_clean'], sql)


def local(sql):
    return run([os.path.join(HERE, 'psql.sh'), '-At'], sql)


def target_url():
    url = os.environ.get('MISE_SEED_TARGET', '')
    path = os.path.expanduser(os.environ.get('MISE_SEED_TARGET_FILE', '~/.config/mise/seed-target'))
    if not url and os.path.exists(path):
        with open(path) as f:
            url = f.read().strip()
    if not url:
        fail(f'Set MISE_SEED_TARGET to the target database’s connection string, or write it in {path}.')
    return url


def target(sql=None, script=None):
    return run(['psql', target_url(), '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'] + (['-f', script] if script else []), sql)


def where_shown():
    u = urllib.parse.urlparse(target_url())
    host = u.hostname or urllib.parse.parse_qs(u.query).get('host', ['local socket'])[0]
    return f'{u.username or "postgres"}@{host}{":" + str(u.port) if u.port else ""}/{(u.path or "/").lstrip("/") or "postgres"}'


def q(text):
    return "'" + text.replace("'", "''") + "'"


def ident(name):
    return '"' + name.replace('"', '""') + '"'


# ── what the seed holds ──────────────────────────────────────────────

def seed_tables():
    """(table, columns, where) for every public table the seed wrote to — a table it wrote to that this does not know stops it."""
    org_tables = local("select string_agg(table_name, ',') from information_schema.columns c join information_schema.tables t using (table_schema, table_name) "
                       "where c.table_schema = 'public' and c.column_name = 'organizationId' and t.table_type = 'BASE TABLE'").split(',')
    out = []
    for t in sorted(set(org_tables) - NOT_COPIED):
        out.append((t, f'"organizationId" = \'{ORG}\''))
    for t, w in OTHERS.items():
        out.append((t, w))
    # anything else the seed added would be left behind: refuse
    for t in local("select string_agg(table_name, ',') from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'").split(','):
        if t in org_tables or t in OTHERS or t in NOT_COPIED:
            continue
        if local(f'select count(*) from public.{ident(t)}') != clean(f'select count(*) from public.{ident(t)}'):
            fail(f'The seed wrote to public.{t}, which push.py does not know how to copy.')
    rows = []
    for t, w in out:
        n = int(local(f'select count(*) from public.{ident(t)} where {w}'))
        if n:
            cols = local(f"select string_agg(quote_ident(column_name), ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = {q(t)}")
            rows.append((t, cols, w, n))
    return rows


def export():
    if local(f"select count(*) from public.organizations where id = '{ORG}'") != '1':
        fail('The seed is not loaded here: ./db.sh start, python3 generate.py, ./load.sh first.')
    os.makedirs(PUSH, exist_ok=True)
    tables = seed_tables()
    for t, cols, w, n in tables:
        local(f"\\copy (select {cols} from public.{ident(t)} where {w}) to {q(os.path.join(PUSH, t + '.tsv'))}")
    users = f'select {",".join(USER_COLUMNS)} from auth.users where id in (select id from public.profiles where "organizationId" = \'{ORG}\')'
    local(f"\\copy ({users}) to {q(os.path.join(PUSH, 'auth.users.tsv'))}")
    accounts = int(local(f'select count(*) from ({users}) u'))
    data = sum(os.path.getsize(os.path.join(PUSH, f)) for f in os.listdir(PUSH))
    return tables, accounts, data


# ── the commands ─────────────────────────────────────────────────────

def check():
    tables, accounts, _ = export()
    # what the rows take on disk, indexes included: the seed's database, compacted, less the template it came from
    local('vacuum full')
    data = int(local("select pg_database_size('mise_seed') - pg_database_size('mise_clean')"))
    print(f'Target: {where_shown()}')
    print(target('select version()').split(' on ')[0])
    problems = []

    # every column the seed writes, of the same type there (030 keeps the costs to six decimals: numeric(20,6))
    columns = ("select n.nspname || '.' || c.relname || '|' || a.attname || '|' || format_type(a.atttypid, a.atttypmod) "
               "from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace "
               "where n.nspname in ('public', 'auth') and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped")
    def typed(lines):
        out = {}
        for line in lines.splitlines():
            t, c, ty = line.split('|')
            out.setdefault(t, {})[c] = ty
        return out
    have, mine = typed(target(columns)), typed(local(columns))
    for t, cols, _, _ in tables:
        there, here = have.get('public.' + t), mine['public.' + t]
        if there is None:
            problems.append(f'no table public.{t} — a migration the seed was made with is not applied there')
            continue
        missing = [c.strip('"') for c in cols.split(',') if c.strip('"') not in there]
        differ = [f'{c} ({there[c]} there, {here[c]} here)' for c in here if c in there and there[c] != here[c]]
        if missing:
            problems.append(f'public.{t} has no {", ".join(missing)} — a migration is missing there')
        if differ:
            problems.append(f'public.{t}: {", ".join(differ)} — a migration is missing there')
    if not set(USER_COLUMNS) <= set(have.get('auth.users', {})):
        problems.append('auth.users is not Supabase’s')

    if target(f"select count(*) from public.organizations where id = '{ORG}'") != '0':
        problems.append(f'the organisation {ORG} is already there (python3 push.py remove)')
    if 'public.restaurants' in have and target(f"select count(*) from public.restaurants where id = '{RID}' or slug = '{RID}'") != '0':
        problems.append(f'a restaurant {RID} is already there')
    emails = local(f"select string_agg(quote_literal(email), ',') from auth.users where id in (select id from public.profiles where \"organizationId\" = '{ORG}')")
    taken = target(f'select string_agg(email, \', \') from auth.users where email in ({emails})')
    if taken:
        problems.append(f'accounts already use {taken}')
    # the readable ids (the rest are UUIDs made from names, and the rehearsal catches any clash)
    for t, _, w, n in tables:
        if n > 500 or 'public.' + t not in have or 'id' not in have['public.' + t]:
            continue
        ids = local(f"select string_agg(quote_literal(id::text), ',') from public.{ident(t)} where {w}")
        clash = target(f'select string_agg(id::text, \', \') from (select id from public.{ident(t)} where id::text in ({ids}) limit 5) x')
        if clash:
            problems.append(f'public.{t} already has ids {clash}')

    try:
        target('begin; set local session_replication_role = replica; rollback;')
        replica = True
    except Failed:
        replica = False
        problems.append('this connection may not set session_replication_role — connect as postgres, not through the transaction pooler')

    size = int(target('select pg_database_size(current_database())'))
    admins = target("select count(*) from public.\"platformAdmins\"") if 'public.platformAdmins' in have else 'no platformAdmins table'
    print(f'Database size now: {size / 1e6:.0f} MB. The seed adds about {data / 1e6:.0f} MB, indexes included (Supabase’s free plan stops at 500 MB).')
    print(f'The seed: {sum(n for *_, n in tables)} rows in {len(tables)} tables, and {accounts} accounts (no password).')
    print(f'Platform operators who can open the organisation from the dashboard: {admins}.')
    if problems:
        print('Not ready:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    print('✓ Ready to load' + (' (triggers off for the transaction)' if replica else ''))


def load(commit):
    tables, accounts, _ = export()
    script = os.path.join(PUSH, 'load.sql')
    with open(script, 'w') as f:
        f.write("\\set ON_ERROR_STOP on\nbegin;\nset local statement_timeout = 0;\nset local lock_timeout = '15s';\n")
        f.write('set local session_replication_role = replica;\n')
        for t, cols, _, _ in tables:
            f.write(f"\\copy public.{ident(t)} ({cols}) from {q(os.path.join(PUSH, t + '.tsv'))}\n")
        f.write('create temp table seed_users (id uuid, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz, email_confirmed_at timestamptz) on commit drop;\n')
        f.write(f"\\copy seed_users from {q(os.path.join(PUSH, 'auth.users.tsv'))}\n")
        f.write("""do $$
declare
  cols text := 'id, email, raw_user_meta_data, raw_app_meta_data, created_at, email_confirmed_at';
  vals text := cols;
  c text;
begin
  for c in select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users' loop
    if c = 'instance_id' then
      cols := cols || ', instance_id'; vals := vals || ', ''00000000-0000-0000-0000-000000000000''::uuid';
    elsif c in ('aud', 'role') then
      cols := cols || ', ' || c; vals := vals || ', ''authenticated''';
    elsif c = 'updated_at' then
      cols := cols || ', updated_at'; vals := vals || ', created_at';
    elsif c = any (array[""" + ', '.join(q(t) for t in AUTH_TOKENS) + """]) then
      cols := cols || ', ' || c; vals := vals || ', ''''';
    end if;
  end loop;
  execute format('insert into auth.users (%s) select %s from seed_users', cols, vals);
end $$;
""")
        f.write(f"select 'rows in the organisation: ' || (" + ' + '.join(f'(select count(*) from public.{ident(t)} where {w})' for t, _, w, _ in tables) + ');\n')
        f.write('commit;\n' if commit else 'rollback;\n')
        if commit:
            # the planner's statistics at once, not when autovacuum gets round to it
            f.write('analyze ' + ', '.join(f'public.{ident(t)}' for t, *_ in tables) + ';\n')
    print(f'Target: {where_shown()}')
    print(target(script=script))
    expected = sum(n for *_, n in tables)
    print(f'expected {expected} rows and {accounts} accounts')
    print('✓ Loaded' if commit else '✓ Rehearsal went through and was rolled back — python3 push.py load --commit to keep it')


def verify():
    tables, accounts, _ = export()
    print(f'Target: {where_shown()}')
    bad = []
    for t, _, w, n in tables:
        there = int(target(f'select count(*) from public.{ident(t)} where {w}'))
        if there != n:
            bad.append(f'public.{t}: {there} there, {n} in the seed')
    there = int(target(f'select count(*) from auth.users where id in (select id from public.profiles where "organizationId" = \'{ORG}\')'))
    if there != accounts:
        bad.append(f'auth.users: {there} there, {accounts} in the seed')

    def books(fn):
        manager = fn(f'select id from auth.users where email = {q(MANAGER)}')
        return json.loads(fn(f"select public.fin_months('{RID}', '2024-11', '2025-12') from (select set_config('request.jwt.claim.sub', '{manager}', false)) x"))
    if books(target) != books(local):
        bad.append('fin_months differs from the seed’s')
    if bad:
        for b in bad:
            print('  - ' + b)
        fail('The target does not match the seed')
    print(f'✓ {sum(n for *_, n in tables)} rows, {accounts} accounts and the books from December 2024 to December 2025 match the seed')


def remove(commit):
    print(f'Target: {where_shown()}')
    if target(f"select count(*) from public.restaurants where id = '{RID}' and \"organizationId\" = '{ORG}'") != '1':
        fail(f'There is no {RID} of {ORG} here: nothing to remove.')
    script = os.path.join(PUSH, 'remove.sql')
    os.makedirs(PUSH, exist_ok=True)
    with open(script, 'w') as f:
        f.write("\\set ON_ERROR_STOP on\nbegin;\nset local statement_timeout = 0;\nset local lock_timeout = '15s';\n")
        f.write('set local session_replication_role = replica;\n')
        f.write(f"""create temp table seed_gone on commit drop as select p.id, u.email from public.profiles p left join auth.users u on u.id = p.id where p."organizationId" = '{ORG}';
do $$
declare
  r record;
  n bigint;
  total bigint := 0;
begin
  -- the seed's accounts only: anyone else in the organisation is a real person, and stops this
  if exists (select 1 from seed_gone where coalesce(email, '') not like '%@example.com') then
    raise exception 'The organisation has accounts that are not the seed''s: %', (select string_agg(email, ', ') from seed_gone where email not like '%@example.com');
  end if;
  for r in select c.table_name t, bool_or(c.column_name = 'organizationId') has_org, bool_or(c.column_name = 'restaurantId') has_restaurant, bool_or(c.column_name = 'memberId') has_member
           from information_schema.columns c join information_schema.tables x using (table_schema, table_name)
           where c.table_schema = 'public' and x.table_type = 'BASE TABLE' and c.table_name <> 'organizations'
           group by c.table_name loop
    if r.has_org then
      execute format('delete from public.%I where "organizationId" = %L', r.t, '{ORG}');
    elsif r.has_restaurant then
      execute format('delete from public.%I where "restaurantId" = %L', r.t, '{RID}');
    elsif r.has_member then
      execute format('delete from public.%I where "memberId" in (select id from seed_gone)', r.t);
    else
      continue;
    end if;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  if to_regclass('auth.identities') is not null then delete from auth.identities where user_id in (select id from seed_gone); end if;
  if to_regclass('auth.sessions') is not null then delete from auth.sessions where user_id in (select id from seed_gone); end if;
  delete from auth.users where id in (select id from seed_gone);
  get diagnostics n = row_count;
  delete from public.organizations where id = '{ORG}';
  perform set_config('seed.removed', format('removed %s rows and %s accounts', total + 1, n), true);
end $$;
select current_setting('seed.removed');
""")
        f.write('commit;\n' if commit else 'rollback;\n')
    print(target(script=script))
    print('✓ Removed' if commit else '✓ Rehearsal went through and was rolled back — python3 push.py remove --commit to do it')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    commit = '--commit' in sys.argv
    commands = {'check': check, 'load': lambda: load(commit), 'verify': verify, 'remove': lambda: remove(commit)}
    if cmd not in commands:
        print(__doc__)
        sys.exit(1)
    try:
        commands[cmd]()
    except Failed as e:
        print('✗ ' + str(e))
        sys.exit(1)
