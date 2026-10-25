"""
Bistrot Lumière — what it is: the company, its people, its suppliers, its stock, its menu, its rooms and its equipment.
Everything here is fictional. Money in cents, before VAT unless said; quantities in grams, millilitres or pieces.
"""

ORG = 'lumiere'
ORG_NAME = 'Lumière Restauration'
RID = 'bistrot-lumiere'
OWNER = dict(key='owner', name='Camille Arnaud', email='camille.arnaud@example.com')

# ── The team ─────────────────────────────────────────────────────────
# role: the dashboard account (None: clocks in at the kiosk only). rate: gross per hour, cents. monthly: paid their
# contract's hours every month (mensualisé), else the hours worked.
STAFF = [
    dict(key='lea', name='Léa Fontaine', team='management', job='Directrice de salle', role='manager', contract='permanent', hours=39, rate=1850, monthly=True, start='2024-12-16'),
    dict(key='karim', name='Karim Benali', team='kitchen', job='Chef de cuisine', role='kitchen', contract='permanent', hours=39, rate=1780, monthly=True, start='2024-12-16'),
    dict(key='sofia', name='Sofia Rossi', team='kitchen', job='Second de cuisine', role='kitchen', contract='permanent', hours=35, rate=1420, monthly=True, start='2024-12-27'),
    dict(key='hugo', name='Hugo Lambert', team='kitchen', job='Commis de cuisine', role='kitchen', contract='permanent', hours=35, rate=1225, monthly=True, start='2025-02-03'),
    dict(key='mamadou', name='Mamadou Diallo', team='kitchen', job='Plongeur', role=None, contract='permanent', hours=35, rate=1188, monthly=True, start='2024-12-30'),
    dict(key='ines', name='Inès Garcia', team='kitchen', job='Plongeuse (week-ends)', role=None, contract='extra', hours=0, rate=1200, monthly=False, start='2025-01-03'),
    dict(key='thomas', name='Thomas Girard', team='floor', job='Chef de rang', role='waiter', contract='permanent', hours=35, rate=1360, monthly=True, start='2024-12-30'),
    dict(key='chloe', name='Chloé Petit', team='floor', job='Serveuse', role='waiter', contract='permanent', hours=35, rate=1245, monthly=True, start='2024-12-30'),
    dict(key='lucas', name='Lucas Bernard', team='floor', job='Serveur (temps partiel)', role='waiter', contract='fixed', hours=24, rate=1200, monthly=True, start='2025-03-01', end='2025-05-31'),
    dict(key='zoe', name='Zoé Chevalier', team='floor', job='Serveuse (temps partiel)', role='waiter', contract='permanent', hours=24, rate=1210, monthly=True, start='2025-06-01'),
    dict(key='manon', name='Manon Leroy', team='bar', job='Barmaid', role='bar', contract='permanent', hours=35, rate=1310, monthly=True, start='2024-12-30'),
    dict(key='nathan', name='Nathan Faure', team='floor', job='Serveur saisonnier', role='waiter', contract='seasonal', hours=35, rate=1200, monthly=True, start='2025-06-14', end='2025-09-14'),
    dict(key='emma', name='Emma Roux', team='kitchen', job='Commis saisonnière', role='kitchen', contract='seasonal', hours=35, rate=1195, monthly=True, start='2025-07-01', end='2025-08-31'),
]

# ── Suppliers ────────────────────────────────────────────────────────
# days: Python weekdays they deliver (Monday 0). station: the purchases' station, for their VAT.
SUPPLIERS = [
    dict(id='bl-sup-primeur', name='Primeurs du Cours', contact='Marius Fabre', days=[1, 2, 3, 4, 5], lead=0, terms='Comptant à la livraison', station='kitchen'),
    dict(id='bl-sup-boucherie', name='Boucherie Ferrero', contact='Paul Ferrero', days=[1, 3, 5], lead=1, terms='Comptant à la livraison', station='kitchen'),
    dict(id='bl-sup-maree', name='Marée Niçoise', contact='Lucie Bonnet', days=[1, 4], lead=1, terms='Comptant à la livraison', station='kitchen'),
    dict(id='bl-sup-boulangerie', name='Boulangerie du Port', contact='Antoine Giordano', days=[1, 2, 3, 4, 5, 6], lead=0, terms='Relevé hebdomadaire', station='kitchen'),
    dict(id='bl-sup-metro', name='Metro Nice Saint-Isidore', contact='', days=[1, 4], lead=0, terms='Carte bancaire', station='kitchen'),
    dict(id='bl-sup-cave', name='Cave des Coteaux Azur', contact='Hélène Marchetti', days=[2], lead=2, terms='Comptant à la livraison', station='bar'),
    dict(id='bl-sup-boissons', name='Boissons Côte d’Azur', contact='Yann Le Gall', days=[3], lead=2, terms='Comptant à la livraison', station='bar'),
    dict(id='bl-sup-cafe', name='Torréfaction du Vieux-Nice', contact='Elsa Cauvin', days=[2], lead=3, terms='Comptant à la livraison', station='bar'),
]

# ── Stock ────────────────────────────────────────────────────────────
# (id, name, station, unit, packSize, packLabel, packCost (HT cents), supplier, perish: weekly spoilage of what is on the
# shelf, season: 'produce' prices move with the season, allergens)
INGREDIENTS = [
    # meat & fish
    ('entrecote', 'Entrecôte de bœuf', 'kitchen', 'g', 1000, 'kg', 2650, 'bl-sup-boucherie', 0.0, None, []),
    ('rumsteck', 'Rumsteck (carpaccio, tartare)', 'kitchen', 'g', 1000, 'kg', 2180, 'bl-sup-boucherie', 0.01, None, []),
    ('hache', 'Bœuf haché 15 %', 'kitchen', 'g', 1000, 'kg', 1150, 'bl-sup-boucherie', 0.01, None, []),
    ('paleron', 'Paleron (daube)', 'kitchen', 'g', 1000, 'kg', 1380, 'bl-sup-boucherie', 0.0, None, []),
    ('volaille', 'Suprêmes de volaille', 'kitchen', 'g', 1000, 'kg', 1290, 'bl-sup-boucherie', 0.01, None, []),
    ('daurade', 'Filets de daurade', 'kitchen', 'g', 1000, 'kg', 2350, 'bl-sup-maree', 0.03, None, ['fish']),
    ('anchois', 'Anchois au sel', 'kitchen', 'g', 500, 'boîte 500 g', 1150, 'bl-sup-metro', 0.0, None, ['fish']),
    ('thon', 'Thon au naturel', 'kitchen', 'g', 1000, 'boîte 1 kg', 1420, 'bl-sup-metro', 0.0, None, ['fish']),
    # dairy & eggs
    ('oeufs', 'Œufs plein air', 'kitchen', 'unit', 30, 'plateau de 30', 780, 'bl-sup-metro', 0.0, None, ['eggs']),
    ('burrata', 'Burrata 125 g', 'kitchen', 'unit', 6, 'carton de 6', 1590, 'bl-sup-metro', 0.05, None, ['milk']),
    ('parmesan', 'Parmigiano Reggiano', 'kitchen', 'g', 1000, 'kg', 1920, 'bl-sup-metro', 0.0, None, ['milk']),
    ('cheddar', 'Cheddar en tranches', 'kitchen', 'g', 1000, 'kg', 1180, 'bl-sup-metro', 0.0, None, ['milk']),
    ('gruyere', 'Gruyère râpé', 'kitchen', 'g', 1000, 'kg', 1240, 'bl-sup-metro', 0.0, None, ['milk']),
    ('beurre', 'Beurre doux', 'kitchen', 'g', 1000, 'kg', 960, 'bl-sup-metro', 0.0, None, ['milk']),
    ('creme', 'Crème liquide 35 %', 'kitchen', 'ml', 1000, 'l', 520, 'bl-sup-metro', 0.01, None, ['milk']),
    ('mascarpone', 'Mascarpone', 'kitchen', 'g', 500, 'pot 500 g', 340, 'bl-sup-metro', 0.01, None, ['milk']),
    ('lait', 'Lait entier', 'bar', 'ml', 1000, 'l', 115, 'bl-sup-metro', 0.02, None, ['milk']),
    # dry goods
    ('farine', 'Farine T55', 'kitchen', 'g', 1000, 'kg', 95, 'bl-sup-metro', 0.0, None, ['gluten']),
    ('sucre', 'Sucre semoule', 'kitchen', 'g', 1000, 'kg', 125, 'bl-sup-metro', 0.0, None, []),
    ('chocolat', 'Chocolat noir 70 %', 'kitchen', 'g', 1000, 'kg', 1260, 'bl-sup-metro', 0.0, None, []),
    ('biscuits', 'Biscuits à la cuillère', 'kitchen', 'g', 1000, 'kg', 720, 'bl-sup-metro', 0.0, None, ['gluten', 'eggs']),
    ('arborio', 'Riz arborio', 'kitchen', 'g', 1000, 'kg', 390, 'bl-sup-metro', 0.0, None, []),
    ('pates', 'Pâtes fraîches', 'kitchen', 'g', 1000, 'kg', 640, 'bl-sup-metro', 0.01, None, ['gluten', 'eggs']),
    ('olives', 'Olives de Nice', 'kitchen', 'g', 1000, 'kg', 980, 'bl-sup-metro', 0.0, None, []),
    ('huile-olive', 'Huile d’olive vierge extra', 'kitchen', 'ml', 5000, 'bidon 5 l', 4400, 'bl-sup-metro', 0.0, None, []),
    ('huile-friture', 'Huile de friture', 'kitchen', 'ml', 10000, 'bidon 10 l', 2700, 'bl-sup-metro', 0.0, None, []),
    ('vin-cuisine', 'Vin rouge de cuisine', 'kitchen', 'ml', 5000, 'cubi 5 l', 1450, 'bl-sup-metro', 0.0, None, ['sulphites']),
    ('pain', 'Baguette tradition', 'kitchen', 'unit', 1, 'pièce', 105, 'bl-sup-boulangerie', 0.0, None, ['gluten']),
    ('buns', 'Pains burger brioche', 'kitchen', 'unit', 12, 'sachet de 12', 690, 'bl-sup-boulangerie', 0.0, None, ['gluten', 'eggs', 'milk', 'sesame']),
    # vegetables, fruit & herbs
    ('pdt', 'Pommes de terre (frites)', 'kitchen', 'g', 10000, 'sac 10 kg', 950, 'bl-sup-primeur', 0.01, 'produce', []),
    ('oignons', 'Oignons', 'kitchen', 'g', 5000, 'filet 5 kg', 700, 'bl-sup-primeur', 0.01, 'produce', []),
    ('tomates', 'Tomates', 'kitchen', 'g', 1000, 'kg', 320, 'bl-sup-primeur', 0.04, 'produce', []),
    ('champignons', 'Champignons de Paris', 'kitchen', 'g', 1000, 'kg', 640, 'bl-sup-primeur', 0.06, 'produce', []),
    ('courgettes', 'Courgettes', 'kitchen', 'g', 1000, 'kg', 280, 'bl-sup-primeur', 0.04, 'produce', []),
    ('carottes', 'Carottes', 'kitchen', 'g', 5000, 'sac 5 kg', 650, 'bl-sup-primeur', 0.01, 'produce', []),
    ('salade', 'Mesclun et roquette', 'kitchen', 'g', 1000, 'kg', 920, 'bl-sup-primeur', 0.08, 'produce', []),
    ('haricots', 'Haricots verts', 'kitchen', 'g', 1000, 'kg', 520, 'bl-sup-primeur', 0.04, 'produce', []),
    ('concombre', 'Concombres', 'kitchen', 'unit', 12, 'cagette de 12', 780, 'bl-sup-primeur', 0.03, 'produce', []),
    ('herbes', 'Herbes fraîches (basilic, persil)', 'kitchen', 'g', 100, 'botte 100 g', 150, 'bl-sup-primeur', 0.12, 'produce', []),
    ('citrons', 'Citrons de Menton', 'kitchen', 'unit', 10, 'sachet de 10', 420, 'bl-sup-primeur', 0.02, None, []),
    ('courge', 'Courge butternut', 'kitchen', 'g', 1000, 'kg', 240, 'bl-sup-primeur', 0.01, 'produce', []),
    # bar
    ('vin-rouge', 'Côtes du Rhône rouge', 'bar', 'ml', 750, 'bouteille 75 cl', 480, 'bl-sup-cave', 0.0, None, ['sulphites']),
    ('vin-blanc', 'Côtes de Provence blanc', 'bar', 'ml', 750, 'bouteille 75 cl', 560, 'bl-sup-cave', 0.0, None, ['sulphites']),
    ('vin-rose', 'Côtes de Provence rosé', 'bar', 'ml', 750, 'bouteille 75 cl', 590, 'bl-sup-cave', 0.0, None, ['sulphites']),
    ('bordeaux', 'Bordeaux Supérieur', 'bar', 'ml', 750, 'bouteille 75 cl', 940, 'bl-sup-cave', 0.0, None, ['sulphites']),
    ('chablis', 'Chablis', 'bar', 'ml', 750, 'bouteille 75 cl', 1350, 'bl-sup-cave', 0.0, None, ['sulphites']),
    ('prosecco', 'Prosecco', 'bar', 'ml', 750, 'bouteille 75 cl', 560, 'bl-sup-cave', 0.0, None, ['sulphites']),
    ('biere', 'Bière blonde pression', 'bar', 'ml', 30000, 'fût 30 l', 9600, 'bl-sup-boissons', 0.0, None, ['gluten']),
    ('pastis', 'Pastis', 'bar', 'ml', 1000, 'bouteille 1 l', 1890, 'bl-sup-boissons', 0.0, None, []),
    ('rhum', 'Rhum blanc', 'bar', 'ml', 700, 'bouteille 70 cl', 1390, 'bl-sup-boissons', 0.0, None, []),
    ('aperol', 'Apéritif à l’orange amère', 'bar', 'ml', 1000, 'bouteille 1 l', 1490, 'bl-sup-boissons', 0.0, None, []),
    ('limoncello', 'Limoncello', 'bar', 'ml', 700, 'bouteille 70 cl', 1190, 'bl-sup-boissons', 0.0, None, []),
    ('coca', 'Cola 33 cl', 'bar', 'unit', 24, 'pack de 24', 1490, 'bl-sup-boissons', 0.0, None, []),
    ('limonade', 'Limonade artisanale 33 cl', 'bar', 'unit', 24, 'pack de 24', 2280, 'bl-sup-boissons', 0.0, None, []),
    ('eau-plate', 'Eau minérale 1 l', 'bar', 'unit', 12, 'pack de 12', 1140, 'bl-sup-boissons', 0.0, None, []),
    ('eau-gazeuse', 'Eau pétillante 1 l', 'bar', 'unit', 12, 'pack de 12', 1380, 'bl-sup-boissons', 0.0, None, []),
    ('soda', 'Eau gazeuse (cocktails)', 'bar', 'ml', 1000, 'bouteille 1 l', 85, 'bl-sup-boissons', 0.0, None, []),
    ('citrons-verts', 'Citrons verts', 'bar', 'unit', 20, 'sachet de 20', 760, 'bl-sup-primeur', 0.03, None, []),
    ('menthe', 'Menthe fraîche', 'bar', 'g', 100, 'botte 100 g', 140, 'bl-sup-primeur', 0.15, None, []),
    ('oranges', 'Oranges', 'bar', 'unit', 20, 'filet de 20', 690, 'bl-sup-primeur', 0.02, None, []),
    ('cafe', 'Café en grains', 'bar', 'g', 1000, 'kg', 1980, 'bl-sup-cafe', 0.0, None, []),
    ('the', 'Thé en sachets', 'bar', 'unit', 100, 'boîte de 100', 1450, 'bl-sup-cafe', 0.0, None, []),
]

# Bases made in the house: (id, name, station, unit, yieldQty, recipe, shelf days)
PREPS = [
    ('p-frites', 'Frites taillées maison', 'kitchen', 'g', 850, [('pdt', 1000), ('huile-friture', 45)], 1),
    ('p-daube', 'Daube niçoise (portion)', 'kitchen', 'unit', 20, [('paleron', 4200), ('vin-cuisine', 1500), ('carottes', 1000), ('oignons', 900), ('tomates', 500), ('huile-olive', 100)], 4),
    ('p-soupe', 'Soupe à l’oignon (portion)', 'kitchen', 'unit', 16, [('oignons', 2600), ('beurre', 160), ('vin-cuisine', 250), ('pain', 4), ('gruyere', 450)], 3),
    ('p-gaspacho', 'Gaspacho (portion)', 'kitchen', 'unit', 14, [('tomates', 2400), ('concombre', 3), ('huile-olive', 150), ('pain', 1)], 3),
    ('p-veloute', 'Velouté de courge (portion)', 'kitchen', 'unit', 14, [('courge', 2600), ('oignons', 300), ('creme', 400), ('beurre', 80)], 3),
    ('p-tarte', 'Tarte au citron (part)', 'kitchen', 'unit', 10, [('farine', 300), ('beurre', 220), ('sucre', 320), ('oeufs', 9), ('citrons', 6)], 3),
    ('p-mousse', 'Mousse au chocolat (portion)', 'kitchen', 'unit', 12, [('chocolat', 520), ('oeufs', 12), ('sucre', 80)], 3),
    ('p-creme', 'Crème brûlée (portion)', 'kitchen', 'unit', 10, [('creme', 1000), ('oeufs', 10), ('sucre', 170)], 3),
    ('p-tiramisu', 'Tiramisu (portion)', 'kitchen', 'unit', 10, [('mascarpone', 750), ('oeufs', 6), ('sucre', 150), ('biscuits', 300), ('cafe', 40)], 3),
]

# ── The menu ─────────────────────────────────────────────────────────
# (id, name, category id, bill category, station, price TTC cents, VAT, recipe, prep minutes, active months (None: all))
MENU_CATEGORIES = [
    ('mc-carte', None, {'fr': 'La carte', 'en': 'Food'}, 0),
    ('mc-entrees', 'mc-carte', {'fr': 'Entrées', 'en': 'Starters'}, 0),
    ('mc-plats', 'mc-carte', {'fr': 'Plats', 'en': 'Mains'}, 1),
    ('mc-desserts', 'mc-carte', {'fr': 'Desserts', 'en': 'Desserts'}, 2),
    ('mc-boissons', None, {'fr': 'Boissons', 'en': 'Drinks'}, 1),
    ('mc-vins', 'mc-boissons', {'fr': 'Vins', 'en': 'Wines'}, 0),
    ('mc-bieres', 'mc-boissons', {'fr': 'Bières', 'en': 'Beers'}, 1),
    ('mc-aperitifs', 'mc-boissons', {'fr': 'Apéritifs & cocktails', 'en': 'Aperitifs & cocktails'}, 2),
    ('mc-softs', 'mc-boissons', {'fr': 'Sans alcool', 'en': 'Soft drinks'}, 3),
    ('mc-chaud', 'mc-boissons', {'fr': 'Boissons chaudes', 'en': 'Hot drinks'}, 4),
]

WINTER = {1, 2, 3, 10, 11, 12}
SUMMER = {6, 7, 8, 9}
MENU = [
    # starters
    ('soupe', 'Soupe à l’oignon gratinée', 'mc-entrees', 'starter', 'kitchen', 850, 10, [('p-soupe', 1), ('pain', 0.1)], 4, WINTER - {10}),
    ('veloute', 'Velouté de courge', 'mc-entrees', 'starter', 'kitchen', 850, 10, [('p-veloute', 1), ('pain', 0.1)], 4, {10, 11, 12}),
    ('gaspacho', 'Gaspacho de tomates', 'mc-entrees', 'starter', 'kitchen', 850, 10, [('p-gaspacho', 1), ('herbes', 2)], 3, SUMMER),
    ('burrata', 'Burrata, tomates et basilic', 'mc-entrees', 'starter', 'kitchen', 1300, 10, [('burrata', 1), ('tomates', 130), ('huile-olive', 10), ('herbes', 3)], 5, None),
    ('oeuf', 'Œuf parfait, crème de champignons', 'mc-entrees', 'starter', 'kitchen', 1100, 10, [('oeufs', 1), ('champignons', 80), ('creme', 40), ('beurre', 6)], 8, None),
    ('carpaccio', 'Carpaccio de bœuf, parmesan', 'mc-entrees', 'starter', 'kitchen', 1250, 10, [('rumsteck', 90), ('parmesan', 15), ('salade', 15), ('huile-olive', 10), ('citrons', 0.1)], 6, None),
    ('pissaladiere', 'Pissaladière niçoise', 'mc-entrees', 'starter', 'kitchen', 900, 10, [('farine', 80), ('oignons', 150), ('olives', 15), ('anchois', 10), ('huile-olive', 10)], 6, None),
    # mains
    ('entrecote', 'Entrecôte grillée, frites maison', 'mc-plats', 'main', 'kitchen', 2900, 10, [('entrecote', 300), ('p-frites', 200), ('beurre', 15), ('salade', 20), ('pain', 0.2)], 14, None),
    ('burger', 'Burger du Bistrot, frites', 'mc-plats', 'main', 'kitchen', 1900, 10, [('buns', 1), ('hache', 180), ('cheddar', 30), ('oignons', 30), ('tomates', 30), ('salade', 15), ('p-frites', 180)], 12, None),
    ('daube', 'Daube niçoise, pâtes fraîches', 'mc-plats', 'main', 'kitchen', 2200, 10, [('p-daube', 1), ('pates', 120), ('pain', 0.2)], 8, None),
    ('daurade', 'Filet de daurade, légumes du soleil', 'mc-plats', 'main', 'kitchen', 2400, 10, [('daurade', 180), ('courgettes', 120), ('tomates', 60), ('huile-olive', 15), ('citrons', 0.25), ('pain', 0.2)], 13, None),
    ('risotto', 'Risotto aux champignons', 'mc-plats', 'main', 'kitchen', 1900, 10, [('arborio', 90), ('champignons', 120), ('parmesan', 25), ('beurre', 20), ('oignons', 30), ('vin-cuisine', 30)], 18, None),
    ('nicoise', 'Salade niçoise', 'mc-plats', 'main', 'kitchen', 1700, 10, [('salade', 60), ('tomates', 120), ('oeufs', 1), ('thon', 60), ('olives', 15), ('anchois', 10), ('haricots', 50), ('huile-olive', 15), ('pain', 0.2)], 8, None),
    ('tartare', 'Tartare de bœuf, frites', 'mc-plats', 'main', 'kitchen', 2100, 10, [('rumsteck', 180), ('oeufs', 1), ('oignons', 15), ('p-frites', 180), ('pain', 0.2)], 9, None),
    ('volaille', 'Suprême de volaille, jus corsé', 'mc-plats', 'main', 'kitchen', 1900, 10, [('volaille', 220), ('pdt', 200), ('beurre', 15), ('carottes', 60), ('pain', 0.2)], 15, None),
    ('pdj', 'Plat du jour', 'mc-plats', 'main', 'kitchen', 1550, 10, [('volaille', 150), ('pdt', 150), ('carottes', 80), ('beurre', 10), ('pain', 0.2)], 10, None),
    # desserts
    ('tarte', 'Tarte au citron meringuée', 'mc-desserts', 'dessert', 'kitchen', 800, 10, [('p-tarte', 1)], 2, None),
    ('mousse', 'Mousse au chocolat', 'mc-desserts', 'dessert', 'kitchen', 750, 10, [('p-mousse', 1)], 2, None),
    ('creme', 'Crème brûlée', 'mc-desserts', 'dessert', 'kitchen', 800, 10, [('p-creme', 1), ('sucre', 10)], 3, None),
    ('tiramisu', 'Tiramisu', 'mc-desserts', 'dessert', 'kitchen', 800, 10, [('p-tiramisu', 1)], 2, None),
    ('gourmand', 'Café gourmand', 'mc-desserts', 'dessert', 'bar', 950, 10, [('cafe', 8), ('p-mousse', 0.5), ('p-tiramisu', 0.5)], 4, None),
    # wines
    ('verre-rouge', 'Côtes du Rhône (verre 12 cl)', 'mc-vins', 'drink', 'bar', 650, 20, [('vin-rouge', 120)], 1, None),
    ('verre-blanc', 'Côtes de Provence blanc (verre)', 'mc-vins', 'drink', 'bar', 700, 20, [('vin-blanc', 120)], 1, None),
    ('verre-rose', 'Rosé de Provence (verre)', 'mc-vins', 'drink', 'bar', 650, 20, [('vin-rose', 120)], 1, None),
    ('btl-rose', 'Côtes de Provence rosé (bouteille)', 'mc-vins', 'drink', 'bar', 3200, 20, [('vin-rose', 750)], 1, None),
    ('btl-bordeaux', 'Bordeaux Supérieur (bouteille)', 'mc-vins', 'drink', 'bar', 3600, 20, [('bordeaux', 750)], 1, None),
    ('btl-chablis', 'Chablis (bouteille)', 'mc-vins', 'drink', 'bar', 4200, 20, [('chablis', 750)], 1, None),
    # beers & aperitifs
    ('demi', 'Demi pression', 'mc-bieres', 'drink', 'bar', 450, 20, [('biere', 250)], 1, None),
    ('pinte', 'Pinte pression', 'mc-bieres', 'drink', 'bar', 850, 20, [('biere', 500)], 1, None),
    ('pastis', 'Pastis', 'mc-aperitifs', 'drink', 'bar', 400, 20, [('pastis', 20)], 1, None),
    ('spritz', 'Spritz', 'mc-aperitifs', 'drink', 'bar', 1000, 20, [('aperol', 60), ('prosecco', 90), ('soda', 30), ('oranges', 0.1)], 3, None),
    ('mojito', 'Mojito', 'mc-aperitifs', 'drink', 'bar', 1100, 20, [('rhum', 50), ('citrons-verts', 0.5), ('menthe', 5), ('sucre', 15), ('soda', 60)], 4, None),
    ('limoncello', 'Limoncello', 'mc-aperitifs', 'drink', 'bar', 600, 20, [('limoncello', 40)], 1, None),
    # soft & hot
    ('coca', 'Cola 33 cl', 'mc-softs', 'drink', 'bar', 450, 10, [('coca', 1)], 1, None),
    ('limonade', 'Limonade artisanale', 'mc-softs', 'drink', 'bar', 450, 10, [('limonade', 1)], 1, None),
    ('eau-plate', 'Eau minérale 1 l', 'mc-softs', 'drink', 'bar', 500, 10, [('eau-plate', 1)], 1, None),
    ('eau-gazeuse', 'Eau pétillante 1 l', 'mc-softs', 'drink', 'bar', 550, 10, [('eau-gazeuse', 1)], 1, None),
    ('cafe', 'Café', 'mc-chaud', 'drink', 'bar', 250, 10, [('cafe', 8)], 1, None),
    ('creme-cafe', 'Café crème', 'mc-chaud', 'drink', 'bar', 380, 10, [('cafe', 8), ('lait', 120)], 2, None),
    ('the', 'Thé', 'mc-chaud', 'drink', 'bar', 350, 10, [('the', 1)], 1, None),
    # one night
    ('reveillon', 'Menu du réveillon (5 plats)', 'mc-plats', 'main', 'kitchen', 8500, 10, [('entrecote', 160), ('daurade', 90), ('burrata', 0.5), ('champignons', 60), ('p-tarte', 1), ('pain', 0.3)], 20, set()),
]

# ── The rooms ────────────────────────────────────────────────────────
# (id, label, area, seats, shape, x, y, w, h, table model, chair model)
AREAS = [
    dict(id='bl-a-salle', name='Salle', width=22, height=14, opened='2024-12-15'),
    dict(id='bl-a-terrasse', name='Terrasse', width=16, height=8, opened='2025-04-28'),
]
TABLES = (
    [(f'bl-t{i + 1}', str(i + 1), 'bl-a-salle', 2, 'square', 1 + (i % 5) * 3, 2 + (i // 5) * 4, 2, 2, 'bl-m-table-70', 'bl-m-chaise') for i in range(10)]
    + [('bl-t11', '11', 'bl-a-salle', 4, 'rect', 1, 11, 3, 2, 'bl-m-table-120', 'bl-m-chaise'),
       ('bl-t12', '12', 'bl-a-salle', 4, 'rect', 6, 11, 3, 2, 'bl-m-table-120', 'bl-m-chaise'),
       ('bl-t13', '13', 'bl-a-salle', 4, 'rect', 11, 11, 3, 2, 'bl-m-table-120', 'bl-m-chaise'),
       ('bl-t14', '14', 'bl-a-salle', 6, 'round', 17, 3, 3, 3, 'bl-m-table-ronde', 'bl-m-chaise')]
    + [(f'bl-tr{i + 1}', f'T{i + 1}', 'bl-a-terrasse', 2, 'square', 1 + (i % 4) * 4, 1 + (i // 4) * 4, 2, 2, 'bl-m-table-terrasse', 'bl-m-chaise-terrasse') for i in range(8)]
)
FIXTURES = {
    'bl-a-salle': [
        dict(id='f-bar', kind='bar', x=16, y=10, w=5, h=2, label='Comptoir', modelId=None),
        dict(id='f-passe', kind='kitchen', x=17, y=0, w=4, h=1, label='Passe', modelId=None),
        dict(id='f-porte', kind='door', x=9, y=13, w=2, h=1, label=''),
        dict(id='f-plante', kind='plant', x=0, y=0, w=1, h=1, label='', modelId='bl-m-olivier'),
    ],
    'bl-a-terrasse': [dict(id='f-auvent', kind='wall', x=0, y=0, w=16, h=1, label='')],
}

# ── Furniture & equipment ────────────────────────────────────────────
# models: (id, zone, category, name, brand, reference, w, d, h, seats, shape, list price, life years)
MODELS = [
    ('bl-m-piano', 'kitchen', 'range', 'Piano gaz 4 feux sur four', 'Charvet', 'Occasion révisée', 120, 80, 90, None, None, 250000, 8),
    ('bl-m-combi', 'kitchen', 'oven', 'Four mixte 6 niveaux', 'Rational', 'iCombi Classic 6-1/1 (reconditionné)', 85, 78, 75, None, None, 460000, 7),
    ('bl-m-frigo', 'kitchen', 'cold', 'Armoire réfrigérée positive 600 l', 'Liebherr', 'GKPv 6520', 70, 83, 205, None, None, 105000, 8),
    ('bl-m-saladette', 'kitchen', 'cold', 'Table réfrigérée 3 portes', 'Polar', 'U636', 136, 70, 85, None, None, 130000, 8),
    ('bl-m-congel', 'kitchen', 'cold', 'Congélateur armoire 400 l', 'Liebherr', 'GGv 5060', 75, 75, 186, None, None, 85000, 8),
    ('bl-m-plonge', 'kitchen', 'dishwasher', 'Lave-vaisselle à capot', 'Hobart', 'AM-900 (reconditionné)', 67, 75, 150, None, None, 220000, 7),
    ('bl-m-friteuse', 'kitchen', 'fryer', 'Friteuse électrique 2 × 8 l', 'Bartscher', 'Profi II', 58, 46, 38, None, None, 60000, 6),
    ('bl-m-inox', 'kitchen', 'worktop', 'Plans de travail et étagères inox', 'Diamond', '', None, None, None, None, None, 90000, 10),
    ('bl-m-robot', 'kitchen', 'prep', 'Mixeur plongeant et robot coupe', 'Robot-Coupe', 'CL 50 + MP 350', None, None, None, None, None, 52000, 5),
    ('bl-m-batterie', 'kitchen', 'cookware', 'Batterie de cuisine (casseroles, poêles, ustensiles)', 'De Buyer', '', None, None, None, None, None, 80000, 3),
    ('bl-m-moulin', 'bar', 'coffee', 'Moulin à café', 'Mazzer', 'Super Jolly', 20, 34, 64, None, None, 45000, 6),
    ('bl-m-laveverres', 'bar', 'glasswasher', 'Lave-verres', 'Winterhalter', 'UC-S', 60, 60, 72, None, None, 145000, 6),
    ('bl-m-arrierebar', 'bar', 'cold', 'Arrière-bar réfrigéré 2 portes', 'Gamko', 'MG2', 140, 55, 90, None, None, 98000, 8),
    ('bl-m-glacons', 'bar', 'ice', 'Machine à glaçons 25 kg', 'Hoshizaki', 'IM-21CNE', 40, 45, 75, None, None, 90000, 6),
    ('bl-m-verrerie', 'bar', 'glassware', 'Verrerie (vin, eau, cocktails)', 'Chef & Sommelier', '', None, None, None, None, None, 62000, 2),
    ('bl-m-tabouret', 'bar', 'stool', 'Tabouret de bar', 'Atelier Riviera', 'H75', 40, 40, 75, None, None, 7500, 7),
    ('bl-m-table-70', 'floor', 'table', 'Table bistrot 70 × 70', 'Atelier Riviera', 'Bistro 70', 70, 70, 75, 2, 'square', 14500, 10),
    ('bl-m-table-120', 'floor', 'table', 'Table 120 × 70', 'Atelier Riviera', 'Bistro 120', 120, 70, 75, 4, 'rect', 21000, 10),
    ('bl-m-table-ronde', 'floor', 'table', 'Table ronde Ø 120', 'Atelier Riviera', 'Ronde 120', 120, None, 75, 6, 'round', 26000, 10),
    ('bl-m-chaise', 'floor', 'chair', 'Chaise bistrot cannée', 'Atelier Riviera', 'Cannée 46', 43, 50, 46, None, None, 5800, 7),
    ('bl-m-table-terrasse', 'floor', 'table', 'Table de terrasse 70 × 70', 'Fermette', 'Alu 70', 70, 70, 74, 2, 'square', 9500, 6),
    ('bl-m-chaise-terrasse', 'floor', 'chair', 'Chaise de terrasse empilable', 'Fermette', 'Alu', 45, 52, 45, None, None, 3900, 5),
    ('bl-m-parasol', 'floor', 'terrace', 'Parasol 3 × 3 m', 'Fermette', '', 300, 300, 250, None, None, 18000, 5),
    ('bl-m-caisse', 'floor', 'electronics', 'Caisse tablette et imprimante tickets', 'Sunmi', 'D3 Mini', None, None, None, None, None, 69000, 4),
    ('bl-m-luminaires', 'floor', 'lighting', 'Suspensions et éclairage', 'Atelier Riviera', '', None, None, None, None, None, 60000, 8),
    ('bl-m-vaisselle', 'floor', 'tableware', 'Vaisselle et couverts (60 couverts)', 'Revol', '', None, None, None, None, None, 115000, 3),
    ('bl-m-olivier', 'floor', 'decor', 'Olivier en pot', 'Pépinière du Var', '', 80, 80, 180, None, None, 22000, 5),
    ('bl-m-extincteurs', 'kitchen', 'safety', 'Extincteurs et trousse de secours', 'Sicli', '', None, None, None, None, None, 32000, 5),
]
# lots: (model, qty, purchased on, unit cost HT cents, supplier, invoice, serial, warranty until, next service)
LOTS = [
    ('bl-m-piano', 1, '2024-12-09', 250000, 'Cuisines Pro Occasion', 'CPO-24-118', 'CHV-4F-20871', '2025-06-09', '2025-12-09'),
    ('bl-m-combi', 1, '2024-12-09', 460000, 'Cuisines Pro Occasion', 'CPO-24-118', 'E11SI21031712', '2025-12-09', '2025-06-10'),
    ('bl-m-frigo', 2, '2024-12-09', 105000, 'Froid Azur', 'FA-24-551', '', '2026-12-09', ''),
    ('bl-m-saladette', 1, '2024-12-09', 130000, 'Froid Azur', 'FA-24-551', '', '2026-12-09', ''),
    ('bl-m-plonge', 1, '2024-12-11', 220000, 'Cuisines Pro Occasion', 'CPO-24-121', 'AM900-60332', '2025-06-11', ''),
    ('bl-m-friteuse', 1, '2024-12-11', 60000, 'Cuisines Pro Occasion', 'CPO-24-121', '', '2025-12-11', ''),
    ('bl-m-inox', 1, '2024-12-11', 90000, 'Cuisines Pro Occasion', 'CPO-24-121', '', '', ''),
    ('bl-m-batterie', 1, '2024-12-18', 80000, 'Metro Nice Saint-Isidore', 'MET-881204', '', '', ''),
    ('bl-m-extincteurs', 1, '2024-12-18', 32000, 'Sicli', 'SIC-24-3307', '', '', '2025-12-18'),
    ('bl-m-moulin', 1, '2024-12-12', 45000, 'Torréfaction du Vieux-Nice', 'TVN-24-77', 'MZ-SJ-4410', '2025-12-12', ''),
    ('bl-m-laveverres', 1, '2024-12-12', 145000, 'Froid Azur', 'FA-24-560', 'WH-UCS-7731', '2025-12-12', ''),
    ('bl-m-arrierebar', 1, '2024-12-12', 98000, 'Froid Azur', 'FA-24-560', '', '2026-12-12', ''),
    ('bl-m-verrerie', 1, '2024-12-18', 62000, 'Metro Nice Saint-Isidore', 'MET-881204', '', '', ''),
    ('bl-m-tabouret', 6, '2024-12-16', 7500, 'Atelier Riviera', 'AR-1092', '', '', ''),
    ('bl-m-table-70', 10, '2024-12-16', 14500, 'Atelier Riviera', 'AR-1092', '', '', ''),
    ('bl-m-table-120', 3, '2024-12-16', 21000, 'Atelier Riviera', 'AR-1092', '', '', ''),
    ('bl-m-table-ronde', 1, '2024-12-16', 26000, 'Atelier Riviera', 'AR-1092', '', '', ''),
    ('bl-m-chaise', 40, '2024-12-16', 5800, 'Atelier Riviera', 'AR-1092', '', '', ''),
    ('bl-m-caisse', 1, '2024-12-17', 69000, 'Sunmi', 'SUN-FR-55120', 'D3M-881902', '2025-12-17', ''),
    ('bl-m-luminaires', 1, '2024-12-13', 60000, 'Atelier Riviera', 'AR-1088', '', '', ''),
    ('bl-m-vaisselle', 1, '2024-12-18', 115000, 'Metro Nice Saint-Isidore', 'MET-881204', '', '', ''),
    ('bl-m-olivier', 1, '2024-12-20', 22000, 'Pépinière du Var', 'PV-319', '', '', ''),
    # after the opening
    ('bl-m-robot', 1, '2025-01-08', 52000, 'Metro Nice Saint-Isidore', 'MET-900118', '', '2026-01-08', ''),
    ('bl-m-congel', 1, '2025-02-12', 85000, 'Froid Azur', 'FA-25-104', '', '2027-02-12', ''),
    ('bl-m-glacons', 1, '2025-05-02', 90000, 'Froid Azur', 'FA-25-288', 'HZ-21-55190', '2026-05-02', '2025-11-02'),
    ('bl-m-table-terrasse', 8, '2025-04-28', 9500, 'Fermette', 'FE-2025-41', '', '', ''),
    ('bl-m-chaise-terrasse', 18, '2025-04-28', 3900, 'Fermette', 'FE-2025-41', '', '', ''),
    ('bl-m-parasol', 3, '2025-04-28', 18000, 'Fermette', 'FE-2025-41', '', '', ''),
    ('bl-m-verrerie', 1, '2025-07-04', 18000, 'Metro Nice Saint-Isidore', 'MET-912877', '', '', ''),
    ('bl-m-chaise', 2, '2025-06-23', 6100, 'Atelier Riviera', 'AR-1240', '', '', ''),
]
