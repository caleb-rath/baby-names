# Adds names from SSA data to src/data/names.ts, folds spelling variants onto one card, and records each name's peak decade.
# Usage: python3 tools/expand.py <ssa_dir>   (ssa_dir holds all.csv, recent.csv, {boy,girl}_{2015,2023,2024}.json)
# Hand-written meanings for added names live in tools/meanings/*.txt as  Name|Origin|meaning
#   empty meaning = not sure, the app shows the name's era instead;  Name|=Other  folds Name onto Other as a spelling.
import csv, glob, json, re, sys
from collections import defaultdict
sys.path.insert(0, 'tools')
from variants import group_variants, slug
from tags import add_tags

SSA = sys.argv[1]
NAMES_TS = 'src/data/names.ts'

src = open(NAMES_TS, encoding='utf-8').read()
groups_ts = re.search(r'ORIGIN_GROUPS = \[(.*?)\] as const', src).group(1)
GROUPS = re.findall(r"'([^']*)'", groups_ts)
row_re = re.compile(r"^\s*\['((?:[^'\\]|\\.)*)','([MFN])','((?:[^'\\]|\\.)*)',(\d+),'((?:[^'\\]|\\.)*)',(\d+),(\d+),'(\w*)'", re.M)
un = lambda s: s.replace("\\'", "'")
entries = {}
for n, g, o, gi, me, syl, rk, tg in row_re.findall(src):
    entries[un(n)] = dict(name=un(n), gender=g, origin=un(o), meaning=un(me), syl=int(syl), alts=[])
print('existing', len(entries))

tot = defaultdict(lambda: {'F': 0, 'M': 0})
hist = defaultdict(dict)
for r in csv.DictReader(open(f'{SSA}/all.csv')):
    tot[r['name']][r['sex']] += int(float(r['n']))
    hist[(r['name'], r['sex'])][int(float(r['year']))] = float(r['prop'])
recent = defaultdict(lambda: {'F': 0, 'M': 0})
for r in csv.DictReader(open(f'{SSA}/recent.csv')):
    recent[r['name']][r['sex']] += int(r['n'])
rank = {}
for g, f in (('M', 'boy'), ('F', 'girl')):
    for i, n in enumerate(json.load(open(f'{SSA}/{f}_2024.json'))['names'], 1):
        rank.setdefault(n, {})[g] = i
top = set()
for f in glob.glob(f'{SSA}/*_2024.json') + glob.glob(f'{SSA}/*_2023.json'):
    top |= set(json.load(open(f))['names'])

def ssa_gender(n):
    c = recent[n] if sum(recent[n].values()) >= 200 else tot[n]
    t = c['F'] + c['M']
    if not t: return 'N'
    return 'N' if max(c.values()) / t <= 0.65 else ('F' if c['F'] > c['M'] else 'M')

def syllables(n):
    s = re.sub(r'e$', '', n.lower())
    return max(1, len(re.findall(r'[aeiouy]+', s)))

# Hand-written additions.
folds = {}
for path in sorted(glob.glob('tools/meanings/*.txt')):
    for line in open(path, encoding='utf-8'):
        parts = line.rstrip('\n').split('|')
        if len(parts) < 3 or parts[1] == 'SKIP': continue
        n, o, me = parts[0], parts[1], parts[2]
        if me.startswith('='):
            folds[n] = me[1:]; continue
        if n in entries: continue
        entries[n] = dict(name=n, gender=ssa_gender(n), origin=o, meaning=me, syl=syllables(n), alts=[])
by_slug = {slug(n): n for n in entries}

missing = sorted({t for t in folds.values() if slug(t) not in by_slug})
if missing: print('fold targets not in the list (folded name kept as its own card):', missing)
for a, t in folds.items():
    if slug(t) in by_slug:
        entries[by_slug[slug(t)]]['alts'].append(a)
        entries.pop(a, None)
    elif a not in entries and t not in entries:
        entries[a] = dict(name=a, gender=ssa_gender(a), origin='', meaning='', syl=syllables(a), alts=[])

# Automatic spelling variants (Aiden / Aidan / Ayden): the most-given spelling keeps the card.
births = lambda n: sum(tot[n].values())
grouped = group_variants([dict(name=n, gender=v['gender'], births=births(n)) for n, v in entries.items()])
folded = 0
for head, alts in grouped.items():
    for a in alts:
        if a in entries and head in entries:
            entries[head]['alts'] += [a] + entries[a]['alts']
            if not entries[head]['meaning'] and entries[a]['meaning']:
                entries[head]['meaning'], entries[head]['origin'] = entries[a]['meaning'], entries[a]['origin']
            del entries[a]; folded += 1
print('auto-folded', folded)

# Rank, peak decade, tags.
for n, v in entries.items():
    g = v['gender']
    rk = {**rank.get(n, {})}
    for a in v['alts']:  # a variant that ranks better counts for the card
        for sx, r_ in rank.get(a, {}).items(): rk[sx] = min(rk.get(sx, 9999), r_)
    v['rank'] = (min(rk.values()) if rk else 0) if g == 'N' else rk.get(g, 0)
    best = None
    for sx in (['F', 'M'] if g == 'N' else [g]):
        h = hist.get((n, sx))
        if h:
            yr = max(h, key=h.get)
            if best is None or h[yr] > best[1]: best = (yr, h[yr])
    v['peak'] = (best[0] // 10 * 10) if best else 0
    if not v['peak'] and n in top: v['peak'] = 2020
    v['alts'] = sorted(set(v['alts']) - {n}, key=lambda a: -births(a))[:6]
add_tags(entries, SSA)
GROUP_LIST = sorted({v['group'] for v in entries.values()} | set(GROUPS))
gi = {g: i for i, g in enumerate(GROUP_LIST)}

from collections import Counter
print('total', len(entries), Counter(v['gender'] for v in entries.values()), 'no meaning', sum(1 for v in entries.values() if not v['meaning']),
      'with spellings', sum(1 for v in entries.values() if v['alts']))

def q(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
body = ',\n'.join(
    f"  [{q(v['name'])},'{v['gender']}',{q(v['origin'])},{gi[v['group']]},{q(v['meaning'])},{v['syl']},{v['rank']},'{v['tags']}',{v['peak']},{q('|'.join(v['alts']))}]"
    for v in sorted(entries.values(), key=lambda v: v['name']))
head = src[:src.index('type R =')]
head = re.sub(r'// Generated by .*?\n(?=type R)', '', head, flags=re.S)
ts = f"""{head}// Generated by tools/build-names.py, then tools/expand.py. One row per name; ids are slugs so they stay stable.
// rank = 2024 US SSA rank (0 = outside the top 1000). Gender from US births: N when neither sex is above 65%.
// Tags: c = family classic (peaked 1905-1965), r = rising since 2015, n = nature, v = virtue.
// peak = decade the name was most popular. alts = other spellings shown on the same card. Empty meaning = unknown.
type R = [string, Gender, string, number, string, number, number, string, number, string];

export const ORIGIN_GROUPS = [{', '.join(q(g) for g in GROUP_LIST)}] as const;

const RAW: R[] = [
{body},
];

export function nameSlug(name: string): string {{
  return name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
}}

export const BABY_NAMES: BabyName[] = RAW.map(([name, gender, origin, group, meaning, syllables, rank, tags, peak, alts]) => ({{
  id: nameSlug(name),
  name,
  gender,
  origin,
  group: ORIGIN_GROUPS[group],
  meaning,
  syllables,
  rank,
  tags,
  peak,
  alts: alts ? alts.split('|') : [],
}}));

export const NAMES_BY_ID: Record<string, BabyName> = Object.fromEntries(BABY_NAMES.map((n) => [n.id, n]));

/** Other spellings point at the card that holds them, so searching "Jaxson" finds Jackson. */
export const ID_BY_SPELLING: Record<string, string> = Object.fromEntries(
  BABY_NAMES.flatMap((n) => [[n.id, n.id], ...n.alts.map((a) => [nameSlug(a), n.id])])
);
"""
open(NAMES_TS, 'w', encoding='utf-8').write(ts)
