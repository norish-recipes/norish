"""Ticket 16's proposed rule over words-parents.ts's parents.json: which unsure words-parents are safe."""
import json, sys

FORMS = set("""blokjes blokken roosjes chunks cubes cube bits pieces stukjes stukken plakjes slices strips reepjes
spears wedges partjes sticks stick fillet filet filets fillets loins mince gehakt pearls bolletjes curls friet fries
peulen boontjes broodjes loaf hapjes zest sheets vellen""".split())
SIZES = set("mini large small groot grote klein kleine medium jumbo".split())
NOTES = set("for voor naar uit to om circa ca bijv bv op per".split())

def safe(x):
    if not x.get('parentFirst'): return False
    after = x['rest'].split()
    if not after: return True
    if after[0] in NOTES: return True
    return all(w in FORMS or w in SIZES for w in after)


rows = [x for x in json.load(open(sys.argv[1])) if not x["sure"]]
print(sum(safe(x) for x in rows), "of", len(rows), "unsure words-parents are safe")
