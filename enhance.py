"""Enhance strains.json with breeder URLs, seedfinder links, lineage tags,
phenotype, rarity rating, strain bud-image mapping, and valuation.

IMPORTANT: The number on each pack (x10, x18, x6, etc.) is SEED COUNT inside
one pack — not a count of packs. Each strain entry = one physical pack,
priced at the breeder-tier per-pack range, with minor adjustments for
seed count and seed type."""
import json, urllib.parse, re
from pathlib import Path

SITE = Path(r'C:\Users\zelid\john-seed-library\site')
with open(SITE / 'strains.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# ──────────────────────────────────────────────────────────────
# Breeder URLs
# ──────────────────────────────────────────────────────────────
BREEDERS = {
    'covert genetics': 'https://www.instagram.com/covertgenetics/',
    'tiki madman': 'https://www.instagram.com/tikimadman/',
    'in house genetics': 'https://inhousegenetics.com/',
    'cookies fam': 'https://cookies.co/',
    'cult classics seeds': 'https://cultclassicsseeds.com/',
    'cult classics / universally seeded': 'https://cultclassicsseeds.com/',
    'ethos genetics': 'https://ethosgenetics.com/',
    'savage genetics': 'https://savagegenetics.com/',
    'savage (testers)': 'https://savagegenetics.com/',
    'envy genetics': 'https://envygenetics.com/',
    'bloom seed co': 'https://bloomseedco.com/',
    'mephisto genetics': 'https://mephistogenetics.com/',
    'exotic genetix': 'https://exoticgenetix.com/',
    'exotic genetix / runtz s1 self': 'https://exoticgenetix.com/',
    'ab seed': 'https://www.instagram.com/ab_seed_organization/',
    'ab seed / goat cheese': 'https://www.instagram.com/ab_seed_organization/',
    'a&b company': 'https://www.instagram.com/abcompany.lv/',
    'fire farms': 'https://www.instagram.com/firefarmsgenetics/',
    'humble jungle seeds': 'https://humblejungleseeds.com/',
    'crane city cannabis': 'https://www.instagram.com/cranecitycannabis/',
    'phantom fire genetics': 'https://www.instagram.com/phantomfiregenetics/',
    'gene traders vip': 'https://www.instagram.com/gene_traders/',
    'lyme rising farm': 'https://www.instagram.com/lymerisingfarm/',
    'geo farms': 'https://www.instagram.com/geo_farms_/',
    'geist': 'https://www.instagram.com/geistgenetics/',
    'grf': 'https://www.instagram.com/grf.genetics/',
    'blue j genetics': 'https://www.instagram.com/sincityseeds/',
    'blue j / sin city': 'https://sincityseeds.com/',
    'sin city': 'https://sincityseeds.com/',
    "kali's": 'https://www.instagram.com/kalisgenetics/',
}

def breeder_url(breeder_raw):
    if not breeder_raw:
        return None
    b = breeder_raw.lower()
    for key in sorted(BREEDERS, key=len, reverse=True):
        if key in b:
            return BREEDERS[key]
    return None

# ──────────────────────────────────────────────────────────────
# Price per-pack (USD) — one physical pack
# ──────────────────────────────────────────────────────────────
# Tiers reflect craft-market retail ranges. Seed count inside the pack is a
# minor modifier (not a multiplier). Hype / limited / S1 releases sit on
# the high end of their breeder's tier.
PRICE_MAP = [
    ('covert genetics', (100, 180)),
    ('tiki madman', (120, 220)),
    ('in house genetics', (150, 250)),
    ('cookies fam', (150, 300)),
    ('cult classics', (100, 200)),
    ('ethos genetics', (100, 250)),
    ('savage genetics', (150, 300)),
    ('savage (testers)', (0, 50)),
    ('envy genetics', (80, 150)),
    ('bloom seed co', (100, 180)),
    ('mephisto genetics', (70, 120)),
    ('exotic genetix', (150, 300)),
    ('ab seed', (80, 150)),
    ('a&b company', (150, 300)),
    ('fire farms', (60, 120)),
    ('humble jungle', (60, 120)),
    ('crane city', (60, 120)),
    ('phantom fire', (60, 120)),
    ('gene traders', (60, 120)),
    ('lyme rising', (60, 120)),
    ('geo farms', (60, 120)),
    ("kali's", (60, 120)),
    ('sin city', (80, 150)),
    ('blue j', (80, 150)),
    ('geist', (60, 120)),
    ('grf', (40, 80)),
]

def parse_qty(q):
    """Returns integer seed count inside one pack. Defaults to 10 if unknown."""
    if not q or q in ('?', '—', ''):
        return 10
    m = re.search(r'(\d+)', str(q))
    return int(m.group(1)) if m else 10

def est_price(breeder_raw, seed_type, notes='', seed_count=10, name=''):
    """Per-pack USD range. Adjust for seed count, seed type, and flags."""
    b = (breeder_raw or '').lower()
    n = (name or '').lower()
    base_low, base_high = 70, 130
    for prefix, rng in PRICE_MAP:
        if prefix in b:
            base_low, base_high = rng
            break
    if 'tester' in (notes or '').lower():
        return 0, 40
    if 'freebie' in (notes or '').lower():
        return 0, 30
    # S1 / hype / Bx premiums
    st = (seed_type or '').upper()
    if 'S1' in st or 's1' in n:
        base_low = int(base_low * 1.1)
        base_high = int(base_high * 1.2)
    if 'bx3' in n or 'bx' in n:
        base_low = int(base_low * 1.1)
        base_high = int(base_high * 1.2)
    # Auto discount
    if 'AUTO' in st:
        base_low = int(base_low * 0.85)
        base_high = int(base_high * 0.85)
    # Seed-count modifier: 6 seeds = baseline; 10 = +10%; 18+ = +25%; 36 = +45%
    if seed_count <= 6:
        mult = 1.0
    elif seed_count <= 10:
        mult = 1.10
    elif seed_count <= 15:
        mult = 1.20
    elif seed_count <= 20:
        mult = 1.30
    elif seed_count <= 30:
        mult = 1.40
    else:
        mult = 1.50
    return int(base_low * mult), int(base_high * mult)

# ──────────────────────────────────────────────────────────────
# Rarity rating (1–5)
# ──────────────────────────────────────────────────────────────
# 5 = Legendary (hype limited drops, sought-after S1 releases, A&B sealed
#     pendant boxes, Ethos Bx projects, Cult Classics rare, Savage hype)
# 4 = Rare (craft FEM from top-tier, limited runs, tester packs)
# 3 = Uncommon (established craft breeders, regular line drops)
# 2 = Common (widely available Cookies Fam / commercial fem)
# 1 = Commercial / unknown (unsigned, bulk, craft unknowns)
HYPE_KEYWORDS = [
    ('a&b company',           5, 'sealed boutique release with authentication'),
    ('cult classics',         4, 'limited craft drops; Freshies line sought after'),
    ('cookies fam',           4, 's1 self releases command premium'),
    ('ethos',                 4, 'hype Bx projects and OGDLUX line'),
    ('savage',                4, 'frost-heavy craft fem'),
    ('tiki madman',           4, 'connoisseur cup winner, tissue-culture stable'),
    ('covert',                4, 'Colorado craft breeder, limited distribution'),
    ('in house',              4, 'GSRH line highly sought; small-batch'),
    ('exotic genetix',        3, 'established craft breeder'),
    ('mephisto',              3, 'autoflower legend, reserva line premium'),
    ('bloom seed co',         3, 'tropical terp specialist'),
    ('envy genetics',         3, 'BlowPops line, Long Beach craft'),
    ('ab seed',               3, 'craft goat-cheese cross'),
    ('phantom fire',          3, 'craft pheno-hunt'),
    ('geist',                 2, 'craft unknown'),
    ('crane city',            2, 'craft unknown'),
    ('fire farms',            2, 'craft unknown'),
    ('humble jungle',         2, 'craft unknown'),
    ('gene traders',          2, 'craft unknown'),
    ('lyme rising',           2, 'craft unknown'),
    ('geo farms',             2, 'craft unknown'),
    ("kali's",                2, 'craft unknown'),
    ('sin city',              2, 'established commercial'),
    ('grf',                   1, 'unsigned / craft unknown'),
]
HYPE_STRAIN_BONUS = {
    'gushers s1': 5,
    'runtz s1': 4,
    'cement shoes': 5,   # sealed Bx3 S1 — highly sought
    'ogdlux': 5,         # Ethos Bx3 — legend
    'fresh baked': 5,    # Cult Classics hype drop
    'jurassic kush': 5,  # A&B sealed with glass pendant
    'drive thru wedding': 4,
    'envy pop rocks': 3,
    'dinosaur biscuits': 5,  # A&B sealed
    'grandmas pajamas': 4,
    'freshmaker': 4,
    'hitmaker': 4,
    'sunset freshies': 4,
}

def rarity(strain):
    name = (strain.get('name') or '').lower()
    breeder = (strain.get('breeder') or '').lower()
    notes = (strain.get('notes') or '').lower()
    section = (strain.get('section') or '').upper()
    # Base from breeder tier
    score = 2
    reason = 'craft unknown'
    for kw, s, r in HYPE_KEYWORDS:
        if kw in breeder:
            score = s
            reason = r
            break
    # Strain-specific override
    for kw, s in HYPE_STRAIN_BONUS.items():
        if kw in name:
            score = max(score, s)
            break
    # Modifiers
    if 'SEALED' in section:
        score = min(5, score + 1)  # sealed preserves value
    if 'tester' in notes:
        score = min(5, max(score, 4))
    if 'freebie' in notes:
        score = max(1, score - 1)
    # Boutique handwritten sealed = bonus
    if 'a&b' in breeder and 'SEALED' in section:
        score = 5
    # Clamp
    score = max(1, min(5, score))
    return score, reason

# ──────────────────────────────────────────────────────────────
# Strain bud-image mapping
# ──────────────────────────────────────────────────────────────
# Maps strain name → local strain-img file. If the exact strain isn't in
# our fetched set, fall back to a representative parent in the lineage.
IMG_DIR = SITE / 'strain-img'
AVAILABLE = {p.stem for p in IMG_DIR.glob('*.jpg')} if IMG_DIR.exists() else set()

STRAIN_IMG_MAP = {
    'Covert Boats & Hoes':             ('grease-monkey',    True),   # G-Walk parent (Florida OG × Grease Monkey)
    'Tiki Madman Space Runtz':         ('space-runtz',      False),
    'GSRH (Garlic Sherb)':             ('garlic-sherbet',   False),
    'Drive Thru Wedding':              ('wedding-cake',     True),
    'Envy Pop Rocks':                  ('fruity-pebbles',   True),
    'Gushers S1':                      ('gushers',          False),
    'Runtz S1':                        ('runtz',            False),
    'Cult Classic Fresh Baked':        ('ogkb',             True),
    'Cement Shoes S1':                 ('cement-shoes',     False),
    'Ethos OGDLUX':                    ('ogkb',             True),
    'Freshmaker':                      ('ogkb',             True),
    'Savage Jr Mintz':                 ('runtz',            True),
    'Cloud Spin':                      (None,               False),
    'ABSeed Goat Cheese':              (None,               False),
    'S. Orange Pucker':                (None,               False),
    'Grandmas Pajamas':                (None,               False),
    'O. Cookie Violence':              ('biscotti',         True),
    'Jurassic Kush':                   (None,               False),
    'N. Speckley Boogie':              (None,               False),
    'Bloom Guava Barz':                ('guava-cake',       True),
    'Nephisto MBAP (ManBearAlienPig)': (None,               False),
    'G. Classics Hitmaker':            ('motor-breath',     True),
    'Sunset Freshies':                 ('sunset-sherbert',  True),
    'GSRH Yahemi':                     (None,               False),
    'Exotic Greezy Runtz':             ('grease-monkey',    True),
    'Crane City S. Socker / The Zit':  ('zkittlez',         True),
    'Envy Grape Blow':                 ('grape-blow',       False),
    'Geist Kushmints × Banana06':      (None,               False),
    'Exotic Runtz S1':                 ('runtz',            False),
    'Ethos GMOZ × Runtz':              ('gmo-cookies',      True),
    'Envy Weedies':                    (None,               False),
    'Wilmeac / Wilmaaa':               ('fruity-pebbles',   True),
    'Savage Acai Gelato × Hooliganz':  (None,               False),
    'Ethos FPOG':                      ('forbidden-fruit',  True),
    'Fire Farms Fro OGLB (FRO GKB v2.17)': ('ogkb',         True),
    'GRF GMOZ':                        ('gmo',              True),
    'Animal Kush CBD (CBP)':           (None,               False),
    'Grapaya Drip':                    (None,               False),
    'Sin City Blue Zu':                (None,               False),
    'Titanium Jack × B-Side':          (None,               False),
    'Papaya F2':                       ('papaya',           False),
    'The Hydra':                       (None,               False),
    'Dinosaur Biscuits':               ('biscotti',         True),
    'Copper Sunset':                   ('sunset-sherbert',  True),
    "Kali's Cookies":                  ('tropicana-cookies',True),
    'The A Frame':                     (None,               False),
}

def strain_image(name):
    slug, is_lineage = STRAIN_IMG_MAP.get(name, (None, False))
    if slug and slug in AVAILABLE:
        return f'strain-img/{slug}.jpg', is_lineage
    return None, False

# ──────────────────────────────────────────────────────────────
# Lineage tags / phenotype
# ──────────────────────────────────────────────────────────────
LINEAGE_MAP = {
    'Runtz family':      ['runtz', 'zkittlez × gelato'],
    'Zkittlez':          ['zkittlez'],
    'Gelato':            ['gelato'],
    'OGKB':              ['ogkb', 'og kush breath'],
    'Cookies / GSC':     ['cookies', 'gsc', 'girl scout', 'forum cut'],
    'OG Kush':           ['og kush', 'triangle kush', 'josh d', 'sfv', 'hells angels'],
    'Chem / Diesel':     ['chem brulée', 'chem d', 'chem brulee', 'diesel', 'motor breath', 'motorbreath', 'copper chem'],
    'Sherbet':           ['sherbet', 'sherb', 'sunset strip'],
    'Biscotti':          ['biscotti'],
    'Freshies (CC)':     ['freshies', 'fresh baked', 'sunset freshies', 'hitmaker'],
    'BlowPops (Envy)':   ['blowpops', 'blow pops'],
    'GMO / Garlic':      ['gmo', 'garlic', 'gmoz'],
    'Wedding Cake':      ['wedding cake', 'triangle mints'],
    'Kush Mints':        ['kush mints', 'animal mints'],
    'Animal Cookies':    ['animal cookies'],
    'Haze':              ['haze'],
    'Papaya / Guava':    ['papaya', 'guava', 'guavaz'],
    'Forbidden Fruit':   ['forbidden fruit', 'fpog', 'cherry pie', 'tangie'],
    'Stankasaurus':      ['stankasaurus'],
    'Kush (Hindu/OG)':   ['hindu kush'],
    'Bubba Kush':        ['bubba kush'],
    'CBD':               ['cbd'],
    'Fruity Pebbles':    ['fruity pebbles', 'fpog'],
    'Grape':             ['grape pie', 'grape blow'],
    'Skunk':             ['skunk'],
    'Landrace / Heritage': ['mendo purps', 'sfv og'],
    'Banana':            ['banana'],
    "Ripley's OG":       ["ripley's", '3 bears og'],
    'Acai':              ['acai'],
}

def lineage_tags(strain):
    hay = ' '.join([
        strain.get('name',''), strain.get('breeder',''),
        strain.get('genetics',''), strain.get('profile',''),
        strain.get('notes',''),
    ]).lower()
    tags = set()
    for tag, terms in LINEAGE_MAP.items():
        if any(t in hay for t in terms):
            tags.add(tag)
    st = (strain.get('seedType') or '').upper()
    if 'AUTO' in st: tags.add('Autoflower')
    if 'S1' in st or 'self' in hay: tags.add('S1 (self)')
    if 'FEM' in st: tags.add('Feminized')
    return sorted(tags)

def phenotype(strain):
    text = (strain.get('profile','') + ' ' + strain.get('notes','')).lower()
    if 'indica-dominant' in text or 'indica dom' in text or 'indica-leaning' in text: return 'Indica-leaning'
    if 'sativa-dominant' in text or 'sativa dom' in text or 'sativa-leaning' in text: return 'Sativa-leaning'
    if 'balanced hybrid' in text or 'balanced' in text: return 'Balanced hybrid'
    if 'hybrid' in text: return 'Hybrid'
    if 'auto' in (strain.get('seedType','') or '').lower(): return 'Autoflower'
    return 'Hybrid'

# ──────────────────────────────────────────────────────────────
# URL helpers
# ──────────────────────────────────────────────────────────────
def clean_breeder(breeder):
    if not breeder: return ''
    b = re.sub(r'\([^)]*\)', '', breeder)
    b = re.split(r'\s+[/]\s+|\s+—\s+', b)[0]
    return re.sub(r'\s+', ' ', b).strip()

def clean_name(name):
    n = re.sub(r'[\[\](){}]', '', name or '')
    n = re.sub(r'\s*[×x]\s*', ' x ', n)
    return re.sub(r'\s+', ' ', n).strip()

def seedfinder_url(name, breeder):
    # DuckDuckGo !ducky redirect → direct seedfinder strain page (bypasses bot wall)
    s = clean_name(name); b = clean_breeder(breeder)
    q = f'{s} {b} site:seedfinder.eu'.strip()
    return f'https://duckduckgo.com/?q=%21ducky+{urllib.parse.quote_plus(q)}'

def genetics_search_url(name, breeder):
    s = clean_name(name); b = clean_breeder(breeder)
    q = f'{s} {b} cannabis strain genetics lineage'.strip()
    return f'https://www.google.com/search?q={urllib.parse.quote_plus(q)}'

# ──────────────────────────────────────────────────────────────
# Enhance each strain
# ──────────────────────────────────────────────────────────────
grand_low, grand_high = 0, 0
for s in data['strains']:
    seed_count = parse_qty(s.get('quantity'))
    s['seedsPerPack'] = seed_count
    s['packCount'] = 1  # one physical pack per entry (verified by pack photos)

    lo, hi = est_price(s.get('breeder'), s.get('seedType'), s.get('notes'), seed_count, s.get('name'))
    s['estPerPackLow'] = lo
    s['estPerPackHigh'] = hi
    s['estTotalLow'] = lo * s['packCount']
    s['estTotalHigh'] = hi * s['packCount']
    s['estMid'] = (s['estTotalLow'] + s['estTotalHigh']) // 2
    s['pricePerSeedLow'] = round(lo / max(seed_count,1), 2)
    s['pricePerSeedHigh'] = round(hi / max(seed_count,1), 2)

    rscore, rreason = rarity(s)
    s['rarity'] = rscore
    s['rarityReason'] = rreason

    s['breederUrl'] = breeder_url(s.get('breeder'))
    s['seedfinderUrl'] = seedfinder_url(s.get('name'), s.get('breeder'))
    s['geneticsSearchUrl'] = genetics_search_url(s.get('name'), s.get('breeder'))
    s['lineageTags'] = lineage_tags(s)
    s['phenoType'] = phenotype(s)
    img, is_lineage = strain_image(s.get('name'))
    s['strainImage'] = img
    s['strainImageIsLineage'] = is_lineage

    grand_low += s['estTotalLow']
    grand_high += s['estTotalHigh']

# ──────────────────────────────────────────────────────────────
# Meta updates
# ──────────────────────────────────────────────────────────────
data['meta']['valuation'] = {
    'currency': 'USD',
    'totalLow': grand_low,
    'totalHigh': grand_high,
    'totalMid': (grand_low + grand_high) // 2,
    'disclaimer': 'Per-pack retail estimates — each pack contains the listed seed count (x10 = 10 seeds in 1 pack). Ranges reflect breeder tier, S1/Bx/auto modifier, and seed-count scaling. Sealed boutique releases (A&B Company, Cult Classics limited, Ethos Bx) trade higher; testers/freebies near zero.',
}
all_tags = set()
for s in data['strains']:
    for t in s['lineageTags']: all_tags.add(t)
data['meta']['lineageTags'] = sorted(all_tags)
data['meta']['phenoTypes'] = sorted({s['phenoType'] for s in data['strains']})
data['meta']['rarityScale'] = {
    5: 'Legendary — sealed boutique, hype Bx, sought-after S1 drops',
    4: 'Rare — top-tier craft FEM, limited runs, tester packs',
    3: 'Uncommon — established craft breeder line drops',
    2: 'Common — widely available craft fem',
    1: 'Commercial — unsigned / bulk',
}

with open(SITE / 'strains.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

strains_with_imgs = sum(1 for s in data['strains'] if s['strainImage'])
print(f'Valuation: ${grand_low:,} – ${grand_high:,} (mid ${(grand_low+grand_high)//2:,})')
print(f'Strains with bud image: {strains_with_imgs}/{len(data["strains"])}')
print(f'Lineage tags: {len(all_tags)}')
rarity_counts = {}
for s in data['strains']:
    rarity_counts[s['rarity']] = rarity_counts.get(s['rarity'],0) + 1
print(f'Rarity distribution: {dict(sorted(rarity_counts.items()))}')
