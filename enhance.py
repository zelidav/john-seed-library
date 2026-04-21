"""Enhance strains.json with breeder URLs, seedfinder links, lineage tags, phenotype, and valuation."""
import json, urllib.parse, re
from pathlib import Path

SITE = Path(r'C:\Users\zelid\john-seed-library\site')
with open(SITE / 'strains.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Breeder → (website or IG URL)
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
    'pheno-hunter cross': None,
    'unknown / craft': None,
    'craft/unknown': None,
}

def breeder_url(breeder_raw):
    if not breeder_raw:
        return None
    b = breeder_raw.lower()
    # Try prefix matches in order of specificity
    for key in sorted(BREEDERS, key=len, reverse=True):
        if key in b:
            return BREEDERS[key]
    return None

# Est per-pack USD, keyed by breeder name prefix
PRICE_MAP = [
    ('covert genetics', (100, 200)),
    ('tiki madman', (120, 220)),
    ('in house genetics', (150, 250)),
    ('cookies fam', (150, 250)),
    ('cult classics', (100, 180)),
    ('ethos genetics', (100, 250)),
    ('savage genetics', (150, 300)),
    ('savage (testers)', (0, 50)),
    ('envy genetics', (100, 180)),
    ('bloom seed co', (100, 200)),
    ('mephisto genetics', (80, 130)),
    ('exotic genetix', (150, 300)),
    ('ab seed', (100, 180)),
    ('a&b company', (150, 300)),
    ('fire farms', (80, 150)),
    ('humble jungle', (80, 150)),
    ('crane city', (80, 150)),
    ('phantom fire', (80, 150)),
    ('gene traders', (80, 150)),
    ('lyme rising', (80, 150)),
    ('geo farms', (80, 150)),
    ("kali's", (80, 150)),
    ('sin city', (100, 200)),
    ('blue j', (100, 200)),
    ('geist', (80, 150)),
    ('grf', (50, 100)),
]

def est_price(breeder_raw, seed_type, notes=''):
    b = (breeder_raw or '').lower()
    base_low, base_high = 80, 150  # default craft range
    for prefix, rng in PRICE_MAP:
        if prefix in b:
            base_low, base_high = rng
            break
    # Tester adjustment
    if 'tester' in (notes or '').lower():
        return 0, 50
    # Freebie adjustment
    if 'freebie' in (notes or '').lower():
        return 0, 30
    # Auto slight discount
    if seed_type and 'AUTO' in seed_type.upper():
        base_low = int(base_low * 0.9)
        base_high = int(base_high * 0.9)
    return base_low, base_high

# Parse quantity (can be "10", "6+", "~7", "5–7", "?")
def parse_qty(q):
    if not q:
        return 0
    if q in ('?', '—', ''):
        return 1  # assume at least 1 pack
    m = re.search(r'(\d+)', str(q))
    return int(m.group(1)) if m else 1

# Lineage tags — map genetics/profile terms to taxonomic family tags
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
    'Autoflower':        [],  # determined from seedType
    'S1 (self)':         [],  # determined from seedType
    'Feminized':         [],
    'CBD':               ['cbd'],
    'Fruity Pebbles':    ['fruity pebbles', 'fpog'],
    'Grape':             ['grape pie', 'grape blow'],
    'Skunk':             ['skunk'],
    'Landrace / Heritage': ['mendo purps', 'sfv og'],
    'Banana':            ['banana'],
    'Bloom Seed Co':     [],
    'Ripley\'s OG':      ["ripley's", '3 bears og'],
    'Acai':              ['acai'],
}

def lineage_tags(strain):
    hay = ' '.join([
        strain.get('name',''),
        strain.get('breeder',''),
        strain.get('genetics',''),
        strain.get('profile',''),
        strain.get('notes',''),
    ]).lower()
    tags = set()
    for tag, terms in LINEAGE_MAP.items():
        if any(t in hay for t in terms):
            tags.add(tag)
    st = (strain.get('seedType') or '').upper()
    if 'AUTO' in st:
        tags.add('Autoflower')
    if 'S1' in st or 'self' in hay:
        tags.add('S1 (self)')
    if 'FEM' in st:
        tags.add('Feminized')
    return sorted(tags)

# Phenotype indicator — infer from profile text
def phenotype(strain):
    text = (strain.get('profile','') + ' ' + strain.get('notes','')).lower()
    if 'indica-dominant' in text or 'indica dom' in text or 'indica-leaning' in text:
        return 'Indica-leaning'
    if 'sativa-dominant' in text or 'sativa dom' in text or 'sativa-leaning' in text:
        return 'Sativa-leaning'
    if 'balanced hybrid' in text or 'balanced' in text:
        return 'Balanced hybrid'
    if 'hybrid' in text:
        return 'Hybrid'
    if 'auto' in (strain.get('seedType','') or '').lower():
        return 'Autoflower'
    return 'Hybrid'

# Seedfinder search URL from strain name (strip parens)
def seedfinder_url(name):
    q = re.sub(r'[\[\](){}]','', name or '')
    q = re.sub(r'\s+',' ', q).strip()
    return f'https://en.seedfinder.eu/search/?q={urllib.parse.quote(q)}'

# Enhance each strain
grand_low, grand_high = 0, 0
for s in data['strains']:
    s['breederUrl'] = breeder_url(s.get('breeder'))
    s['seedfinderUrl'] = seedfinder_url(s.get('name'))
    s['lineageTags'] = lineage_tags(s)
    s['phenoType'] = phenotype(s)
    lo, hi = est_price(s.get('breeder'), s.get('seedType'), s.get('notes'))
    qty = parse_qty(s.get('quantity'))
    s['estPerPackLow'] = lo
    s['estPerPackHigh'] = hi
    s['estTotalLow'] = lo * qty
    s['estTotalHigh'] = hi * qty
    s['packQty'] = qty
    grand_low += lo * qty
    grand_high += hi * qty

data['meta']['valuation'] = {
    'currency': 'USD',
    'totalLow': grand_low,
    'totalHigh': grand_high,
    'totalMid': (grand_low + grand_high) // 2,
    'disclaimer': 'Mid-market retail estimates based on breeder tier, seed type (REG/FEM/AUTO/S1/tester), and current craft-seed market ranges. Craft/small-batch releases vary widely; hype drops (Cookies Fam, Cult Classics limited, Ethos hype, Savage) trade higher than listed.',
}

# Compute all unique lineage tags for filter chips
all_tags = set()
for s in data['strains']:
    for t in s['lineageTags']:
        all_tags.add(t)
data['meta']['lineageTags'] = sorted(all_tags)
data['meta']['phenoTypes'] = sorted({s['phenoType'] for s in data['strains']})

with open(SITE / 'strains.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'Valuation: ${grand_low:,} – ${grand_high:,} (mid ${(grand_low+grand_high)//2:,})')
print(f'Lineage tags: {len(all_tags)}')
print(f'Phenotypes: {data["meta"]["phenoTypes"]}')
