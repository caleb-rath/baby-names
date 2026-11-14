# Groups spelling variants (Aiden / Aidan / Ayden) so they share one card.
import re, unicodedata

# Pairs that look like spellings of each other but are different names.
NOT_VARIANTS = {frozenset(p) for p in [
    ('Maria', 'Mariah'), ('Mary', 'Marie'), ('Ana', 'Anna'), ('Jon', 'John'), ('Lea', 'Leah'), ('Ella', 'Ela'),
    ('Elisa', 'Eliza'), ('Kristen', 'Kristin'), ('Lena', 'Lina'), ('Aria', 'Ariah'), ('Aran', 'Aaron'),
    ('Marion', 'Maryann'), ('Marian', 'Maryann'), ('Mariann', 'Marion'), ('Ruben', 'Rubin'), ('Aylin', 'Aileen'),
    ('Arya', 'Aria'), ('Ami', 'Amy'), ('Emi', 'Emmy'), ('Brook', 'Brooke'),
]}

def slug(n):
    return ''.join(c for c in unicodedata.normalize('NFKD', n.lower()) if c.isalpha())

def sound_key(name):
    s = slug(name)
    s = s.replace('ph', 'f').replace('ck', 'k').replace('q', 'k').replace('x', 'ks').replace('y', 'i')
    s = re.sub(r'c(?=[aou]|$|[^eih])', 'k', s)
    s = re.sub(r'(?<=[aeiou])h$', '', s)        # Sarah/Sara, Hannah/Hanna
    s = re.sub(r'([^aeiou])\1+', r'\1', s)      # Collin/Colin, Hannah/Hanah (consonants only, so Brook != Brock)
    s = re.sub(r'(?<=.)[aeiou]n$', 'n', s)      # Aidan/Aiden, Devin/Devon, Allan/Allen
    s = re.sub(r'(?<=.)[aeiou]r$', 'r', s)      # Tyler/Tylor, Taylor/Tayler
    s = re.sub(r'(eigh|ie|ee|ey|ei)$', 'i', s)  # Kylie/Kyleigh/Kylee, Bailey/Bailee
    return s

def compatible(g1, g2):
    return g1 == g2 or 'N' in (g1, g2)

def group_variants(entries):
    """entries: list of dict(name, gender, births). Returns {canonical_name: [variant names]}, most-given spelling first."""
    by_key = {}
    for e in sorted(entries, key=lambda e: -e['births']):
        by_key.setdefault(sound_key(e['name']), []).append(e)
    out = {}
    for es in by_key.values():
        head = es[0]
        alts = [e['name'] for e in es[1:] if compatible(head['gender'], e['gender']) and frozenset((head['name'], e['name'])) not in NOT_VARIANTS]
        out[head['name']] = alts
        for e in es[1:]:
            if e['name'] not in alts:
                out[e['name']] = []
    return out
