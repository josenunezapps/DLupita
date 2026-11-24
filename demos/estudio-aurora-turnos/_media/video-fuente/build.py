import sys, os, subprocess
sys.path.insert(0, '/tmp/aurora/vid')
from scenes import *
which = sys.argv[1:]  # e.g. frames 03:2.0
if which and which[0] == 'frames':
    gt0 = 0; offs = {}
    for n, fn, dur in SCENES: offs[n] = gt0; gt0 += dur
    for spec in which[1:]:
        n, tt = spec.split(':'); tt = float(tt)
        fn = [s for s in SCENES if s[0] == n][0][1]; dur = [s for s in SCENES if s[0] == n][0][2]
        fn(tt, offs[n] + tt, dur).save(f'/tmp/aurora/vid/f_{n}_{tt}.jpg', quality=88)
        print('frame', n, tt)
    sys.exit()
os.makedirs('/tmp/aurora/vid/parts', exist_ok=True)
gt0 = 0
for n, fn, dur in SCENES:
    out = f'/tmp/aurora/vid/parts/{n}.mp4'
    if only := os.environ.get('ONLY'):
        if n not in only.split(','): gt0 += dur; continue
    tmp = out + '.tmp.mp4'
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', tmp], stdin=subprocess.PIPE)
    nf = int(round(dur * FPS))
    for i in range(nf):
        t = i / FPS
        p.stdin.write(fn(t, gt0 + t, dur).convert('RGB').tobytes())
    p.stdin.close(); p.wait()
    if p.returncode == 0: os.replace(tmp, out)
    print('scene', n, 'ok', flush=True)
    gt0 += dur
