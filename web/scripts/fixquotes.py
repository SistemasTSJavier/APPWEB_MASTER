from pathlib import Path
for p in Path('app').rglob('*.tsx'):
    t = p.read_text(encoding='utf-8')
    if '\\"' in t:
        t = t.replace('\\"', '"')
        p.write_text(t, encoding='utf-8')
        print('fixed', p)
