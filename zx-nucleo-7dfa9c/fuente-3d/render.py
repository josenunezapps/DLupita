import sys, base64, time, os, argparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser()
ap.add_argument('--mode',default='desk'); ap.add_argument('--w',type=int,default=1600); ap.add_argument('--h',type=int,default=900)
ap.add_argument('--ss',type=float,default=1.5); ap.add_argument('--frames',default='0'); ap.add_argument('--out',required=True)
ap.add_argument('--port',type=int,default=8765)
a=ap.parse_args()
os.makedirs(a.out,exist_ok=True)
fr=[]
for part in a.frames.split(','):
    if '-' in part:
        s,e=part.split('-'); st=1
        if ':' in e: e,st=e.split(':')
        fr+=list(range(int(s),int(e)+1,int(st)))
    else: fr.append(int(part))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':800,'height':450})
    pg.on('console', lambda m: print('CONSOLE', m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    pg.goto(f'http://127.0.0.1:{a.port}/index.html?mode={a.mode}&w={a.w}&h={a.h}&ss={a.ss}')
    pg.wait_for_function('window.ready===true', timeout=120000)
    for f in fr:
        dst=f'{a.out}/f_{f:04d}.png'
        if os.path.exists(dst): continue
        t=time.time()
        d=pg.evaluate(f'window.renderFrame({f})')
        open(dst+'.tmp','wb').write(base64.b64decode(d.split(',')[1])); os.replace(dst+'.tmp',dst)
        print(f, round(time.time()-t,2), flush=True)
    b.close()
