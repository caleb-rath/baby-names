# Adds pack tags to the generated names. Run after build.py logic; imported by build.py.
import csv, json
from collections import defaultdict

GROUPS = {
  'English': ['English', 'American', 'Anglo-Saxon', 'Cornish'],
  'Celtic': ['Irish', 'Scottish', 'Welsh', 'Celtic', 'Breton'],
  'Hebrew & Biblical': ['Hebrew', 'Aramaic', 'Yiddish', 'Babylonian'],
  'Greek & Latin': ['Greek', 'Latin', 'Roman'],
  'Germanic & Nordic': ['Germanic', 'German', 'Norse', 'Scandinavian', 'Dutch', 'Swedish', 'Danish', 'Finnish'],
  'French & Italian': ['French', 'Italian'],
  'Spanish & Latino': ['Spanish', 'Basque', 'South American', 'Zapotec', 'Catalan'],
  'South Asian': ['Sanskrit', 'Tamil', 'Hindi'],
  'East Asian': ['Japanese', 'Chinese', 'Korean', 'Filipino', 'Vietnamese'],
  'Middle Eastern': ['Arabic', 'Persian', 'Turkish', 'Armenian', 'Egyptian'],
  'African': ['Amharic', 'Hausa', 'Swahili', 'Yoruba', 'Igbo', 'Kikuyu', 'African', 'Ghanaian', 'Ethiopian', 'Shona', 'Sotho', 'West African'],
  'Slavic': ['Slavic', 'Russian', 'Polish', 'Czech', 'Lithuanian'],
  'Indigenous & Pacific': ['Hawaiian', 'Native American', 'Cherokee', 'Algonquian', 'Sioux', 'Australian Aboriginal', 'Maya', 'Nahuatl', 'Guarani', 'Ojibwe', 'Choctaw'],
}
ORIGIN_TO_GROUP = {o: g for g, os in GROUPS.items() for o in os}

NATURE = set('''River Willow Ivy Rose Lily Hazel Violet Daisy Poppy Iris Jasmine Magnolia Dahlia Fern Briar Clover Juniper Sage Rowan Aspen Cedar Oak Ash Forest Wren Robin Lark Sparrow Dove Fox Bear Wolf Hawk Reed Brook Lake Ocean Sky Rain Storm Stone Flint Jasper Jade Pearl Ruby Opal Coral Amber Garnet Indigo Autumn Summer Winter June April May Dawn Luna Stella Aurora Sol Sunny Marigold Primrose Heather Holly Laurel Olive Meadow Sierra Linden Alder Birch Elm Maple Bay Reef Ember Phoenix Nova Orion Skye Lavender Saffron Rosemary Yarrow Flora Fauna Blossom Basil Bryony Calla Lotus Lyra Wilder'''.split())
VIRTUE = set('''Faith Hope Grace Joy Mercy Patience Charity Honor Justice Liberty Verity Constance Felicity Serenity Harmony Trinity Destiny Prudence Temperance Clementine Noble True Valor Blessing Amity Unity Haven Journey Bliss Promise Trust Glory Loyal Story Love Lovely Precious Gentle Brave'''.split())

def load_history(path):
    by = defaultdict(lambda: defaultdict(float))  # (name, sex) -> year -> prop
    tot = defaultdict(int)
    with open(path) as f:
        for r in csv.DictReader(f):
            k = (r['name'], r['sex'])
            by[k][int(float(r['year']))] = float(r['prop'])
            tot[k] += int(float(r['n']))
    return by, tot

def ranks(path):
    out = {}
    for g, f in (('M', 'boy'), ('F', 'girl')):
        for i, n in enumerate(json.load(open(f'{path}_{f}.json'))['names'], 1):
            out.setdefault(n, {})[g] = i
    return out

def add_tags(out, ssa_dir):
    hist, tot = load_history(f'{ssa_dir}/all.csv')
    r15 = {}
    for g, f in (('M', 'boy'), ('F', 'girl')):
        for i, n in enumerate(json.load(open(f'{ssa_dir}/{f}_2015.json'))['names'], 1):
            r15.setdefault(n, {})[g] = i
    for v in out.values():
        n, g = v['name'], v['gender']
        sexes = ['F', 'M'] if g == 'N' else [g]
        tags = []
        # Era: the year this name was most popular for its sex.
        best = None
        for sx in sexes:
            h = hist.get((n, sx))
            if h:
                yr = max(h, key=h.get)
                if best is None or h[yr] > best[1]:
                    best = (yr, h[yr], tot[(n, sx)])
        if best and 1905 <= best[0] <= 1965 and best[2] >= 20000:
            tags.append('c')  # family classic
        # Rising: climbed 100+ places since 2015, or entered the top 1000.
        now = v['rank']
        then = min((r15.get(n, {}).get(sx, 0) or 9999) for sx in sexes)
        if now and (then == 9999 or then - now >= 100):
            tags.append('r')
        if n in NATURE: tags.append('n')
        if n in VIRTUE: tags.append('v')
        v['tags'] = ''.join(tags)
        first = v['origin'].split('/')[0].strip()
        v['group'] = ORIGIN_TO_GROUP.get(first, 'Other')
