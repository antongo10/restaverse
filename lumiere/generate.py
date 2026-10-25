#!/usr/bin/env python3
"""
Seed: Bistrot Lumière, of the organisation « Lumière Restauration », from 1 December 2024 to 31 December 2025.

    python3 generate.py out          → out/00-clock.sql, out/2024-12.sql … out/2025-12.sql, out/99-restore-clock.sql
    python3 generate.py out --summary → also prints the months as the simulation saw them

Run the files in order against a database with every migration — load.sh does, see README.md. A TEST database only:
00-clock.sql makes public.mise_now() read the session setting `mise.clock`, so every row is stamped at its simulated
moment; 99-restore-clock.sql puts it back. Money and stock move through the app's own functions — ops_record_purchase,
ops_produce, ops_pay_order, ops_cancel_order, ops_stock_adjust, ops_count_stock — as the person who would have done it.
Everything is fictional and deterministic (one random seed).

Within today's data model: the rent deposit is an entry of the owners' money out (cash only, not the income
statement); suppliers are paid on delivery; payroll is the gross pay recorded each month plus the employer's charges,
which are paid the month after (so a month's charges are owed at its end); there is no holiday accrual, no refund
other than a cancelled or voided line, and no stock transfer (one restaurant).
"""
import json
import math
import os
import random
import sys
import unicodedata
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import catalog as C

R = random.Random(20241201)
TZ = ZoneInfo('Europe/Paris')
NS = uuid.UUID('9a3c5d0e-6f1b-4c7a-8e2d-1b4f6a8c0d2e')
START, OPENING, END = date(2024, 12, 1), date(2025, 1, 1), date(2025, 12, 31)
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
SUMMARY = '--summary' in sys.argv
RID = C.RID


# ── Helpers ──────────────────────────────────────────────────────────

def uid(*parts):
    return str(uuid.uuid5(NS, '/'.join(map(str, parts))))


def q(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int,)):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(round(v, 4))
    return "'" + str(v).replace("'", "''") + "'"


def jb(o):
    return q(json.dumps(o, ensure_ascii=False, separators=(',', ':'))) + '::jsonb'


def at(d, minutes):
    """An instant, in ms: `minutes` after midnight of d in Paris (past 24 h: the next day)."""
    minutes = int(round(minutes))
    h, m = divmod(minutes, 60)
    dd = d + timedelta(days=h // 24)
    return int(datetime(dd.year, dd.month, dd.day, h % 24, m, tzinfo=TZ).timestamp() * 1000)


def hm(minutes):
    minutes = int(round(minutes)) % 1440
    return f'{minutes // 60:02d}:{minutes % 60:02d}'


def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def month_key(d):
    return f'{d.year}-{d.month:02d}'


def last_day(d):
    nxt = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    return nxt - timedelta(days=1)


def ascii_slug(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().replace(' ', '').replace('’', '').replace("'", '')


def months_open(d):
    return (d.year - 2025) * 12 + d.month - 1


FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']


def month_fr(d):
    return f'{FR_MONTHS[d.month - 1]} {d.year}'


# ── The event log: what happens, when, and as whom ──────────────────

EVENTS = defaultdict(list)  # date → [(ms, seq, actor user id or None, sql)]
SEQ = [0]


def emit(d, t, actor, sql):
    SEQ[0] += 1
    EVENTS[d].append((t, SEQ[0], actor, sql))


# ── People ───────────────────────────────────────────────────────────

OWNER_ID = uid('user', 'owner')
STAFF = {}
for s in C.STAFF:
    STAFF[s['key']] = dict(s, id=uid('staff', s['key']), user=uid('user', s['key']) if s['role'] else None,
                           start_d=date.fromisoformat(s['start']), end_d=date.fromisoformat(s['end']) if s.get('end') else None,
                           email=f"{ascii_slug(s['name'].split()[0])}.{ascii_slug(s['name'].split()[-1])}@example.com")


def employed(s, d):
    return s['start_d'] <= d and (s['end_d'] is None or d <= s['end_d'])


ITEMS = {}
for (key, name, station, unit, size, label, cost, sup, perish, season, allergens) in C.INGREDIENTS:
    ITEMS[key] = dict(id=f'bl-{key}', key=key, name=name, kind='ingredient', station=station, unit=unit, packSize=size, packLabel=label,
                      cost=round(cost * (1.25 if station == 'kitchen' else 1.1)), supplier=sup, perish=perish, season=season, allergens=allergens)
for (key, name, station, unit, yld, recipe, shelf) in C.PREPS:
    ITEMS[key] = dict(id=f'bl-{key}', key=key, name=name, kind='prep', station=station, unit=unit, yieldQty=yld, recipe=recipe, shelf=shelf,
                      supplier=None, perish=0, allergens=[])
PRODUCTS = {}
for (key, name, cat, bill, station, price, vat, recipe, prep, months) in C.MENU:
    PRODUCTS[key] = dict(id=f'bl-{key}', key=key, name=name, cat=cat, bill=bill, station=station, price=price, vat=vat, recipe=recipe, prep=prep, months=months)
CATEGORY_NAME = {c[0]: c[2]['fr'] for c in C.MENU_CATEGORIES}
SUPPLIERS = {s['id']: s for s in C.SUPPLIERS}


def product_active(p, d):
    if p['key'] == 'reveillon':
        return d == date(2025, 12, 31)
    return p['months'] is None or d.month in p['months']


def price_on(p, d):
    """The menu's prices: the mains up 3 % on 1 September (to the nearest 50 cents)."""
    if p['bill'] == 'main' and p['key'] not in ('reveillon',) and d >= date(2025, 9, 1):
        return int(round(p['price'] * 1.03 / 50.0)) * 50
    return p['price']


# ── Guests (synthetic) ───────────────────────────────────────────────

FIRST = ['Camille', 'Léa', 'Manon', 'Chloé', 'Inès', 'Jade', 'Louise', 'Alice', 'Lina', 'Rose', 'Anna', 'Julia', 'Zoé', 'Clara', 'Sarah',
         'Emma', 'Margot', 'Lucie', 'Agathe', 'Elsa', 'Nina', 'Romane', 'Juliette', 'Mathilde', 'Pauline', 'Hélène', 'Isabelle', 'Sophie',
         'Nathalie', 'Claire', 'Lucas', 'Hugo', 'Louis', 'Gabriel', 'Arthur', 'Jules', 'Adam', 'Raphaël', 'Paul', 'Léo', 'Nathan', 'Tom',
         'Théo', 'Martin', 'Antoine', 'Maxime', 'Alexandre', 'Nicolas', 'Julien', 'Pierre', 'Thomas', 'Mathieu', 'Olivier', 'Philippe',
         'Laurent', 'Éric', 'Frédéric', 'Christophe', 'Sébastien', 'Vincent', 'Yanis', 'Karim', 'Mehdi', 'Sofiane', 'Amine', 'Lina', 'Yasmine']
LAST = ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre',
        'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent',
        'Muller', 'Lefèvre', 'Faure', 'André', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier', 'François', 'Legrand',
        'Gauthier', 'Garcia', 'Perrin', 'Robin', 'Clément', 'Morin', 'Nicolas', 'Henry', 'Roussel', 'Mathieu', 'Gautier', 'Masson',
        'Marchand', 'Duval', 'Denis', 'Dumont', 'Marie', 'Lemaire', 'Noël', 'Meyer', 'Dufour', 'Meunier', 'Brun', 'Blanchard', 'Giraud',
        'Joly', 'Rivière', 'Lucas', 'Brunet', 'Gaillard', 'Barbier', 'Arnaud', 'Martinez', 'Gérard', 'Roche', 'Renard', 'Schmitt', 'Roy',
        'Leroux', 'Colin', 'Vidal', 'Caron', 'Picard', 'Roger', 'Fabre', 'Aubert', 'Lemoine', 'Renaud', 'Dumas', 'Lacroix', 'Olivier',
        'Philippe', 'Bourgeois', 'Pierre', 'Benoît', 'Rey', 'Leclerc', 'Payet', 'Rolland', 'Leclercq', 'Guillaume', 'Lecomte', 'Lopez',
        'Jean', 'Dupuy', 'Guillot', 'Hubert', 'Berger', 'Carpentier', 'Sanchez', 'Dupuis', 'Moulin', 'Louis', 'Deschamps', 'Huet', 'Vasseur',
        'Perez', 'Boucher', 'Fleury', 'Royer', 'Klein', 'Jacquet', 'Adam', 'Paris', 'Poirier', 'Marty', 'Aubry', 'Guyot', 'Carré', 'Charles',
        'Renault', 'Charpentier', 'Ménard', 'Maillard', 'Baron', 'Bertin', 'Bailly', 'Hervé', 'Schneider', 'Fernandez', 'Le Gall', 'Collet',
        'Léger', 'Bouvier', 'Julien', 'Prévost', 'Millet', 'Perrot', 'Daniel', 'Le Roux', 'Cousin', 'Germain', 'Breton', 'Besson', 'Langlois']
TOURISTS_FIRST = ['Oliver', 'Emily', 'James', 'Sophie', 'William', 'Charlotte', 'Luca', 'Giulia', 'Matteo', 'Francesca', 'Lukas', 'Hannah',
                  'Felix', 'Lena', 'Lars', 'Ingrid', 'Noah', 'Mia', 'Ethan', 'Olivia', 'Marco', 'Chiara', 'Jonas', 'Elena']
TOURISTS_LAST = ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Rossi', 'Russo', 'Bianchi', 'Romano', 'Colombo', 'Müller', 'Schmidt',
                 'Fischer', 'Weber', 'Johansson', 'Andersen', 'Nielsen', 'Walker', 'Evans', 'Hughes', 'Ricci', 'Greco', 'Wagner', 'Becker']

GUESTS = []  # dicts: id, name, email, phone, locale, regular weight, first booking ms, …
EMAILS = set()


def new_guest(d):
    idx = len(GUESTS)
    tourist = R.random() < (0.28 if d.month in (6, 7, 8, 9) else 0.12)
    if tourist:
        first, last = R.choice(TOURISTS_FIRST), R.choice(TOURISTS_LAST)
        locale = R.choice(['en', 'en', 'en', 'it', 'de'])
    else:
        first, last = R.choice(FIRST), R.choice(LAST)
        locale = 'fr'
    base = f'{ascii_slug(first)}.{ascii_slug(last)}'
    email = f'{base}@example.com'
    n = 2
    while email in EMAILS:
        email = f'{base}{n}@example.com'
        n += 1
    EMAILS.add(email)
    # the ARCEP's numbers set aside for fiction: 06 39 98 xx xx
    phone = f'06 39 98 {idx // 100 % 100:02d} {idx % 100:02d}' if idx < 10000 else ''
    g = dict(id=uid('guest', idx), name=f'{first} {last}', email=email, phone=phone, locale=locale, tourist=tourist,
             weight=(0.15 if tourist else R.choice([0.4, 0.7, 1, 1, 1.5, 2.5, 4, 7])), first_ms=None, first_day=None,
             optin=R.random() < 0.32, allergies=R.choice(['', '', '', '', '', '', '', '', '', '', '', 'Arachides', 'Gluten', 'Fruits de mer', 'Lactose']),
             birthday=(f'{R.randint(1, 12):02d}-{R.randint(1, 28):02d}' if R.random() < 0.3 else ''), visits=0)
    GUESTS.append(g)
    return g


def pick_guest(d):
    """A returning guest, more often the longer the restaurant has been open — else someone new."""
    pool = [g for g in GUESTS if g['first_day'] is not None and g['first_day'] < d and not (g['tourist'] and (d - g['first_day']).days > 10)]
    p_return = min(0.5, 0.06 + 0.045 * max(0, months_open(d)))
    if pool and R.random() < p_return:
        return R.choices(pool, weights=[g['weight'] for g in pool])[0]
    return new_guest(d)


# ── Phase 1: the days, planned — who comes, when, at which table ─────

def service_open(d, s):
    if d < OPENING:
        return False
    wd = d.weekday()
    if wd == 0 or (s == 'dinner' and wd == 6):
        return False
    if date(2025, 11, 10) <= d <= date(2025, 11, 23):
        return False
    if d == date(2025, 12, 25) or (d == date(2025, 12, 24) and s == 'dinner') or (d == OPENING and s == 'lunch'):
        return False
    return True


LUNCH_BASE = {1: 34, 2: 34, 3: 36, 4: 38, 5: 42, 6: 46}
DINNER_BASE = {1: 37, 2: 41, 3: 47, 4: 58, 5: 64}
SEASON = {1: 0.9, 2: 0.95, 3: 0.98, 4: 1.0, 5: 1.06, 6: 1.12, 7: 1.24, 8: 1.28, 9: 1.1, 10: 0.98, 11: 0.88, 12: 1.04}
RAMP = [0.58, 0.7, 0.82, 0.92]
RAIN = {1: 0.2, 2: 0.18, 3: 0.18, 4: 0.15, 5: 0.1, 6: 0.06, 7: 0.03, 8: 0.05, 9: 0.1, 10: 0.2, 11: 0.25, 12: 0.2}


def demand(d, s, rain):
    base = (LUNCH_BASE if s == 'lunch' else DINNER_BASE)[d.weekday()]
    m = months_open(d)
    ramp = RAMP[m] if m < len(RAMP) else 1 + 0.008 * (m - len(RAMP))
    f = base * ramp * SEASON[d.month]
    if d == date(2025, 2, 14) and s == 'dinner':
        f *= 1.4
    if date(2025, 2, 14) <= d <= date(2025, 3, 2):
        f *= 1.08  # le Carnaval
    if date(2025, 5, 23) <= d <= date(2025, 5, 25):
        f *= 1.15  # le Grand Prix, next door
    if date(2025, 12, 13) <= d <= date(2025, 12, 23) and s == 'dinner':
        f *= 1.2
    if d == OPENING:
        f = 30
    if rain:
        f *= 0.9
    return max(4, f * R.lognormvariate(0, 0.13))


PARTY_SIZES = [(1, 6), (2, 46), (3, 13), (4, 21), (5, 5), (6, 6), (8, 2)]


def party_size(s):
    sizes, weights = zip(*PARTY_SIZES)
    n = R.choices(sizes, weights)[0]
    return 1 if (s == 'lunch' and n == 1 and R.random() < 0.3) else n


def arrival(s):
    """Two sittings, as a bistro works them: 12:00 and 13:15 at lunch, 19:15 and 21:15 at dinner."""
    if s == 'lunch':
        t = R.gauss(12 * 60 + 10, 12) if R.random() < 0.56 else R.gauss(13 * 60 + 20, 12)
        return int(min(13 * 60 + 50, max(11 * 60 + 50, t))) // 5 * 5
    t = R.gauss(19 * 60 + 20, 14) if R.random() < 0.52 else R.gauss(21 * 60 + 15, 14)
    return int(min(22 * 60, max(19 * 60, t))) // 5 * 5


def duration(s, size):
    base = (55 if size <= 2 else 68 if size <= 4 else 80) if s == 'lunch' else (92 if size <= 2 else 105 if size <= 4 else 120)
    return int(base + R.gauss(0, 7))


def tables_on(d, rain):
    terrace = date(2025, 5, 1) <= d <= date(2025, 10, 12) and not rain
    return [t for t in C.TABLES if t[2] == 'bl-a-salle' or terrace]


PLAN = {}  # date → {'rain', 'lunch': {...}, 'dinner': {...}}
BOOKINGS = []  # every booking ever made, kept, cancelled or not honoured


DEMAND = defaultdict(float)
SEATED = defaultdict(int)


def plan_service(d, s, rain):
    target = demand(d, s, rain)
    DEMAND[month_key(d)] += target
    if d == date(2025, 12, 31) and s == 'dinner':
        target = 46
    parties, covers = [], 0
    while covers < target:
        size = party_size(s)
        booked_p = (0.32 if s == 'lunch' else 0.55 if d.weekday() not in (4, 5) else 0.7) if d > OPENING else 0.85
        if d == date(2025, 12, 31) and s == 'dinner':
            booked_p = 1.0
        parties.append(dict(size=size, booked=R.random() < booked_p, arrive=arrival(s)))
        covers += size
    # the tables: booked parties first, each at the smallest table it fits at, free for its meal
    occupied = defaultdict(list)
    seated = []
    tables = tables_on(d, rain)
    def combos(size):
        singles = sorted([[t] for t in tables if t[3] >= min(size, 6) and t[3] - size < 3], key=lambda c: (c[0][3], R.random()))
        pairs = []
        same_room = lambda a, b: a[2] == b[2]
        if 3 <= size <= 4:
            twos = [t for t in tables if t[3] == 2]
            pairs = [[a, b] for i, a in enumerate(twos) for b in twos[i + 1:] if same_room(a, b) and abs(a[5] - b[5]) + abs(a[6] - b[6]) <= 4]
        elif 5 <= size <= 6:
            fours = [t for t in tables if t[3] == 4]
            twos = [t for t in tables if t[3] == 2]
            pairs = [[a, b] for a in fours for b in twos if same_room(a, b)]
        elif size >= 7:
            fours = [t for t in tables if t[3] == 4]
            pairs = [[a, b] for i, a in enumerate(fours) for b in fours[i + 1:]]
        R.shuffle(pairs)
        return singles + pairs

    for p in sorted(parties, key=lambda p: (not p['booked'], p['arrive'])):
        p['dur'] = duration(s, p['size'])
        fits = combos(p['size'])
        if p['size'] <= 2 and d.month in (5, 6, 7, 8, 9) and R.random() < 0.55:
            fits.sort(key=lambda c: (c[0][2] != 'bl-a-terrasse', len(c)))
        done = False
        for shift in ((0, 10, 20) if p['booked'] else (0, 10, 20, 30)):
            a, b = p['arrive'] + shift, p['arrive'] + shift + p['dur']
            for c in fits:
                if all(all(b <= x or a >= y for (x, y) in occupied[t[0]]) for t in c):
                    for t in c:
                        occupied[t[0]].append((a, b + 10))
                    p['arrive'], p['table'], p['joined'] = a, c[0], c[1:]
                    seated.append(p)
                    done = True
                    break
            if done:
                break
    # a few parties seated and gone before ordering; counter tickets at the bar
    for p in seated:
        p['cancelled'] = (not p['booked']) and R.random() < 0.004
    counter = [dict(t=(R.randint(11 * 60 + 40, 14 * 60 + 30) if s == 'lunch' else R.randint(18 * 60 + 15, 22 * 60 + 30))) for _ in range(
        max(0, int(R.gauss(3.5 if s == 'lunch' else 5.5, 1.5) * SEASON[d.month])))]
    SEATED[month_key(d)] += sum(p['size'] for p in seated)
    return dict(parties=sorted(seated, key=lambda p: p['arrive']), counter=sorted(counter, key=lambda c: c['t']),
                covers=sum(p['size'] for p in seated if not p['cancelled']))


def make_booking(d, s, p):
    """The booking behind a party, made some days before — on the phone, on the website, or at the restaurant."""
    when = p['arrive'] if p else arrival(s)
    lead = R.choices([0, 1, 2, 3, 5, 7, 10, 14, 21], [18, 20, 14, 10, 12, 10, 7, 6, 3])[0]
    made = d - timedelta(days=lead)
    if made < date(2024, 12, 16):
        made = date(2024, 12, 16) + timedelta(days=R.randint(0, 14))
    t = R.randint(9 * 60, 22 * 60)
    if made == d:
        t = min(t, when - 30)
    g = pick_guest(made)
    source = 'website' if (made >= date(2024, 12, 20) and R.random() < 0.52) else ('phone' if R.random() < 0.9 else 'staff')
    note, occasion = '', ''
    r = R.random()
    if r < 0.05:
        note, occasion = 'Anniversaire', 'birthday'
    elif r < 0.07:
        note = 'Chaise haute pour un enfant'
    elif r < 0.1 and d.month in (5, 6, 7, 8, 9):
        note = 'En terrasse si possible'
    elif r < 0.12:
        note = 'Table au calme'
    elif r < 0.13:
        occasion = 'business'
    b = dict(id=uid('booking', len(BOOKINGS)), day=d, service=s, time=when, size=p['size'] if p else party_size(s),
             guest=g, made=made, made_t=t, source=source, note=note, occasion=occasion, party=p, fate='seated')
    BOOKINGS.append(b)
    ms = at(made, t)
    if g['first_ms'] is None or ms < g['first_ms']:
        g['first_ms'], g['first_day'] = ms, made
    return b


def plan():
    for d in daterange(OPENING, END):
        rain = R.random() < RAIN[d.month]
        day = dict(rain=rain)
        for s in ('lunch', 'dinner'):
            if not service_open(d, s):
                continue
            sv = plan_service(d, s, rain)
            for p in sv['parties']:
                p['booking'] = make_booking(d, s, p) if p['booked'] else None
                p['guest'] = p['booking']['guest'] if p['booking'] else (pick_guest(d) if R.random() < 0.1 + 0.01 * months_open(d) else None)
                if p['guest'] and p['guest']['first_day'] is None:
                    p['guest']['first_ms'], p['guest']['first_day'] = at(d, p['arrive']), d
            # bookings that were cancelled, and guests who never came
            n_booked = sum(1 for p in sv['parties'] if p['booked'])
            for _ in range(sum(1 for _ in range(n_booked) if R.random() < 0.055)):
                b = make_booking(d, s, None)
                b['fate'] = 'cancelled'
            for _ in range(sum(1 for _ in range(n_booked) if R.random() < 0.025)):
                b = make_booking(d, s, None)
                b['fate'] = 'no_show'
            day[s] = sv
        PLAN[d] = day


# ── What a table orders ──────────────────────────────────────────────

def w_pick(options):
    keys, weights = zip(*[(k, w) for k, w in options if w > 0])
    return R.choices(keys, weights)[0]


def mains_weights(d, s):
    summer, winter = d.month in (5, 6, 7, 8, 9), d.month in (11, 12, 1, 2, 3)
    w = [('entrecote', 15 if s == 'dinner' else 10), ('burger', 14), ('daube', 13 if winter else 7), ('daurade', 15 if summer else 10),
         ('risotto', 9), ('nicoise', 16 if summer else 6), ('tartare', 10), ('volaille', 9)]
    if s == 'lunch' and d.weekday() in (1, 2, 3, 4):
        w.append(('pdj', 34))
    if d == date(2025, 12, 31) and s == 'dinner':
        return [('reveillon', 1)]
    return w


def starters(d):
    w = [('burrata', 9), ('oeuf', 8), ('carpaccio', 8), ('pissaladiere', 7)]
    for k in ('soupe', 'veloute', 'gaspacho'):
        if product_active(PRODUCTS[k], d):
            w.append((k, 10))
    return w


DESSERTS = [('tarte', 10), ('mousse', 11), ('creme', 9), ('tiramisu', 10), ('gourmand', 8)]


def order(d, s, size, counter=False):
    """What a party orders: per guest, and for the table. Returns [(product key, seat, course)]."""
    lines = []
    if counter:
        k = w_pick([('cafe', 55), ('creme-cafe', 8), ('demi', 14), ('pastis', 6), ('verre-rose', 7), ('coca', 6), ('pinte', 4)] if s == 'lunch'
                   else [('demi', 26), ('pinte', 16), ('verre-rouge', 12), ('verre-rose', 10), ('spritz', 10), ('pastis', 8), ('cafe', 10), ('mojito', 8)])
        lines.append((k, None, 1))
        if R.random() < 0.25:
            lines.append((k, None, 1))
        return lines
    reveillon = d == date(2025, 12, 31) and s == 'dinner'
    summer = d.month in (5, 6, 7, 8, 9)
    for seat in range(1, size + 1):
        if s == 'dinner' and not reveillon and R.random() < 0.26:
            lines.append((w_pick([('spritz', 35 if summer else 25), ('mojito', 20 if summer else 12), ('pastis', 14), ('pinte', 14), ('demi', 14), ('verre-blanc', 8)]), seat, 1))
        if not reveillon and R.random() < (0.52 if s == 'dinner' else 0.22):
            lines.append((w_pick(starters(d)), seat, 1))
        if R.random() < 0.97:
            lines.append((w_pick(mains_weights(d, s)), seat, 2))
        if not reveillon and R.random() < (0.48 if s == 'dinner' else 0.33):
            lines.append((w_pick(DESSERTS), seat, 3))
            if lines[-1][0] == 'gourmand':
                continue
        if R.random() < (0.42 if s == 'dinner' else 0.62):
            lines.append((w_pick([('cafe', 85), ('creme-cafe', 6), ('the', 9)]), seat, 3))
        if s == 'dinner' and R.random() < 0.07:
            lines.append(('limoncello', seat, 3))
    # the wine: bottles for a table, else by the glass
    if size >= 2 and R.random() < (0.42 if s == 'dinner' else 0.14):
        for _ in range(max(1, round(size / 2.7))):
            lines.append((w_pick([('btl-rose', 50 if summer else 25), ('btl-bordeaux', 25 if summer else 45), ('btl-chablis', 25 if summer else 30)]), None, 1))
    else:
        for seat in range(1, size + 1):
            if R.random() < (0.42 if s == 'dinner' else 0.3):
                lines.append((w_pick([('verre-rose', 45 if summer else 20), ('verre-rouge', 25 if summer else 50), ('verre-blanc', 30)]), seat, 1))
            elif R.random() < (0.12 if s == 'lunch' else 0.06):
                lines.append(('demi', seat, 1))
            elif R.random() < 0.16:
                lines.append((w_pick([('coca', 50), ('limonade', 50)]), seat, 1))
    if R.random() < (0.6 if s == 'dinner' else 0.5):
        for _ in range(max(1, math.ceil(size / 3))):
            lines.append((w_pick([('eau-plate', 65), ('eau-gazeuse', 35)]), None, 1))
    return lines


# ── The stock, as the kitchen and the bar know it ────────────────────

STOCK = defaultdict(float)  # ingredient → on hand
PREP_LOTS = defaultdict(list)  # prep → [[day made, qty]] oldest first
AVG = {}  # ingredient → average cost per base unit (cents), as the database keeps it
USED = defaultdict(lambda: defaultdict(float))  # item → date → used (sales, production, waste)
COVERS = defaultdict(int)  # date → covers served
RATE = {}  # item → use per cover


def prep_onhand(k):
    return sum(q for _, q in PREP_LOTS[k])


def onhand(k):
    return prep_onhand(k) if ITEMS[k]['kind'] == 'prep' else STOCK[k]


def unit_cost(k):
    it = ITEMS[k]
    if it['kind'] == 'prep':
        return sum(unit_cost(i) * q for i, q in it['recipe']) / it['yieldQty']
    return AVG.get(k, it['cost'] / it['packSize'])


def take(k, qty, d, used=True):
    """qty of an item leaves the shelf: a prep, oldest batch first. What is thrown away is not use to plan on."""
    if used:
        USED[k][d] += qty
    if ITEMS[k]['kind'] == 'prep':
        lots = PREP_LOTS[k]
        left = qty
        while left > 1e-9 and lots and lots[0][1] > 0:
            use = min(left, lots[0][1])
            lots[0][1] -= use
            left -= use
            if lots[0][1] <= 1e-9:
                lots.pop(0)
        if left > 1e-9:
            # the database lets a shelf go below zero; so does the mirror — the next batch makes up for it
            if lots and lots[0][1] < 0:
                lots[0][1] -= left
            else:
                lots.insert(0, [d, -left])
        return
    STOCK[k] -= qty


def add_prep(k, d, qty):
    lots = PREP_LOTS[k]
    if lots and lots[0][1] < 0:
        qty += lots.pop(0)[1]
    if qty > 0:
        lots.append([d, qty])
    elif qty < 0:
        lots.insert(0, [d, qty])


def receive(k, qty, cost_cents):
    held = max(STOCK[k], 0)
    before = AVG.get(k, cost_cents / qty)
    AVG[k] = (held * before + cost_cents) / (held + qty)
    STOCK[k] += qty


def recipe_use(product_key):
    return PRODUCTS[product_key]['recipe']


# ── Prices over the year ─────────────────────────────────────────────

PRODUCE_SEASON = {
    'tomates': {1: 1.4, 2: 1.4, 3: 1.3, 4: 1.12, 5: 0.95, 6: 0.8, 7: 0.75, 8: 0.75, 9: 0.85, 10: 1.0, 11: 1.2, 12: 1.35},
    'courgettes': {1: 1.35, 2: 1.35, 3: 1.25, 4: 1.1, 5: 0.9, 6: 0.8, 7: 0.75, 8: 0.78, 9: 0.9, 10: 1.05, 11: 1.2, 12: 1.3},
    'salade': {1: 1.15, 2: 1.15, 3: 1.05, 4: 0.95, 5: 0.9, 6: 0.9, 7: 0.95, 8: 1.0, 9: 0.95, 10: 1.0, 11: 1.1, 12: 1.15},
    'courge': {1: 1.0, 2: 1.05, 3: 1.15, 4: 1.25, 5: 1.3, 6: 1.3, 7: 1.3, 8: 1.2, 9: 1.0, 10: 0.85, 11: 0.85, 12: 0.95},
    'haricots': {1: 1.3, 2: 1.3, 3: 1.2, 4: 1.1, 5: 0.95, 6: 0.85, 7: 0.8, 8: 0.8, 9: 0.9, 10: 1.0, 11: 1.15, 12: 1.25},
}


def pack_price(k, d):
    it = ITEMS[k]
    m = max(0, (d.year - 2024) * 12 + d.month - 12)
    infl = 1 + 0.0016 * m
    if k in ('entrecote', 'rumsteck', 'hache', 'paleron'):
        infl += 0.003 * m  # beef went up through the year
    season = PRODUCE_SEASON.get(k, {}).get(d.month, 1.0) if it['season'] == 'produce' else 1.0
    return int(round(it['cost'] * infl * season * R.uniform(0.97, 1.03)))


# ── Phase 2: the days, lived ─────────────────────────────────────────

SHIFTS = defaultdict(list)  # date → [dict(staff, service, start, end, brk)]
WEEK_HOURS = defaultdict(float)  # (staff key, monday) → planned hours
MONTH = defaultdict(lambda: defaultdict(float))  # month → figures for the summary and the monthly bills
TIPS = defaultdict(int)  # month → tips
WEB_COVERS = defaultdict(int)


def staff_on(d, service, teams):
    return [sh['staff'] for sh in SHIFTS[d] if sh['service'] == service and sh['staff']['team'] in teams]


def someone(d, service, teams, fallback='lea'):
    """Who on the shift does it in the app — someone with an account (a porter clocks in at the kiosk only)."""
    on = [st for st in staff_on(d, service, teams) if st['user']]
    if on:
        return R.choice(on)
    return STAFF[fallback] if employed(STAFF[fallback], d) else STAFF['lea']


SHIFT_TIMES = {
    ('kitchen', 'lunch'): (9 * 60 + 30, 14 * 60 + 45, 30), ('kitchen', 'dinner'): (17 * 60 + 30, 22 * 60 + 45, 30),
    ('kp', 'lunch'): (11 * 60 + 30, 15 * 60 + 30, 0), ('kp', 'dinner'): (19 * 60, 23 * 60 + 30, 0),
    ('floor', 'lunch'): (11 * 60 + 30, 15 * 60, 0), ('floor', 'dinner'): (18 * 60 + 30, 23 * 60 + 15, 15),
    ('bar', 'lunch'): (11 * 60 + 30, 15 * 60, 0), ('bar', 'dinner'): (18 * 60, 23 * 60 + 45, 30),
    ('management', 'lunch'): (10 * 60, 15 * 60, 30), ('management', 'dinner'): (17 * 60 + 30, 23 * 60 + 30, 30),
}
KP = {'mamadou', 'ines'}


def plan_week(monday):
    """The week's rota: as many cooks, porters, waiters and bartenders as each service's bookings call for."""
    for d in daterange(monday, monday + timedelta(days=6)):
        for s in ('lunch', 'dinner'):
            if not service_open(d, s) and not (d in (date(2024, 12, 30), date(2024, 12, 31)) and s == 'lunch'):
                continue
            c = PLAN.get(d, {}).get(s, {}).get('covers', 0)
            setup = d < OPENING
            needs = {
                'kitchen': 3 if setup else (2 if c < 36 else 3) if s == 'lunch' else (2 if c < 30 else 3 if c < 62 else 4),
                'kp': 1 if setup else 1 + (s == 'dinner' and c >= 52),
                'floor': 2 if setup else (1 if c < 18 else 2 if c < 38 else 3) if s == 'lunch' else (2 if c < 34 else 3 if c < 54 else 4),
                'bar': 1 if setup else (1 if s == 'dinner' or d.weekday() in (5, 6) or c >= 40 else 0),
                # the manager: every lunch, and a split shift Thursday to Saturday — 39 hours over five days
                'management': 1 if s == 'lunch' or d.weekday() in (3, 4, 5) or setup else 0,
            }
            if setup:
                needs['management'] = 1
            for role, n in needs.items():
                pool = [st for st in STAFF.values() if employed(st, d)
                        and (st['key'] in KP if role == 'kp' else st['team'] == role and st['key'] not in KP)]
                taken = {sh['staff']['key'] for sh in SHIFTS[d] if sh['service'] == s}
                pool = [st for st in pool if st['key'] not in taken
                        and len({sh['date'] for sh in [x for dd in daterange(monday, d) for x in SHIFTS[dd]] if sh['staff']['key'] == st['key'] and sh['date'] != d}) < 5]
                # who is furthest below their week — extras last, unless it is the weekend
                def load(st):
                    hours = st['hours'] or 16
                    extra = 0.6 if st['contract'] == 'extra' and d.weekday() not in (4, 5, 6) else 0
                    return WEEK_HOURS[(st['key'], monday)] / hours + extra + R.random() * 0.05
                for st in sorted(pool, key=load)[:n]:
                    a, b, brk = SHIFT_TIMES[('kp' if role == 'kp' else role, s)]
                    if setup:
                        a, b, brk = (10 * 60, 17 * 60, 60) if s == 'lunch' else (a, b, brk)
                    SHIFTS[d].append(dict(staff=st, service=s, start=a, end=b, brk=brk, date=d, id=uid('shift', st['key'], d, s)))
                    WEEK_HOURS[(st['key'], monday)] += (b - a - brk) / 60
    # written on the Friday before, by the manager — or once the person has joined
    written = monday - timedelta(days=3)
    for d in daterange(monday, monday + timedelta(days=6)):
        if d > END:
            continue
        for sh in SHIFTS[d]:
            wd = max(written, START, sh['staff']['start_d'] - timedelta(days=4))
            emit(wd, at(wd, 16 * 60), STAFF['lea']['user'], f'insert into public."staffShifts" ("id", "restaurantId", "staffId", "date", "start", "end", "breakMinutes", "note", "createdAt", "updatedAt") values ({q(sh["id"])}, {q(RID)}, {q(sh["staff"]["id"])}, {q(d.isoformat())}, {q(hm(sh["start"]))}, {q(hm(sh["end"]))}, {sh["brk"]}, {q("")}, {at(wd, 16 * 60)}, {at(wd, 16 * 60)});')


PUNCHES = defaultdict(list)  # staff key → [(date, clock in ms, clock out ms, break)]


def punch(d):
    """The day's clock-ins and clock-outs, at the kiosk or on their phones — a little late, a little over."""
    for sh in SHIFTS[d]:
        busy = PLAN.get(d, {}).get(sh['service'], {}).get('covers', 0) > 45
        cin = sh['start'] + R.gauss(-3, 3)
        cout = sh['end'] + abs(R.gauss(6 if not busy else 14, 7))
        a, b = at(d, cin), at(d, cout)
        PUNCHES[sh['staff']['key']].append((d, a, b, sh['brk']))
        src = 'pin' if sh['staff']['user'] is None or R.random() < 0.7 else 'self'
        emit(d, b, sh['staff']['user'], f'insert into public."timeEntries" ("id", "restaurantId", "staffId", "clockIn", "clockOut", "breakMinutes", "source", "note", "createdAt", "updatedAt") values ({q(uid("punch", sh["id"]))}, {q(RID)}, {q(sh["staff"]["id"])}, {a}, {b}, {sh["brk"]}, {q(src)}, {q("")}, {a}, {b});')


# ── Forecasts: how much each item will be needed ─────────────────────

def planned_covers(d):
    if d > END:
        # the restaurant goes on after the seeded year: plan on the same day a week before
        return planned_covers(d - timedelta(days=7))
    p = PLAN.get(d)
    if not p:
        return 0
    return sum(p[s]['covers'] for s in ('lunch', 'dinner') if s in p) + sum(len(p[s]['counter']) * 0.3 for s in ('lunch', 'dinner') if s in p)


SEED_RATE = {}  # month → item → use per cover, from a sample of what tables order that month


def learn_rates(d):
    """Use per cover over the last three weeks."""
    days = [d - timedelta(days=i) for i in range(1, 22)]
    covers = sum(COVERS[x] for x in days)
    if covers < 250:
        return
    for k in ITEMS:
        RATE[k] = sum(USED[k][x] for x in days) / covers


def seed_rates():
    for month in range(1, 13):
        use = defaultdict(float)
        covers = 0
        for i in range(700):
            d = date(2025, month, 2) + timedelta(days=i % 25)
            if d.weekday() == 0:
                continue
            s = 'dinner' if i % 5 < 3 else 'lunch'
            size = party_size(s)
            covers += size
            for (k, _, _) in order(d, s, size):
                for (it, qty) in recipe_use(k):
                    use[it] += qty
        # what the bases take, per portion made
        for k, it in ITEMS.items():
            if it['kind'] == 'prep':
                for (ing, qty) in it['recipe']:
                    use[ing] += use[k] * qty / it['yieldQty']
        SEED_RATE[month] = {k: use[k] / covers * 1.05 for k in ITEMS}
    for k in ITEMS:
        RATE[k] = SEED_RATE[1][k]


def special(k, d):
    """What a one-night menu takes that no usual day does: the réveillon, for every cover of the 31st's dinner."""
    if d != date(2025, 12, 31) or 'dinner' not in PLAN.get(d, {}):
        return 0
    covers = PLAN[d]['dinner']['covers']
    use = sum(qty for (i, qty) in PRODUCTS['reveillon']['recipe'] if i == k) * covers
    for i, qty in PRODUCTS['reveillon']['recipe']:
        it = ITEMS[i]
        if it['kind'] == 'prep':
            use += sum(per for (ing, per) in it['recipe'] if ing == k) * qty * covers / it['yieldQty']
    return use


def forecast(k, d):
    seed = SEED_RATE[d.month].get(k, 0)
    learned = RATE.get(k)
    rate = seed if learned is None or seed == 0 else 0.5 * learned + 0.5 * seed
    if d == date(2025, 12, 31):
        # the dinner is the réveillon: the usual rate for the lunch only
        return PLAN[d].get('lunch', {}).get('covers', 0) * rate + special(k, d)
    return planned_covers(d) * rate


def ingredient_forecast(k, d):
    """An ingredient's use on a day, through the dishes and through the bases made from it."""
    f = forecast(k, d)
    return f


# ── Purchasing ───────────────────────────────────────────────────────

def is_trading(d):
    return service_open(d, 'lunch') or service_open(d, 'dinner')


def next_delivery(sup, d):
    for i in range(1, 15):
        x = d + timedelta(days=i)
        if x.weekday() in sup['days'] and (is_trading(x) or is_trading(x + timedelta(days=1))):
            return x
    return d + timedelta(days=14)


def buy(d):
    """This morning's deliveries: what each supplier brings, to last until it comes again."""
    opening = d in (date(2024, 12, 30), date(2024, 12, 31))
    t = 8 * 60 + 20
    for sup in C.SUPPLIERS:
        if opening:
            if (sup['station'] == 'bar' or sup['id'] in ('bl-sup-metro', 'bl-sup-cafe')) != (d == date(2024, 12, 30)):
                continue
        elif d.weekday() not in sup['days'] or not (is_trading(d) or is_trading(d + timedelta(days=1))):
            continue
        nxt = next_delivery(sup, d)
        # until the morning of the next delivery
        horizon = list(daterange(d, nxt - timedelta(days=1)))
        if opening:
            horizon = list(daterange(OPENING, nxt + timedelta(days=1)))
        lines = []
        for k, it in ITEMS.items():
            if it['kind'] != 'ingredient' or it['supplier'] != sup['id']:
                continue
            need = sum(ingredient_forecast(k, x) for x in horizon) * 1.18
            # the bases are made a whole batch at a time: room for one more than the forecast
            need += max((per for p in ITEMS.values() if p['kind'] == 'prep' for (i, per) in p['recipe'] if i == k), default=0)
            # a little more than that of what keeps; dry goods, cellar and bar for a week
            keeps = it['perish'] <= 0.01 and sup['id'] != 'bl-sup-boulangerie'
            if keeps:
                days_held = 4
                if sup['id'] == 'bl-sup-cave':
                    days_held = 24 if not opening else 5
                elif sup['station'] == 'bar' or sup['id'] == 'bl-sup-metro':
                    days_held = 14 if not opening else 6
                need = max(need, sum(ingredient_forecast(k, max(d, OPENING) + timedelta(days=i)) for i in range(days_held)))
            need -= STOCK[k]
            if need <= 0.25 * it['packSize'] and STOCK[k] > 0:
                continue
            packs = max(1, math.ceil(need / it['packSize']))
            price = pack_price(k, d)
            lines.append(dict(itemId=it['id'], packs=packs, packCostCents=price, packSize=it['packSize'], k=k))
        if not lines:
            continue
        stations = {ITEMS[l['k']]['station'] for l in lines}
        if stations == {'kitchen'}:
            who = someone(d, 'lunch', {'kitchen'}, 'karim')
        elif stations == {'bar'}:
            on = staff_on(d, 'dinner', {'bar'}) + staff_on(d, 'lunch', {'bar'})
            who = on[0] if on else STAFF['lea']
        else:
            who = STAFF['lea']
        po = uid('purchase', d, sup['id'])
        total = 0
        for l in lines:
            receive(l['k'], l['packs'] * l['packSize'], l['packs'] * l['packCostCents'])
            total += l['packs'] * l['packCostCents']
        MONTH[month_key(d)]['purchases'] += total
        MONTH[month_key(d)]['purchases_' + sup['station']] += total
        note = 'Stock d’ouverture' if opening else 'Livraison'
        sql_lines = [{k: v for k, v in l.items() if k != 'k'} for l in lines]
        emit(d, at(d, t), who['user'], f'select public.ops_record_purchase({q(po)}, {q(RID)}, {q(sup["id"])}, {q(d.isoformat())}, {jb(sql_lines)}, {q(note)});')
        emit(d, at(d, t), None, f'update public."purchaseOrders" set "station" = {q(sup["station"])} where "id" = {q(po)};')
        t += 12


# ── Bases made in the house, and what expires ────────────────────────

def produce(d):
    t = 9 * 60 + 50
    if not is_trading(d):
        return
    for k, it in ITEMS.items():
        if it['kind'] != 'prep':
            continue
        if k == 'p-soupe' and not product_active(PRODUCTS['soupe'], d):
            continue
        if k == 'p-gaspacho' and not product_active(PRODUCTS['gaspacho'], d):
            continue
        if k == 'p-veloute' and not product_active(PRODUCTS['veloute'], d):
            continue
        today = forecast(k, d)
        if today <= 0:
            continue
        usable = sum(qty for made, qty in PREP_LOTS[k] if (d - made).days < it['shelf'])
        if k == 'p-frites':
            qty = round(max(0, today * 1.12 - usable) / 100) * 100
        else:
            ahead = today + (forecast(k, d + timedelta(days=1)) if it['shelf'] > 1 else 0)
            if usable >= today * 1.15:
                continue
            batches = max(1, math.ceil((ahead * 1.1 - usable) / it['yieldQty']))
            qty = batches * it['yieldQty']
        if qty <= 0:
            continue
        who = someone(d, 'lunch', {'kitchen'}, 'karim') if service_open(d, 'lunch') else someone(d, 'dinner', {'kitchen'}, 'karim')
        for (ing, per) in it['recipe']:
            take(ing, per * qty / it['yieldQty'], d)
        add_prep(k, d, qty)
        batch = uid('batch', d, k)
        emit(d, at(d, t), who['user'], f'select public.ops_produce({q(it["id"])}, {qty}, {q("Production du jour")}, {q(batch)});')
        t += 7


def waste(d, k, qty, reason, minute, who):
    qty = round(qty, 1) if ITEMS[k]['unit'] != 'unit' else round(qty, 2)
    if qty <= 0:
        return
    take(k, qty, d, used=False)
    MONTH[month_key(d)]['waste'] += qty * unit_cost(k)
    emit(d, at(d, minute), who['user'], f'select public.ops_stock_adjust({q(ITEMS[k]["id"])}, {q("waste")}, {qty}, {q(reason)}, {q(uid("waste", d, k, reason, minute))});')


def end_of_day_waste(d):
    if not is_trading(d):
        return
    kitchen = someone(d, 'dinner' if service_open(d, 'dinner') else 'lunch', {'kitchen'}, 'karim')
    m = 23 * 60 + 5 if service_open(d, 'dinner') else 15 * 60 + 10
    # bases past their day: thrown away, the batch only — what went into them left the shelf when it was made
    for k, it in ITEMS.items():
        if it['kind'] != 'prep':
            continue
        expired = sum(qty for made, qty in PREP_LOTS[k] if qty > 0 and (d - made).days >= it['shelf'] - 1)
        if expired > 0:
            keep = [[made, qty] for made, qty in PREP_LOTS[k] if not (qty > 0 and (d - made).days >= it['shelf'] - 1)]
            if expired > 0:
                if k == 'p-frites':
                    reason = 'Frites taillées non utilisées'
                else:
                    reason = 'DLC dépassée'
                # the mirror drops the lots; the database takes the quantity off the base
                MONTH[month_key(d)]['waste'] += expired * unit_cost(k)
                PREP_LOTS[k] = keep
                emit(d, at(d, m), kitchen['user'], f'select public.ops_stock_adjust({q(it["id"])}, {q("waste")}, {round(expired, 2)}, {q(reason)}, {q(uid("expiry", d, k))});')
                m += 1
    # yesterday's bread
    if STOCK['pain'] > 2:
        waste(d, 'pain', math.floor(STOCK['pain'] * 0.7), 'Pain de la veille', m + 2, kitchen)
    # a steak sent back, a fish overcooked
    for (k, qty, p, reason) in (('entrecote', 300, 0.13, 'Erreur de cuisson'), ('daurade', 180, 0.05, 'Erreur de cuisson'),
                                ('hache', 180, 0.07, 'Retour client'), ('burrata', 1, 0.03, 'Produit abîmé')):
        if R.random() < p and STOCK[k] > qty:
            waste(d, k, qty, reason, m + 4, kitchen)
    bar = someone(d, 'dinner', {'bar'}, 'lea') if service_open(d, 'dinner') else STAFF['lea']
    if R.random() < 0.04 and STOCK['vin-rose'] > 750:
        waste(d, R.choice(['vin-rose', 'vin-rouge', 'bordeaux']), 750, 'Bouteille cassée', m + 6, bar)
    if R.random() < 0.05 and STOCK['rhum'] > 50:
        waste(d, 'rhum', 50, 'Cocktail renversé', m + 7, bar)


def weekly_waste(d):
    """Saturday night: what has wilted, gone soft or gone past its date; Tuesday morning, the beer lines."""
    if d.weekday() == 5 and is_trading(d):
        kitchen = someone(d, 'dinner', {'kitchen'}, 'karim')
        bar = someone(d, 'dinner', {'bar'}, 'lea')
        m = 23 * 60 + 15
        for k, it in ITEMS.items():
            if it['kind'] == 'ingredient' and it['perish'] > 0 and STOCK[k] > 0:
                qty = STOCK[k] * it['perish'] * R.uniform(0.6, 1.4)
                if qty >= (1 if it['unit'] == 'unit' else 20):
                    waste(d, k, qty if it['unit'] != 'unit' else math.floor(qty), 'Produit abîmé' if it['season'] else 'DLC dépassée', m, bar if it['station'] == 'bar' else kitchen)
                    m += 1
    if d.weekday() == 1 and is_trading(d) and STOCK['biere'] > 1500:
        waste(d, 'biere', 1500, 'Nettoyage des lignes de tirage', 10 * 60 + 40, STAFF['manon'] if employed(STAFF['manon'], d) else STAFF['lea'])
    # before the annual closure: what will not keep a fortnight
    if d == date(2025, 11, 9):
        m = 15 * 60 + 30
        for k, it in ITEMS.items():
            if it['kind'] == 'ingredient' and it['perish'] >= 0.03 and STOCK[k] > 0:
                waste(d, k, STOCK[k] if it['unit'] != 'unit' else math.floor(STOCK[k]), 'Fermeture annuelle', m, STAFF['manon'] if it['station'] == 'bar' else STAFF['karim'])
                m += 1


# ── Service: seating, ordering, paying ───────────────────────────────

def payments_for(d, s, due, size):
    """How a table pays: card mostly, cash, meal vouchers at lunch; sometimes split; a tip now and then."""
    lunch_week = s == 'lunch' and d.weekday() in (1, 2, 3, 4)
    method = w_pick([('card', 72 if lunch_week else 82), ('cash', 14 if lunch_week else 15), ('other', 14 if lunch_week else 3)])
    tip = 0
    if method == 'card':
        if size >= 2 and R.random() < 0.13:
            a = due // 2
            pays = [dict(method='card', amountCents=a), dict(method='card', amountCents=due - a)]
        else:
            pays = [dict(method='card', amountCents=due)]
        if R.random() < 0.27:
            tip = int(round(due * R.uniform(0.04, 0.1) / 50)) * 50
    elif method == 'cash':
        tendered = due if R.random() < 0.35 else int(math.ceil(due / 1000.0)) * 1000
        pays = [dict(method='cash', amountCents=tendered)]
        if R.random() < 0.35:
            tip = R.choice([50, 100, 100, 200, 200, 300, 500])
    else:
        vouchers = min(due, int(due * R.uniform(0.5, 1)) // 100 * 100)
        pays = [dict(method='other', amountCents=max(100, vouchers))]
        if due - pays[0]['amountCents'] > 0:
            pays.append(dict(method='card', amountCents=due - pays[0]['amountCents']))
    return pays, tip


def line_rows(d, oid, items, t, waiter, comp=False):
    rows = []
    sql = []
    for (k, seat, course) in items:
        p = PRODUCTS[k]
        price = 0 if comp else price_on(p, d)
        name = p['name'] + (' (offert)' if comp else '')
        lid = uid('line', oid, len(sql), k, t)
        rows.append(dict(k=k, total=price, vat=p['vat']))
        sql.append(f'({q(lid)}, {q(oid)}, {q(RID)}, {q(p["id"])}, {q(name)}, {q(CATEGORY_NAME[p["cat"]])}, {q(p["bill"])}, {q(p["station"])}, 1, {price}, {price}, {p["vat"]}, '
                   f'{q("Offert par la maison" if comp else "")}, {q("sent")}, {q("")}, {q(waiter["user"])}, {q(waiter["name"].split()[0])}, {q(seat)}, {course}, {t}, {t}, null, {t})')
    stmt = ('insert into public."posOrderLines" ("id", "orderId", "restaurantId", "productId", "name", "section", "category", "station", "qty", "unitCents", '
            '"totalCents", "vatRate", "note", "status", "voidReason", "staffId", "staffName", "seat", "course", "createdAt", "sentAt", "voidedAt", "updatedAt") values '
            + ', '.join(sql) + ';')
    return rows, stmt


def serve_party(d, s, p):
    waiter = someone(d, s, {'floor'}, 'lea')
    t0 = p['arrive']
    tb = p['table']
    oid = uid('order', d, s, tb[0], t0)
    g = p['guest']
    seat_ms = at(d, t0)
    emit(d, seat_ms, waiter['user'],
         f'insert into public."posOrders" ("id", "restaurantId", "tableId", "tableLabel", "joinedTableIds", "covers", "status", "openedBy", "openedByName", "openedAt", "guestId", "createdAt", "updatedAt") '
         f'values ({q(oid)}, {q(RID)}, {q(tb[0])}, {q(tb[1])}, {jb([t[0] for t in p["joined"]])}, {p["size"]}, {q("open")}, {q(waiter["user"])}, {q(waiter["name"].split()[0])}, {seat_ms}, {q(g["id"] if g else None)}, {seat_ms}, {seat_ms});')
    table_ids = [tb[0]] + [t[0] for t in p['joined']]
    if p['booking']:
        emit(d, seat_ms, waiter['user'], f'update public."reservations" set "status" = {q("seated")}, "tableIds" = {jb(table_ids)}, "posOrderId" = {q(oid)}, "seatedAt" = {seat_ms} where "id" = {q(p["booking"]["id"])};')
    else:
        rid = uid('walkin', oid)
        emit(d, seat_ms, waiter['user'],
             f'insert into public."reservations" ("id", "restaurantId", "guestId", "date", "time", "partySize", "tableIds", "status", "source", "name", "notifyGuest", "posOrderId", "seatedAt", "createdBy", "createdByName") '
             f'values ({q(rid)}, {q(RID)}, {q(g["id"] if g else None)}, {q(d.isoformat())}, {q(hm(t0))}, {p["size"]}, {jb(table_ids)}, {q("seated")}, {q("walk_in")}, {q(g["name"] if g else "")}, false, {q(oid)}, {seat_ms}, {q(waiter["user"])}, {q(waiter["name"].split()[0])});')
    if p['cancelled']:
        emit(d, at(d, t0 + 12), waiter['user'], f'select public.ops_cancel_order({q(oid)}, {q("Clients partis avant de commander")});')
        # the walk-in, if the app kept it, says what happened
        emit(d, at(d, t0 + 13), waiter['user'], f'update public."reservations" set "status" = {q("cancelled")}, "cancelReason" = {q("Partis avant de commander")}, "cancelledBy" = {q("staff")} where "id" = {q(uid("walkin", oid))};')
        emit(d, at(d, t0 + 14), None, f'update public."diningTables" set "dirtySince" = null where "id" in ({", ".join(q(x) for x in table_ids)});')
        return
    items = order(d, s, p['size'])
    if not any(x[2] < 3 for x in items):
        items.append((w_pick(mains_weights(d, s)), 1, 2))
    first = [x for x in items if x[2] < 3]
    later = [x for x in items if x[2] == 3]
    rows = []
    t1 = at(d, t0 + 6)
    r, sql = line_rows(d, oid, first, t1, waiter)
    rows += r
    emit(d, t1, waiter['user'], sql)
    if R.random() < 0.02:
        # a line taken off: typed by mistake, or a guest who changed their mind
        k = R.choice([x[0] for x in first])
        lid = uid('void', oid)
        reason = R.choice(['Erreur de saisie', 'Le client a changé d’avis', 'Plat refusé'])
        pr = PRODUCTS[k]
        emit(d, at(d, t0 + 9), waiter['user'],
             f'insert into public."posOrderLines" ("id", "orderId", "restaurantId", "productId", "name", "section", "category", "station", "qty", "unitCents", "totalCents", "vatRate", "status", "voidReason", "staffId", "staffName", "createdAt", "sentAt", "voidedAt", "updatedAt") '
             f'values ({q(lid)}, {q(oid)}, {q(RID)}, {q(pr["id"])}, {q(pr["name"])}, {q(CATEGORY_NAME[pr["cat"]])}, {q(pr["bill"])}, {q(pr["station"])}, 1, {price_on(pr, d)}, {price_on(pr, d)}, {pr["vat"]}, {q("void")}, {q(reason)}, {q(waiter["user"])}, {q(waiter["name"].split()[0])}, {at(d, t0 + 9)}, null, {at(d, t0 + 10)}, {at(d, t0 + 10)});')
    if later:
        t2 = at(d, t0 + p['dur'] - 25)
        r, sql = line_rows(d, oid, later, t2, waiter)
        rows += r
        emit(d, t2, waiter['user'], sql)
    if R.random() < 0.025:
        r, sql = line_rows(d, oid, [(R.choice(['cafe', 'mousse', 'limoncello']), None, 3)], at(d, t0 + p['dur'] - 20), waiter, comp=True)
        rows += r
        emit(d, at(d, t0 + p['dur'] - 20), waiter['user'], sql)
    due = sum(x['total'] for x in rows)
    pays, tip = payments_for(d, s, due, p['size'])
    pay_ms = at(d, t0 + p['dur'] - 4)
    emit(d, pay_ms, waiter['user'], f'select public.ops_pay_order({q(oid)}, {jb(pays)}, {tip});')
    emit(d, pay_ms + 5 * 60000, None, f'update public."diningTables" set "dirtySince" = null where "id" in ({", ".join(q(x) for x in table_ids)});')
    settle(d, s, rows, pays, tip, p['size'], g, p['booking'])


def serve_counter(d, s, c):
    # the bar pours, the floor takes the payment: only waiters and the manager use the till
    waiter = someone(d, s, {'floor'}, 'lea')
    oid = uid('counter', d, s, c['t'], R.random())
    t = at(d, c['t'])
    emit(d, t, waiter['user'], f'insert into public."posOrders" ("id", "restaurantId", "tableId", "tableLabel", "covers", "status", "openedBy", "openedByName", "openedAt", "createdAt", "updatedAt") '
         f'values ({q(oid)}, {q(RID)}, null, {q("")}, 1, {q("open")}, {q(waiter["user"])}, {q(waiter["name"].split()[0])}, {t}, {t}, {t});')
    rows, sql = line_rows(d, oid, order(d, s, 1, counter=True), t + 60000, waiter)
    emit(d, t + 60000, waiter['user'], sql)
    due = sum(x['total'] for x in rows)
    pays, tip = payments_for(d, 'dinner', due, 1)
    emit(d, t + 9 * 60000, waiter['user'], f'select public.ops_pay_order({q(oid)}, {jb(pays)}, {tip});')
    settle(d, s, rows, pays, tip, 0, None, None)


def settle(d, s, rows, pays, tip, covers, guest, booking):
    mk = month_key(d)
    for r in rows:
        for (k, qty) in recipe_use(r['k']):
            take(k, qty, d)
        MONTH[mk]['net'] += r['total'] / (1 + r['vat'] / 100)
        MONTH[mk]['net_' + PRODUCTS[r['k']]['station']] += r['total'] / (1 + r['vat'] / 100)
        MONTH[mk]['cost'] += sum(unit_cost(k) * qty for (k, qty) in recipe_use(r['k']))
    MONTH[mk]['covers'] += covers
    MONTH[mk]['tickets'] += 1
    MONTH[mk]['tips'] += tip
    TIPS[mk] += tip
    COVERS[d] += covers
    if booking and booking['source'] == 'website':
        WEB_COVERS[mk] += covers
    if guest:
        guest['visits'] += 1


# ── Bookings, as they were made ──────────────────────────────────────

def emit_bookings():
    for g in GUESTS:
        if g['first_ms'] is None:
            continue
        d = g['first_day']
        emit(d, g['first_ms'] - 60000, None,
             f'insert into public."guests" ("id", "restaurantId", "restaurants", "name", "email", "phone", "marketingOptIn", "allergies", "birthday", "locale", "source", "createdAt", "updatedAt") '
             f'values ({q(g["id"])}, {q(RID)}, {jb([RID])}, {q(g["name"])}, {q(g["email"])}, {q(g["phone"])}, {q(g["optin"])}, {q(g["allergies"])}, {q(g["birthday"])}, {q(g["locale"])}, {q("booking")}, {g["first_ms"] - 60000}, {g["first_ms"] - 60000});')
    for b in BOOKINGS:
        g = b['guest']
        made_ms = at(b['made'], b['made_t'])
        creator = None if b['source'] == 'website' else STAFF['lea'] if employed(STAFF['lea'], b['made']) else None
        emit(b['made'], made_ms, creator['user'] if creator else None,
             f'insert into public."reservations" ("id", "restaurantId", "guestId", "date", "time", "partySize", "status", "source", "name", "email", "phone", "notes", "occasion", "locale", "notifyGuest", "confirmedAt", "createdBy", "createdByName", "createdAt", "updatedAt") '
             f'values ({q(b["id"])}, {q(RID)}, {q(g["id"])}, {q(b["day"].isoformat())}, {q(hm(b["time"]))}, {b["size"]}, {q("confirmed")}, {q(b["source"])}, {q(g["name"])}, {q(g["email"])}, {q(g["phone"])}, {q(b["note"])}, {q(b["occasion"])}, {q(g["locale"])}, false, {made_ms}, '
             f'{q(creator["user"] if creator else None)}, {q(creator["name"].split()[0] if creator else "")}, {made_ms}, {made_ms});')
        if b['fate'] == 'cancelled':
            when = made_ms + int((at(b['day'], b['time']) - made_ms) * R.uniform(0.3, 0.95))
            dd = datetime.fromtimestamp(when / 1000, TZ).date()
            emit(dd, when, None, f'update public."reservations" set "status" = {q("cancelled")}, "cancelReason" = {q(R.choice(["Empêchement", "Changement de programme", "Malade", ""]))}, "cancelledBy" = {q("guest")}, "cancelledAt" = {when} where "id" = {q(b["id"])};')
        elif b['fate'] == 'no_show':
            when = at(b['day'], b['time'] + 30)
            emit(b['day'], when, STAFF['lea']['user'], f'update public."reservations" set "status" = {q("no_show")} where "id" = {q(b["id"])};')


# ── The month's end: the count, the payroll, the bills ───────────────

def monthly_count(d):
    """The last evening of the month: everything counted — the shelf says one thing, the count another."""
    counts = []
    for k, it in ITEMS.items():
        have = onhand(k)
        if have <= 0:
            continue
        if it['kind'] == 'prep':
            bias, noise = 0, 0.05
        elif k in ('biere',):
            bias, noise = -0.025, 0.01
        elif it['station'] == 'bar' and it['unit'] == 'ml':
            bias, noise = -0.012, 0.01
        elif it['season'] == 'produce' or it['perish'] >= 0.03:
            bias, noise = -0.012, 0.03
        else:
            bias, noise = 0, 0.006
        counted = max(0, have * (1 + bias + R.gauss(0, noise)))
        counted = round(counted) if it['unit'] == 'unit' else round(counted, 0)
        if abs(counted - have) < 1e-6:
            continue
        MONTH[month_key(d)]['shrink'] += (have - counted) * unit_cost(k)
        if it['kind'] == 'prep':
            scale = counted / have if have else 0
            PREP_LOTS[k] = [[m, qty * scale] for m, qty in PREP_LOTS[k]]
        else:
            STOCK[k] = counted
        counts.append(dict(itemId=it['id'], qty=counted))
    emit(d, at(d, 23 * 60 + 40), STAFF['lea']['user'], f'select public.ops_count_stock({q(RID)}, {jb(counts)}, {q("Inventaire mensuel")});')


def payroll(d):
    """The month's pay, recorded on its last day: the contract's hours (or the hours worked), overtime week by week at +25 %."""
    first = date(d.year, d.month, 1)
    mk = month_key(d)
    gross_total, charges = 0, 0
    floor_minutes = {}
    rows = []
    for st in STAFF.values():
        if not any(employed(st, x) for x in daterange(first, d)):
            continue
        punches = [p for p in PUNCHES[st['key']] if first <= p[0] <= d]
        worked = sum((b - a) / 60000 - brk for (_, a, b, brk) in punches)
        weeks = defaultdict(float)
        for (day, a, b, brk) in punches:
            weeks[day - timedelta(days=day.weekday())] += (b - a) / 60000 - brk
        limit = st['hours'] * 60 if st['hours'] else 1e9
        overtime = sum(max(0, m - limit) for m in weeks.values())
        if st['monthly']:
            days_in = sum(1 for x in daterange(first, d) if employed(st, x))
            base = st['hours'] * 52 / 12 * st['rate'] * days_in / ((d - first).days + 1)
            gross = round(base + overtime / 60 * st['rate'] * 1.25)
        else:
            gross = round(worked / 60 * st['rate'])
        if gross <= 0:
            continue
        rows.append([st, worked, overtime, gross])
        if st['team'] == 'floor':
            floor_minutes[st['key']] = worked
        gross_total += gross
        charges += gross * (0.27 if st['contract'] in ('permanent', 'fixed') else 0.3)
    tips = TIPS[mk]
    total_minutes = sum(floor_minutes.values()) or 1
    paid_ms = at(d, 23 * 60 + 50)
    for st, worked, overtime, gross in rows:
        tip = int(tips * floor_minutes.get(st['key'], 0) / total_minutes)
        emit(d, paid_ms, STAFF['lea']['user'],
             f'insert into public."staffPayouts" ("id", "restaurantId", "staffId", "fromDate", "toDate", "workedMinutes", "overtimeMinutes", "grossCents", "tipsCents", "paidOn", "note", "createdAt", "updatedAt") '
             f'values ({q(uid("payout", st["key"], mk))}, {q(RID)}, {q(st["id"])}, {q(first.isoformat())}, {q(d.isoformat())}, {round(worked)}, {round(overtime)}, {gross}, {tip}, {q(d.isoformat())}, {q("Virement des salaires")}, {paid_ms}, {paid_ms});')
    MONTH[mk]['wages'] = gross_total
    MONTH[mk]['charges'] = round(charges)
    nxt = d + timedelta(days=15)
    entry(d, 'social', f'Charges sociales (URSSAF, retraite, prévoyance) — {month_fr(d)}', 'URSSAF Provence-Alpes-Côte d’Azur', round(charges), 0,
          nxt if nxt <= END else None, method='direct-debit', minute=23 * 60 + 55)


ENTRY_N = [0]


def entry(d, category, label, payee, cents, vat, paid_on, method='transfer', repeat='none', until='', lot=None, minute=11 * 60, reference=''):
    """A line of the books, typed in on its day (paid later, or never in the period: owed at its end)."""
    ENTRY_N[0] += 1
    t = at(d, minute)
    MONTH[month_key(d)]['entry_' + category] += cents
    emit(d, t, None,
         f'insert into public."financeEntries" ("id", "restaurantId", "category", "label", "payee", "amountCents", "vatRate", "date", "paidOn", "method", "repeat", "repeatUntil", "assetLotId", "reference", "notes", "createdAt", "updatedAt") '
         f'values ({q(uid("entry", ENTRY_N[0]))}, {q(RID)}, {q(category)}, {q(label)}, {q(payee)}, {int(cents)}, {vat}, {q(d.isoformat())}, {q(paid_on.isoformat() if paid_on else "")}, {q(method)}, {q(repeat)}, {q(until)}, {q(lot)}, {q(reference)}, {q("")}, {t}, {t});')


def month_bills(d):
    """What the month brings in invoices that depend on how busy it was: linen, cleaning, bookings, energy."""
    mk = month_key(d)
    covers = MONTH[mk]['covers']
    nxt5 = d + timedelta(days=5)
    nxt10 = d + timedelta(days=10)
    if covers:
        entry(d, 'laundry', f'Linge de table — {month_fr(d)}', 'Blanchisserie Riviera', round(covers * 34), 20, nxt5 if nxt5 <= END else None, 'direct-debit', minute=18 * 60)
        entry(d, 'cleaning', f'Produits d’entretien — {month_fr(d)}', 'Hygiène Sud', round(9000 + covers * 4), 20, nxt5 if nxt5 <= END else None, minute=18 * 60 + 1)
    if WEB_COVERS[mk]:
        entry(d, 'platforms', f'Commission réservations en ligne — {month_fr(d)}', 'Plateforme de réservation', WEB_COVERS[mk] * 150, 20, nxt10 if nxt10 <= END else None, 'direct-debit', minute=18 * 60 + 2)
    energy = {12: 12000, 1: 82000, 2: 79000, 3: 71000, 4: 63000, 5: 60000, 6: 76000, 7: 93000, 8: 97000, 9: 79000, 10: 68000, 11: 47000}
    if d.year == 2025 and d.month == 12:
        energy[12] = 78000
    entry(d, 'utilities', f'Électricité et gaz — {month_fr(d)}', 'EDF Entreprises', energy[d.month], 20, nxt10 if nxt10 <= END else None, 'direct-debit', minute=18 * 60 + 3)
    if d.month in (3, 6, 9, 12) and d.year == 2025:
        entry(d, 'utilities', f'Eau — trimestre clos fin {FR_MONTHS[d.month - 1]}', 'Eau d’Azur', {3: 17800, 6: 21500, 9: 26400, 12: 19200}[d.month], 5.5,
              d + timedelta(days=15) if d + timedelta(days=15) <= END else None, minute=18 * 60 + 4)


def fixed_entries():
    """What does not depend on trade: the owner's money, the lease, the setting up, the subscriptions."""
    entry(date(2024, 12, 1), 'capital', 'Apport en capital — Camille Arnaud (associée unique)', 'Camille Arnaud', 5_000_000, 0, date(2024, 12, 1), minute=9 * 60 + 30)
    entry(date(2024, 12, 2), 'drawings', 'Dépôt de garantie — bail commercial (2 mois de loyer)', 'SCI Port Lympia', 720_000, 0, date(2024, 12, 2), minute=10 * 60)
    # the lease grants three months rent-free (franchise de loyer) while the place is fitted out and opens
    entry(date(2025, 3, 1), 'rent', 'Loyer du local commercial', 'SCI Port Lympia', 360_000, 20, date(2025, 3, 3), repeat='monthly', minute=10 * 60 + 5)
    entry(date(2024, 12, 3), 'fees', 'Création de la société (statuts, immatriculation)', 'Cabinet Juridique Azur', 90_000, 20, date(2024, 12, 3))
    entry(date(2024, 12, 5), 'licences', 'Permis d’exploitation et déclaration de licence restaurant', 'Formation CHR Nice', 65_000, 20, date(2024, 12, 5))
    entry(date(2024, 12, 6), 'insurance', 'Assurance multirisque professionnelle', 'Mutuelle des Commerçants', 15_800, 0, date(2024, 12, 6), 'direct-debit', repeat='monthly')
    entry(date(2024, 12, 12), 'fees', 'Expert-comptable — mission de création', 'Cabinet Morel & Associés', 60_000, 20, date(2024, 12, 20))
    entry(date(2025, 1, 31), 'fees', 'Expert-comptable — honoraires mensuels', 'Cabinet Morel & Associés', 18_000, 20, date(2025, 2, 5), repeat='monthly')
    entry(date(2024, 12, 9), 'marketing', 'Logo et identité visuelle', 'Studio Lumen', 45_000, 20, date(2025, 1, 10))
    entry(date(2024, 12, 16), 'utilities', 'Mise en service des compteurs', 'EDF Entreprises', 9_500, 20, date(2024, 12, 16), 'card')
    entry(date(2024, 12, 20), 'cleaning', 'Nettoyage de remise en état du local', 'Hygiène Sud', 38_000, 20, date(2024, 12, 23))
    entry(date(2024, 12, 18), 'staff', 'Tenues de travail (vestes, tabliers)', 'Tenues Pro Côte d’Azur', 42_000, 20, date(2024, 12, 18), 'card')
    entry(date(2024, 12, 15), 'telecom', 'Box internet et ligne fixe', 'Opérateur télécom', 3_900, 20, date(2024, 12, 15), 'direct-debit', repeat='monthly')
    entry(date(2024, 12, 31), 'bank', 'Frais de tenue de compte', 'Banque Populaire Côte d’Azur', 1_800, 0, date(2024, 12, 31), 'direct-debit', repeat='monthly')
    entry(date(2025, 1, 1), 'software', 'Logiciel de caisse et de gestion', 'Mise', 4_900, 20, date(2025, 1, 1), 'card', repeat='monthly')
    entry(date(2025, 1, 1), 'other', 'Location de la machine à café (prêt torréfacteur)', 'Torréfaction du Vieux-Nice', 7_900, 20, date(2025, 1, 1), 'direct-debit', repeat='monthly')
    entry(date(2025, 1, 2), 'waste', 'Collecte des déchets et biodéchets', 'Collecte Azur', 9_500, 10, date(2025, 1, 10), 'direct-debit', repeat='monthly')
    entry(date(2025, 1, 3), 'marketing', 'Flyers et soirée d’ouverture', 'Imprimerie du Port', 35_000, 20, date(2025, 1, 3), 'card')
    entry(date(2025, 1, 15), 'licences', 'SACEM — diffusion de musique', 'SACEM', 48_000, 20, date(2025, 1, 20))
    entry(date(2025, 1, 20), 'staff', 'Formation hygiène alimentaire (HACCP)', 'Formation CHR Nice', 29_000, 20, date(2025, 1, 20))
    entry(date(2025, 3, 3), 'staff', 'Médecine du travail', 'Service de santé au travail', 12_000, 0, date(2025, 3, 10), repeat='yearly')
    entry(date(2025, 3, 1), 'marketing', 'Publicité sur les réseaux sociaux', 'Meta', 15_000, 20, date(2025, 3, 1), 'card', repeat='monthly', until='2025-05-31')
    entry(date(2025, 6, 1), 'marketing', 'Publicité sur les réseaux sociaux — été', 'Meta', 30_000, 20, date(2025, 6, 1), 'card', repeat='monthly', until='2025-08-31')
    entry(date(2025, 9, 1), 'marketing', 'Publicité sur les réseaux sociaux', 'Meta', 15_000, 20, date(2025, 9, 1), 'card', repeat='monthly')
    entry(date(2025, 3, 14), 'maintenance', 'Nettoyage de la hotte et des conduits', 'Ventil’Azur', 42_000, 20, date(2025, 3, 28))
    entry(date(2025, 9, 15), 'maintenance', 'Nettoyage de la hotte et des conduits', 'Ventil’Azur', 42_000, 20, date(2025, 9, 30))
    entry(date(2025, 6, 10), 'maintenance', 'Révision du four mixte', 'Rational France', 18_000, 20, date(2025, 6, 10), 'card', lot=uid('lot', 'bl-m-combi', 0))
    entry(date(2025, 7, 22), 'maintenance', 'Réparation du lave-vaisselle — pompe de rinçage', 'Hobart SAV', 38_000, 20, date(2025, 8, 5), lot=uid('lot', 'bl-m-plonge', 0))
    entry(date(2025, 11, 5), 'maintenance', 'Piano — remplacement d’un thermocouple', 'Cuisines Pro Occasion', 21_000, 20, date(2025, 11, 5), 'card', lot=uid('lot', 'bl-m-piano', 0))
    entry(date(2025, 12, 9), 'maintenance', 'Révision du four mixte', 'Rational France', 18_000, 20, None, lot=uid('lot', 'bl-m-combi', 0))
    for d, cents in ((date(2025, 3, 20), 16_000), (date(2025, 6, 18), 21_000), (date(2025, 9, 19), 19_000), (date(2025, 12, 12), 14_000)):
        entry(d, 'smallwares', 'Remplacement de vaisselle et de verres cassés', 'Metro Nice Saint-Isidore', cents, 20, d, 'card')
    entry(date(2025, 12, 15), 'taxes', 'CFE 2025 (réduite de moitié la première année)', 'Impôts — SIE Nice', 31_000, 0, date(2025, 12, 15))


# ── Setup: the company, its people, its stock, its menu, its rooms ───

def setup():
    t = at(START, 9 * 60)
    emit(START, t, None, f'insert into public."organizations" ("id", "name", "notes", "createdAt", "updatedAt") values ({q(C.ORG)}, {q(C.ORG_NAME)}, '
         f'{q("SAS Lumière Restauration, au capital de 50 000 € — associée unique : Camille Arnaud (100 % des parts), présidente. Immatriculée en décembre 2024. Données fictives.")}, {t}, {t});')
    emit(START, t, None,
         f'insert into public."restaurants" ("id", "organizationId", "name", "slug", "hue", "address", "phone", "email", "hours", "cuisine", "shortDescription", "manager", "notes", "createdAt", "updatedAt") '
         f'values ({q(RID)}, {q(C.ORG)}, {q("Bistrot Lumière")}, {q("bistrot-lumiere")}, 32, {q("8 rue de la Lumière, 06300 Nice")}, {q("04 99 00 12 34")}, {q("bonjour@bistrot-lumiere.example")}, '
         f'{q("Du mardi au samedi, midi et soir ; le dimanche midi")}, {q("Bistrot niçois")}, {q("Cuisine de bistrot et classiques niçois, près du port.")}, {q("Léa Fontaine")}, {q("Ouverture le 1er janvier 2025.")}, {t}, {t});')
    # the owner: the organisation's admin
    emit(START, t, None, f'insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at) values ({q(OWNER_ID)}, {q(C.OWNER["email"])}, '
         f'{jb({"mise_role": "admin", "mise_org": C.ORG})}, {jb({"full_name": C.OWNER["name"]})}, to_timestamp({t} / 1000.0), to_timestamp({t} / 1000.0));')
    # the team, as they are hired: an account for those who use the dashboard
    for st in STAFF.values():
        hired = max(START, st['start_d'] - timedelta(days=4))
        ht = at(hired, 10 * 60)
        # the team record first; the account, made a moment later, is linked to it by its email (025)
        emit(hired, ht, None,
             f'insert into public."staffMembers" ("id", "restaurantId", "profileId", "name", "email", "phone", "team", "jobTitle", "contract", "weeklyHours", "hourlyCents", "startDate", "endDate", "active", "createdAt", "updatedAt") '
             f'values ({q(st["id"])}, {q(RID)}, null, {q(st["name"])}, {q(st["email"])}, {q("")}, {q(st["team"])}, {q(st["job"])}, {q(st["contract"])}, {st["hours"]}, {st["rate"]}, '
             f'{q(st["start"])}, {q(st.get("end", ""))}, true, {ht}, {ht});')
        if st['user']:
            emit(hired, ht + 1000, None, f'insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at) values ({q(st["user"])}, {q(st["email"])}, '
                 f'{jb({"mise_role": st["role"], "mise_restaurant": RID})}, {jb({"full_name": st["name"]})}, to_timestamp({ht + 1000} / 1000.0), to_timestamp({ht + 1000} / 1000.0));')
        if st['end_d']:
            emit(st['end_d'], at(st['end_d'], 23 * 60 + 58), None, f'update public."staffMembers" set "active" = false, "updatedAt" = {at(st["end_d"], 23 * 60 + 58)} where "id" = {q(st["id"])};')
    t2 = at(START, 9 * 60 + 5)
    emit(START, t2, None, f'insert into public."hrSettings" ("id", "restaurantId", "overtimePremium", "roundMinutes", "tipsShare", "createdAt", "updatedAt") values ({q(uid("hr"))}, {q(RID)}, 25, 0, {q("floor")}, {t2}, {t2});')
    emit(START, t2, None, f'insert into public."financeSettings" ("id", "restaurantId", "openingCashCents", "openingMonth", "employerChargesPercent", "cardFeePercent", "taxPercent", "foodVatRate", "drinkVatRate", "createdAt", "updatedAt") '
         f'values ({q(uid("finance"))}, {q(RID)}, 0, {q("2024-12")}, 27, 0.9, 25, 5.5, 20, {t2}, {t2});')
    services = [dict(id='dejeuner', name={'fr': 'Déjeuner', 'en': 'Lunch'}, days=[0, 2, 3, 4, 5, 6], **{'from': '12:00'}, to='13:45', intervalMinutes=15, maxCoversPerSlot=0, maxCovers=0, online=True),
                dict(id='diner', name={'fr': 'Dîner', 'en': 'Dinner'}, days=[2, 3, 4, 5, 6], **{'from': '19:00'}, to='21:45', intervalMinutes=15, maxCoversPerSlot=0, maxCovers=0, online=True)]
    emit(START, t2, None, f'insert into public."reservationSettings" ("id", "restaurantId", "timeZone", "services", "durations", "createdAt", "updatedAt") values ({q(uid("bookings"))}, {q(RID)}, {q("Europe/Paris")}, '
         f'{jb(services)}, {jb([{"upTo": 2, "minutes": 90}, {"upTo": 4, "minutes": 105}, {"upTo": 500, "minutes": 120}])}, {t2}, {t2});')
    # suppliers
    t3 = at(date(2024, 12, 10), 15 * 60)
    for s in C.SUPPLIERS:
        emit(date(2024, 12, 10), t3, None, f'insert into public."suppliers" ("id", "restaurantId", "name", "contactName", "email", "phone", "address", "paymentTerms", "deliveryDays", "leadDays", "notes", "active", "createdAt", "updatedAt") '
             f'values ({q(s["id"])}, {q(RID)}, {q(s["name"])}, {q(s["contact"])}, {q("commandes@" + ascii_slug(s["name"]).replace(" ", "")[:20] + ".example")}, {q("")}, {q("Nice")}, {q(s["terms"])}, '
             f'{jb([(x + 1) % 7 for x in s["days"]])}, {s["lead"]}, {q("")}, true, {t3}, {t3});')
    # the stock: ingredients first, then the bases made of them — nothing on the shelves yet
    t4 = at(date(2024, 12, 18), 14 * 60)
    for k, it in ITEMS.items():
        per_day = RATE.get(k, 0) * 70
        if it['kind'] == 'ingredient':
            mn = round(per_day * (2 if it['perish'] > 0.01 else 4), 0)
            par = round(per_day * (4 if it['perish'] > 0.01 else 10), 0)
            emit(date(2024, 12, 18), t4, None,
                 f'insert into public."stockItems" ("id", "restaurantId", "name", "kind", "station", "unit", "onHand", "minQty", "parQty", "supplierId", "packSize", "packLabel", "packCostCents", "allergens", "yieldQty", "recipe", "active", "createdAt", "updatedAt") '
                 f'values ({q(it["id"])}, {q(RID)}, {q(it["name"])}, {q("ingredient")}, {q(it["station"])}, {q(it["unit"])}, 0, {mn}, {par}, {q(it["supplier"])}, {it["packSize"]}, {q(it["packLabel"])}, {it["cost"]}, {jb(it["allergens"])}, 0, {jb([])}, true, {t4}, {t4});')
    for k, it in ITEMS.items():
        if it['kind'] == 'prep':
            per_day = RATE.get(k, 0) * 70
            emit(date(2024, 12, 18), t4 + 1000, None,
                 f'insert into public."stockItems" ("id", "restaurantId", "name", "kind", "station", "unit", "onHand", "minQty", "parQty", "packSize", "packCostCents", "yieldQty", "recipe", "sheet", "active", "createdAt", "updatedAt") '
                 f'values ({q(it["id"])}, {q(RID)}, {q(it["name"])}, {q("prep")}, {q(it["station"])}, {q(it["unit"])}, 0, {round(per_day, 0)}, {round(per_day * 2, 0)}, 0, 0, {it["yieldQty"]}, '
                 f'{jb([dict(itemId=ITEMS[i]["id"], qty=qq) for i, qq in it["recipe"]])}, {jb(dict(portion="", method="", allergens=[], notes="Se garde %s jour(s) au froid." % it["shelf"], photo=None, prepMinutes=None))}, true, {t4}, {t4});')
    # the menu's tree and its dishes
    t5 = at(date(2024, 12, 20), 16 * 60)
    for (cid, parent, name, sort) in C.MENU_CATEGORIES:
        emit(date(2024, 12, 20), t5, None, f'insert into public."menuCategories" ("id", "restaurantId", "parentId", "name", "sort", "createdAt", "updatedAt") values ({q("bl-" + cid)}, {q(RID)}, {q("bl-" + parent if parent else None)}, {jb(name)}, {sort}, {t5}, {t5});')
    for i, (k, p) in enumerate(PRODUCTS.items()):
        emit(date(2024, 12, 20), t5 + 1000, None,
             f'insert into public."menuProducts" ("id", "restaurantId", "name", "section", "category", "station", "priceCents", "vatRate", "active", "sort", "recipe", "sheet", "categoryId", "createdAt", "updatedAt") '
             f'values ({q(p["id"])}, {q(RID)}, {q(p["name"])}, {q(CATEGORY_NAME[p["cat"]])}, {q(p["bill"])}, {q(p["station"])}, {p["price"]}, {p["vat"]}, {q(product_active(p, OPENING))}, {i}, '
             f'{jb([dict(itemId=ITEMS[x]["id"], qty=qq) for x, qq in p["recipe"]])}, {jb(dict(portion="", method="", allergens=[], notes="", photo=None, prepMinutes=p["prep"]))}, {q("bl-" + p["cat"])}, {t5}, {t5});')
    # the menu changes with the seasons, and the mains go up in September
    for d in [date(2025, m, 1) for m in range(2, 13)] + [date(2025, 12, 31), date(2025, 12, 30)]:
        for k, p in PRODUCTS.items():
            was, now = product_active(p, d - timedelta(days=1)), product_active(p, d)
            if was != now:
                emit(d, at(d, 8 * 60), STAFF['lea']['user'], f'update public."menuProducts" set "active" = {q(now)}, "updatedAt" = {at(d, 8 * 60)} where "id" = {q(p["id"])};')
    for k, p in PRODUCTS.items():
        if price_on(p, date(2025, 9, 1)) != p['price']:
            emit(date(2025, 9, 1), at(date(2025, 9, 1), 8 * 60 + 5), STAFF['lea']['user'], f'update public."menuProducts" set "priceCents" = {price_on(p, date(2025, 9, 1))}, "updatedAt" = {at(date(2025, 9, 1), 8 * 60 + 5)} where "id" = {q(p["id"])};')
    # furniture and equipment, as it was bought; the rooms and their tables, each table saying what it is
    model_t = {}
    for (mid, zone, cat, name, brand, ref, w, dd, h, seats, shape, price, life) in C.MODELS:
        first = min(date.fromisoformat(l[2]) for l in C.LOTS if l[0] == mid)
        mt = at(first, 9 * 60)
        model_t[mid] = mt
        emit(first, mt, None, f'insert into public."assetModels" ("id", "restaurantId", "zone", "category", "name", "brand", "reference", "widthCm", "depthCm", "heightCm", "seats", "shape", "priceCents", "supplier", "lifeYears", "specs", "createdAt", "updatedAt") '
             f'values ({q(mid)}, {q(RID)}, {q(zone)}, {q(cat)}, {q(name)}, {q(brand)}, {q(ref)}, {q(w)}, {q(dd)}, {q(h)}, {q(seats)}, {q(shape)}, {price}, {q(brand)}, {life}, {jb([])}, {mt}, {mt});')
    seen = defaultdict(int)
    for (mid, qty, on, cost, sup, inv, serial, warranty, service) in C.LOTS:
        n = seen[mid]
        seen[mid] += 1
        d = date.fromisoformat(on)
        lt = at(d, 9 * 60 + 1)
        emit(d, lt, None, f'insert into public."assetLots" ("id", "restaurantId", "modelId", "qty", "purchasedOn", "unitCostCents", "vatRate", "supplier", "invoiceRef", "serial", "condition", "location", "warrantyUntil", "nextServiceOn", "createdAt", "updatedAt") '
             f'values ({q(uid("lot", mid, n))}, {q(RID)}, {q(mid)}, {qty}, {q(on)}, {cost}, {10 if mid == "bl-m-olivier" else 20}, {q(sup)}, {q(inv)}, {q(serial)}, {q("new")}, {q("")}, {q(warranty)}, {q(service)}, {lt}, {lt});')
        MONTH[month_key(d)]['assets'] += qty * cost
    # two chairs broken in June: gone, and replaced; the services the machines had
    d = date(2025, 6, 20)
    emit(d, at(d, 16 * 60), STAFF['lea']['user'], f'update public."assetLots" set "qty" = 38, "updatedAt" = {at(d, 16 * 60)} where "id" = {q(uid("lot", "bl-m-chaise", 0))};')
    emit(d, at(d, 16 * 60), None, f'insert into public."assetLots" ("id", "restaurantId", "modelId", "qty", "purchasedOn", "unitCostCents", "vatRate", "supplier", "invoiceRef", "condition", "disposedOn", "disposalCents", "disposalNote", "createdAt", "updatedAt") '
         f'values ({q(uid("lot", "bl-m-chaise", "gone"))}, {q(RID)}, {q("bl-m-chaise")}, 2, {q("2024-12-16")}, 5800, 20, {q("Atelier Riviera")}, {q("AR-1092")}, {q("broken")}, {q("2025-06-20")}, 0, {q("Cassées en service, jetées")}, {at(d, 16 * 60)}, {at(d, 16 * 60)});')
    d = date(2025, 6, 27)
    emit(d, at(d, 10 * 60), None, f'insert into public."assetLots" ("id", "restaurantId", "modelId", "qty", "purchasedOn", "unitCostCents", "vatRate", "supplier", "invoiceRef", "condition", "createdAt", "updatedAt") '
         f'values ({q(uid("lot", "bl-m-chaise", "again"))}, {q(RID)}, {q("bl-m-chaise")}, 2, {q("2025-06-27")}, 6100, 20, {q("Atelier Riviera")}, {q("AR-1377")}, {q("new")}, {at(d, 10 * 60)}, {at(d, 10 * 60)});')
    MONTH[month_key(d)]['assets'] += 2 * 6100
    for (lot, done, nxt) in ((uid('lot', 'bl-m-combi', 0), '2025-06-10', '2025-12-09'), (uid('lot', 'bl-m-combi', 0), '2025-12-09', '2026-06-09'),
                             (uid('lot', 'bl-m-plonge', 0), '2025-07-22', ''), (uid('lot', 'bl-m-glacons', 0), '2025-11-03', '2026-05-03')):
        d = date.fromisoformat(done)
        emit(d, at(d, 17 * 60), None, f'update public."assetLots" set "lastServiceOn" = {q(done)}, "nextServiceOn" = {q(nxt)}, "condition" = {q("good")}, "updatedAt" = {at(d, 17 * 60)} where "id" = {q(lot)};')
    d = date(2025, 7, 18)
    emit(d, at(d, 23 * 60), STAFF['lea']['user'], f'update public."assetLots" set "condition" = {q("repair")}, "notes" = {q("Pompe de rinçage bruyante, fuite légère")}, "updatedAt" = {at(d, 23 * 60)} where "id" = {q(uid("lot", "bl-m-plonge", 0))};')
    for area in C.AREAS:
        d = date.fromisoformat(area['opened'])
        at_ = at(d, 11 * 60)
        fx = [{k: v for k, v in f.items() if k != 'modelId'} for f in C.FIXTURES[area['id']]]
        emit(d, at_, None, f'insert into public."diningAreas" ("id", "restaurantId", "name", "sort", "width", "height", "fixtures", "mapX", "mapY", "elevation", "createdAt", "updatedAt") '
             f'values ({q(area["id"])}, {q(RID)}, {q(area["name"])}, {0 if area["id"] == "bl-a-salle" else 1}, {area["width"]}, {area["height"]}, {jb(fx)}, {0 if area["id"] == "bl-a-salle" else 0}, {0 if area["id"] == "bl-a-salle" else 15}, {0 if area["id"] == "bl-a-salle" else -1}, {at_}, {at_});')
        for (tid, label, aid, seats, shape, x, y, w, h, model, chair) in C.TABLES:
            if aid != area['id']:
                continue
            emit(d, at_ + 1000, None, f'insert into public."diningTables" ("id", "restaurantId", "areaId", "label", "seats", "shape", "x", "y", "w", "h", "active", "createdAt", "updatedAt") '
                 f'values ({q(tid)}, {q(RID)}, {q(aid)}, {q(label)}, {seats}, {q(shape)}, {x}, {y}, {w}, {h}, true, {at_}, {at_});')
    # once the furniture is in, the plan says which table and which chairs each table is, and what the plant is
    for (tid, label, aid, seats, shape, x, y, w, h, model, chair) in C.TABLES:
        d = max(date.fromisoformat(next(a['opened'] for a in C.AREAS if a['id'] == aid)), date.fromisoformat(next(l[2] for l in C.LOTS if l[0] == model)))
        emit(d, at(d, 18 * 60), STAFF['lea']['user'], f'update public."diningTables" set "modelId" = {q(model)}, "chairModelId" = {q(chair)}, "updatedAt" = {at(d, 18 * 60)} where "id" = {q(tid)};')
    d = date(2024, 12, 20)
    emit(d, at(d, 18 * 60), STAFF['lea']['user'], f'update public."diningAreas" set "fixtures" = {jb([{k: v for k, v in f.items() if v is not None} for f in C.FIXTURES["bl-a-salle"]])}, "updatedAt" = {at(d, 18 * 60)} where "id" = {q("bl-a-salle")};')


# ── The year, day by day ─────────────────────────────────────────────

def live():
    for d in daterange(START, END):
        if d.weekday() == 0 and d >= date(2024, 12, 16):
            plan_week(d)
        if d == date(2024, 12, 16):
            pass
        if d.day == 1 or d == START:
            learn_rates(d)
        if d.weekday() == 1:
            weekly_waste(d)
        buy(d)
        produce(d)
        day = PLAN.get(d, {})
        events = []
        for s in ('lunch', 'dinner'):
            if s not in day:
                continue
            for p in day[s]['parties']:
                events.append((p['arrive'], 0, s, p))
            for c in day[s]['counter']:
                events.append((c['t'], 1, s, c))
        for (_, kind, s, x) in sorted(events, key=lambda e: (e[0], e[1])):
            if kind == 0:
                serve_party(d, s, x)
            else:
                serve_counter(d, s, x)
        end_of_day_waste(d)
        if d.weekday() == 5:
            weekly_waste(d)
        if d == date(2025, 11, 9):
            weekly_waste(d)
        punch(d)
        last_open = max((x for x in daterange(date(d.year, d.month, 1), last_day(d)) if is_trading(x)), default=None)
        if d == last_open and d >= OPENING:
            monthly_count(d)
        if d == last_day(d):
            payroll(d)
            month_bills(d)


def write():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, '00-clock.sql'), 'w') as f:
        f.write("""-- The seed's clock, for a TEST database only: public.mise_now() reads the session setting mise.clock when it is set.
create or replace function public.mise_now() returns bigint
language sql volatile set search_path = '' as $$
  select coalesce(nullif(current_setting('mise.clock', true), '')::bigint, (extract(epoch from clock_timestamp()) * 1000)::bigint)
$$;
""")
    with open(os.path.join(OUT, '99-restore-clock.sql'), 'w') as f:
        f.write("""-- Put the clock back as 010_roles_loyalty.sql has it.
create or replace function public.mise_now() returns bigint
language sql volatile set search_path = '' as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;
-- the seed's tables are left as a manager would find them: cleared
update public."diningTables" set "dirtySince" = null where "restaurantId" = 'bistrot-lumiere';
-- a loyalty bill's visit day is the real day it was paid on, not the fake clock's: put it on the clock's
update public."loyaltyBills" set "visitDay" = (to_timestamp("paidAt" / 1000.0) at time zone 'Europe/Paris')::date
where "restaurantId" = 'bistrot-lumiere';
""")
    files = defaultdict(list)
    for d in sorted(EVENTS):
        files[month_key(d)].append(d)
    for mk, days in files.items():
        with open(os.path.join(OUT, f'{mk}.sql'), 'w') as f:
            f.write(f'-- Bistrot Lumière — {mk}\n')
            for d in days:
                f.write(f'begin; -- {d.isoformat()}\n')
                clock, actor = None, None
                for (t, _, who, sql) in sorted(EVENTS[d], key=lambda e: (e[0], e[1])):
                    sets = []
                    if t != clock:
                        sets.append(f"set_config('mise.clock', '{t}', true)")
                        clock = t
                    if who and who != actor:
                        sets.append(f"set_config('request.jwt.claim.sub', '{who}', true)")
                        actor = who
                    if sets:
                        f.write('select ' + ', '.join(sets) + ';\n')
                    f.write(sql + '\n')
                f.write('commit;\n')


def summary():
    print(f"{'month':8} {'covers':>6} {'tickets':>7} {'net €':>9} {'food%':>6} {'cost€':>8} {'buy€':>8} {'waste€':>7} {'shrink€':>7} {'wages€':>8} {'charges€':>8} {'labour%':>7}")
    for mk in sorted(MONTH):
        m = MONTH[mk]
        net = m['net'] / 100
        print(f"{mk:8} {int(m['covers']):6d} {int(m['tickets']):7d} {net:9.0f} {(m['cost'] / m['net'] * 100 if m['net'] else 0):6.1f} {m['cost'] / 100:8.0f} {m['purchases'] / 100:8.0f} {m['waste'] / 100:7.0f} {m['shrink'] / 100:7.0f} "
              f"{m['wages'] / 100:8.0f} {m['charges'] / 100:8.0f} {((m['wages'] + m['charges']) / m['net'] * 100 if m['net'] else 0):7.1f}")
    print('guests', len(GUESTS), 'bookings', len(BOOKINGS), 'events', sum(len(v) for v in EVENTS.values()))
    for mk in sorted(DEMAND):
        print(mk, 'asked', round(DEMAND[mk]), 'seated', SEATED[mk])


if __name__ == '__main__':
    plan()
    seed_rates()
    setup()
    fixed_entries()
    emit_bookings()
    live()
    write()
    if SUMMARY:
        summary()
