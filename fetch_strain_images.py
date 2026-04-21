import os, re, json, time, urllib.parse
from pathlib import Path
import requests
from bs4 import BeautifulSoup

OUT = Path(r'C:\Users\zelid\john-seed-library\site\strain-img')
OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}

def get_og_image(url):
    try:
        r = requests.get(url, headers=UA, timeout=15, allow_redirects=True)
        if r.status_code != 200:
            return None, f'HTTP {r.status_code}'
        soup = BeautifulSoup(r.text, 'html.parser')
        for prop in ('og:image', 'twitter:image'):
            m = soup.find('meta', property=prop) or soup.find('meta', attrs={'name': prop})
            if m and m.get('content'):
                return m['content'], None
        return None, 'no og:image'
    except Exception as e:
        return None, f'error: {e}'

def download(url, dest):
    try:
        r = requests.get(url, headers=UA, timeout=20)
        if r.status_code == 200 and len(r.content) > 2000:
            dest.write_bytes(r.content)
            return True
    except Exception as e:
        print(f'  ! download error: {e}')
    return False

def try_strain(display_name, slug_hint, breeder):
    dest = OUT / f'{slug_hint}.jpg'
    if dest.exists():
        print(f'  [cached] {slug_hint}')
        return 'cached'
    # 1. Leafly
    leafly_slugs = list(dict.fromkeys([slug_hint, slug_hint.replace('_', '-'), re.sub(r'-+', '-', slug_hint)]))
    for s in leafly_slugs:
        u = f'https://www.leafly.com/strains/{s}'
        img, err = get_og_image(u)
        if img and 'leafly' in img and 'default' not in img.lower():
            if download(img, dest):
                print(f'  [leafly] {s}')
                return 'leafly'
        elif err and 'HTTP' in err and err != 'HTTP 404':
            print(f'  ! leafly {s}: {err}')
    # 2. Seedfinder
    if breeder:
        breeder_variants = list(dict.fromkeys([
            breeder.replace(' ', '_'),
            re.sub(r'[^\w]+', '_', breeder).strip('_'),
            breeder.replace(' ', '_') + '_Genetics',
            breeder.replace(' ', '_').replace('_Genetics_Genetics', '_Genetics'),
        ]))
        strain_variants = list(dict.fromkeys([
            display_name.replace(' ', '_'),
            re.sub(r'[^\w]+', '_', display_name).strip('_'),
        ]))
        for sv in strain_variants:
            for bv in breeder_variants:
                u = f'https://en.seedfinder.eu/strain-info/{sv}/{bv}/'
                img, err = get_og_image(u)
                if img and 'seedfinder' not in img.split('/')[-1].lower().replace('seedfinder_logo','')[:20]:
                    if 'logo' in img.lower() or 'no_pic' in img.lower():
                        continue
                    if download(img, dest):
                        print(f'  [seedfinder] {sv}/{bv}')
                        return 'seedfinder'
    # 3. AllBud
    for cat in ('hybrid', 'indica', 'sativa'):
        u = f'https://www.allbud.com/marijuana-strains/{cat}/{slug_hint}'
        img, err = get_og_image(u)
        if img and 'allbud' in img and 'logo' not in img.lower():
            if download(img, dest):
                print(f'  [allbud] {slug_hint}')
                return 'allbud'
    print(f'  [NO MATCH] {display_name}')
    return None

STRAINS = [
    ('Gushers', 'gushers', 'Cookies Fam'),
    ('Runtz', 'runtz', 'Cookies Fam'),
    ('Space Runtz', 'space-runtz', 'Tiki Madman'),
    ('GMO', 'gmo', 'Divine Genetics'),
    ('Garlic Sherbet', 'garlic-sherbet', 'In House Genetics'),
    ('Wedding Cake', 'wedding-cake', 'Seed Junky Genetics'),
    ('Fruity Pebbles OG', 'fruity-pebbles', None),
    ('Ethos OGKB', 'ogkb', 'Ethos'),
    ('Cement Shoes', 'cement-shoes', 'Universally Seeded'),
    ('Kush Mints', 'kush-mints', 'Seed Junky Genetics'),
    ('Guava Cake', 'guava-cake', 'Bloom Seed Co'),
    ('ManBearAlienPig', 'manbearalienpig', 'Mephisto Genetics'),
    ('Motor Breath', 'motor-breath', None),
    ('Sunset Sherbet', 'sunset-sherbert', None),
    ('Grease Monkey', 'grease-monkey', 'Exotic Genetix'),
    ('Zkittlez', 'zkittlez', 'Terp Hogz'),
    ('Grape Pie', 'grape-pie', 'Cannarado Genetics'),
    ('Kushmints', 'kushmints', None),
    ('Forbidden Fruit', 'forbidden-fruit', None),
    ('GMO Cookies', 'gmo-cookies', 'Divine Genetics'),
    ('Acai Gelato', 'acai-gelato', None),
    ('Papaya', 'papaya', 'Nirvana'),
    ('Goat Cheese', 'goat-cheese', None),
    ('Biscotti', 'biscotti', 'Cookies Fam'),
    ('Animal Kush', 'animal-kush', None),
    ('Tropicana Cookies', 'tropicana-cookies', None),
    ('Jurassic Kush', 'jurassic-kush', None),
    ('Hitmaker', 'hitmaker', 'Cult Classics Seeds'),
    ('Freshmaker', 'freshmaker', 'Cult Classics Seeds'),
    ('Fresh Baked', 'fresh-baked', 'Cult Classics Seeds'),
    ('Sunset Freshies', 'sunset-freshies', 'Cult Classics Seeds'),
    ('Grape Blow', 'grape-blow', 'Envy Genetics'),
    ('Pop Rocks', 'pop-rocks', 'Envy Genetics'),
    ('Weedies', 'weedies', 'Envy Genetics'),
    ('Wilmaaa', 'wilmaaa', 'Envy Genetics'),
    ('The Zit', 'the-zit', 'Crane City'),
    ('Dinosaur Biscuits', 'dinosaur-biscuits', None),
    ('Copper Sunset', 'copper-sunset', None),
    ('The Hydra', 'the-hydra', None),
    ('Sin City', 'blue-zu', 'Sin City'),
]

results = {}
for name, slug, breeder in STRAINS:
    print(f'\n[{name}] -> {slug}.jpg')
    results[slug] = try_strain(name, slug, breeder)
    time.sleep(0.4)

print('\n=== SUMMARY ===')
for k,v in results.items():
    print(f'{k}: {v}')
ok = sum(1 for v in results.values() if v)
print(f'\n{ok}/{len(results)} found')
missing = [k for k,v in results.items() if not v]
print(f'MISSING: {missing}')
