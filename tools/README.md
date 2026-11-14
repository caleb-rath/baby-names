# Rebuilding the name list

`src/data/names.ts` is generated in two steps.

```
pip install rdata pandas
curl -L -o babynames.rda https://raw.githubusercontent.com/hadley/babynames/master/data/babynames.rda
python -c "import rdata; d=rdata.read_rda('babynames.rda')['babynames']; d[d.year>=2010].to_csv('ssa/recent.csv', index=False); d.to_csv('ssa/all.csv', index=False)"
# 2015, 2023 and 2024 top-1000 lists (`ssa/boy_2024.json` etc.): https://github.com/aruljohn/popular-baby-names (save as ssa/{boy,girl}_{2015,2023,2024}.json)

python tools/build-names.py <old names.ts> ssa src/data/names.ts   # step 1: the original curated list (+ extra.py)
python tools/expand.py ssa                                          # step 2: adds names from tools/meanings/*.txt
```

## Adding names
To add names to the current list without regenerating it (safest: existing rows and ids are left alone):
```
python tools/add-names.py ssa tools/meanings/m6.txt
```
Same line format as below; a 4th field (`M`, `F` or `N`) sets the gender by hand.

To rebuild from scratch, add a line to any file in `tools/meanings/` and rerun both steps above:
- `Name|Origin|meaning`. Leave the meaning empty if you aren't sure; the card shows when the name was popular instead.
- `Name|=Other` puts Name on Other's card as another spelling.

`variants.py` also folds look-alike spellings automatically (Aiden / Aidan, Sarah / Sara). The spelling given to the most babies keeps the card. Add pairs that shouldn't be merged to `NOT_VARIANTS`.

Ids are slugs of the name (`josephine`), so adding rows never changes anyone's saved answers. Folding a name onto another card does change which id it uses.
