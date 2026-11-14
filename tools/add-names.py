# Adds names to src/data/names.ts WITHOUT regenerating it: existing rows (and their ids) stay as they are.
# Usage: python3 tools/add-names.py <ssa_dir> tools/meanings/m6.txt
#   Name|Origin|meaning   new card (empty meaning = unknown, the card shows its era instead)
#   Name|Origin|meaning|N  same, with the gender set by hand (M, F or N) instead of from SSA births
#   Name|=Other           Name goes on Other's card as another spelling (Other can be a card or one of its spellings)
# Also refreshes the 'p' tag (familiar: top 300 since 1950) on every card.
import csv, json, re, sys
from collections import defaultdict
sys.path.insert(0, 'tools')
from variants import slug
from tags import add_tags, best_ranks_since, was_common

SSA, INPUT = sys.argv[1], sys.argv[2]
NAMES_TS = 'src/data/names.ts'
src = open(NAMES_TS, encoding='utf-8').read()
GROUPS = re.findall(r"'([^']*)'", re.search(r'ORIGIN_GROUPS = \[(.*?)\] as const', src).group(1))
row_re = re.compile(r"^  \['((?:[^'\\]|\\.)*)','([MFN])','((?:[^'\\]|\\.)*)',(\d+),'((?:[^'\\]|\\.)*)',(\d+),(\d+),'(\w*)',(\d+),'((?:[^'\\]|\\.)*)'\],?$")
un = lambda s: s.replace("\\'", "'").replace('\\\\', '\\')
def q(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

lines = src.split('\n')
cards = {}  # name -> dict
for i, l in enumerate(lines):
    m = row_re.match(l)
    if m:
        n, g, o, gi, me, syl, rk, tg, pk, alts = m.groups()
        cards[un(n)] = dict(name=un(n), gender=g, origin=un(o), gi=int(gi), meaning=un(me), syl=int(syl), rank=int(rk), tags=tg,
                            peak=int(pk), alts=[un(a) for a in alts.split('|') if a], line=i)
print('existing', len(cards))
owner = {}
for n, c in cards.items():
    owner[slug(n)] = n
    for a in c['alts']: owner.setdefault(slug(a), n)

tot = defaultdict(lambda: {'F': 0, 'M': 0}); hist = defaultdict(dict)
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
for y in (2023, 2024):
    for f in ('boy', 'girl'): top |= set(json.load(open(f'{SSA}/{f}_{y}.json'))['names'])

def gender(n):
    c = recent[n] if sum(recent[n].values()) >= 200 else tot[n]
    t = c['F'] + c['M']
    if not t:  # newer than the 2017 history: go by the 2024 lists
        g = set(rank.get(n, {}))
        return next(iter(g)) if len(g) == 1 else 'N'
    return 'N' if max(c.values()) / t <= 0.65 else ('F' if c['F'] > c['M'] else 'M')

def syllables(n):
    return max(1, len(re.findall(r'[aeiouy]+', re.sub(r'e$', '', n.lower()))))

new, folds = {}, []
for line in open(INPUT, encoding='utf-8'):
    parts = line.rstrip('\n').split('|')
    if len(parts) < 2 or line.startswith('#'): continue
    if parts[1].startswith('='):
        folds.append((parts[0], parts[1][1:])); continue
    n, o, me = parts[0], parts[1], parts[2] if len(parts) > 2 else ''
    forced = parts[3] if len(parts) > 3 else ''
    if slug(n) in owner:
        print('already listed, skipped:', n, '->', owner[slug(n)]); continue
    g = forced or gender(n)
    rk = rank.get(n, {})
    v = dict(name=n, gender=g, origin=o, meaning=me, syl=syllables(n), alts=[],
             rank=(min(rk.values()) if rk else 0) if g == 'N' else rk.get(g, 0))
    best = None
    for sx in (['F', 'M'] if g == 'N' else [g]):
        h = hist.get((n, sx))
        if h:
            yr = max(h, key=h.get)
            if best is None or h[yr] > best[1]: best = (yr, h[yr])
    v['peak'] = best[0] // 10 * 10 if best else (2020 if n in top else 0)
    new[n] = v
    owner[slug(n)] = n

best_ranks = best_ranks_since(f'{SSA}/all.csv')
add_tags(new, SSA, best_ranks)
for v in new.values():
    if v['group'] not in GROUPS: sys.exit(f"{v['name']}: origin {v['origin']!r} has no group in tags.py")
    v['gi'] = GROUPS.index(v['group'])
everyone = {**cards, **new}

added_alts = 0
for a, t in folds:
    if slug(a) in owner:
        continue
    head = owner.get(slug(t))
    if not head:
        print('fold target not found, skipped:', a, '->', t); continue
    everyone[head]['alts'].append(a); everyone[head]['grew'] = True; owner[slug(a)] = head; added_alts += 1

def alts_sorted(v):  # most-given spelling first, so the card's "Also spelled" shows the familiar ones
    return sorted(dict.fromkeys(v['alts']), key=lambda a: -sum(tot[a].values()))

def row(v):
    return (f"  [{q(v['name'])},'{v['gender']}',{q(v['origin'])},{v['gi']},{q(v['meaning'])},{v['syl']},{v['rank']},"
            f"'{v['tags']}',{v['peak']},{q('|'.join(v['alts']))}],")

p_on = 0
for v in everyone.values():
    if v.get('grew'): v['alts'] = alts_sorted(v)
    tags = v['tags'].replace('p', '')
    if was_common(v, best_ranks):
        # keep the tag order c r p n v
        i = len(tags.rstrip('nv'))
        tags = tags[:i] + 'p' + tags[i:]
        p_on += 1
    v['tags'] = tags

for v in cards.values():
    lines[v['line']] = row(v)
first = min(v['line'] for v in cards.values()); last = max(v['line'] for v in cards.values())
body = sorted(everyone.values(), key=lambda v: v['name'])
lines[first:last + 1] = [row(v) for v in body]
open(NAMES_TS, 'w', encoding='utf-8').write('\n'.join(lines))
print(f'new cards {len(new)}, new spellings {added_alts}, total cards {len(everyone)}, familiar (p) {p_on}')
for v in new.values(): print(' ', row(v))
