"""Convierte los PNG renderizados a WebP para la web.
Uso: python3 encode.py [--fill]  (--fill completa huecos con el vecino más cercano, sólo para pruebas)"""
import os, sys, glob
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
N = 540
SRC = {'d': 'raw/desk', 'm': 'raw/mob'}
DST = '../seq'
Q = {'d': 84, 'm': 82}
fill = '--fill' in sys.argv

def enc(k, i, src):
    dst = f'{DST}/{k}/{i:04d}.webp'
    if os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(src) and not fill:
        return 0
    Image.open(src).convert('RGB').save(dst, 'WEBP', quality=Q[k], method=6)
    return os.path.getsize(dst)

for k, src in SRC.items():
    os.makedirs(f'{DST}/{k}', exist_ok=True)
    have = {int(os.path.basename(p)[2:6]): p for p in glob.glob(src + '/f_*.png')}
    jobs = []
    for i in range(N):
        if i in have:
            jobs.append((k, i, have[i]))
        elif fill and have:
            j = min(have, key=lambda x: abs(x - i))
            jobs.append((k, i, have[j]))
    with ThreadPoolExecutor(2) as ex:
        list(ex.map(lambda a: enc(*a), jobs))
    tot = sum(os.path.getsize(p) for p in glob.glob(f'{DST}/{k}/*.webp'))
    print(k, len(have), 'renderizados;', len(glob.glob(f'{DST}/{k}/*.webp')), 'webp;', round(tot / 1e6, 1), 'MB')
