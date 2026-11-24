import numpy as np, wave
SR=44100; DUR=23.6; N=int(SR*DUR); t=np.arange(N)/SR
out=np.zeros(N)
def note(f): return 440*2**((f-69)/12)
# progresión Am - F - C - G (4 compases de 2.54 s ≈ 94 bpm)
prog=[[57,60,64,69],[53,57,60,65],[48,55,60,64],[55,59,62,67]]
bar=2.54
def env(n, a, r):
    e=np.ones(n); ai=min(int(a*SR),n//2); ri=min(int(r*SR),n-ai)
    e[:ai]=np.linspace(0,1,ai); e[n-ri:]*=np.linspace(1,0,ri); return e
k=0; s=0.0
while s<DUR:
    ch=prog[k%4]; n=min(int(bar*SR*1.15), N-int(s*SR)); i0=int(s*SR)
    tt=np.arange(n)/SR; e=env(n,0.6,0.9)
    for m in ch:
        f=note(m)
        w=(np.sin(2*np.pi*f*tt)+0.35*np.sin(2*np.pi*f*2.002*tt)+0.15*np.sin(2*np.pi*f*0.5*tt))*e*0.045
        out[i0:i0+n]+=w
    # bajo
    f=note(ch[0]-12); out[i0:i0+n]+=np.sin(2*np.pi*f*tt)*env(n,0.05,0.8)*0.07
    # arpegio suave (corcheas)
    for j in range(8):
        a0=i0+int(j*bar/8*SR); m=ch[[0,2,1,3,2,1,3,2][j]]+12; ln=int(0.5*SR)
        if a0+ln>N: break
        tt2=np.arange(ln)/SR; f=note(m)
        out[a0:a0+ln]+=np.sin(2*np.pi*f*tt2)*np.exp(-tt2*7)*0.035
    s+=bar; k+=1
# taps y avisos
def click(at, vol=0.35):
    i=int(at*SR); ln=int(0.06*SR); tt=np.arange(ln)/SR
    if i+ln>N: return
    out[i:i+ln]+=(np.sin(2*np.pi*1800*tt)*np.exp(-tt*90)+np.random.randn(ln)*0.15*np.exp(-tt*200))*vol
def chime(at):
    for d,m in [(0,84),(0.12,88)]:
        i=int((at+d)*SR); ln=int(0.9*SR); tt=np.arange(ln)/SR
        if i+ln>N: continue
        out[i:i+ln]+=(np.sin(2*np.pi*note(m)*tt)+0.3*np.sin(2*np.pi*note(m)*2*tt))*np.exp(-tt*5)*0.16
def whoosh(at, ln=0.5):
    i=int(at*SR); n=int(ln*SR)
    if i+n>N: return
    nz=np.random.randn(n); nz=np.convolve(nz,np.ones(30)/30,'same')
    out[i:i+n]+=nz*np.sin(np.linspace(0,np.pi,n))*0.12
offs={'01':0,'02':3.0,'03':9.6,'04':13.5,'05':18.0}
for x in [0.5,1.15,1.95,2.8]: click(9.6+x)
chime(13.5+0.3); chime(18.0+2.55)
for sc in ['02','03','04','05']: whoosh(offs[sc]-0.1)
# fade in/out y normalizar
fi=int(0.8*SR); out[:fi]*=np.linspace(0,1,fi); fo=int(1.5*SR); out[-fo:]*=np.linspace(1,0,fo)
out=out/np.max(np.abs(out))*0.8
st=np.stack([out,np.roll(out,int(0.012*SR))*0.95],1)
with wave.open('/tmp/aurora/vid/music.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
print('ok')
