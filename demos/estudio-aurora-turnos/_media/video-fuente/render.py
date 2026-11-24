import sys, os, math, subprocess, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS = 1080, 1920, 30
SH = '/tmp/aurora/shots/'
GOLD = (212, 170, 118); GOLD2 = (191, 148, 98); CREAM = (244, 241, 236); MUTED = (170, 162, 152)
DMS = '/usr/share/fonts/truetype/google-fonts/ofl/dmsans/DMSans[opsz,wght].ttf'
SERIF = '/usr/share/fonts/truetype/google-fonts/ofl/gelasio/Gelasio[wght].ttf'

_fc = {}
def font(path, size, weight=None):
    k = (path, size, weight)
    if k not in _fc:
        f = ImageFont.truetype(path, size)
        if weight is not None:
            try:
                axes = f.get_variation_axes()
                vals = []
                for a in axes:
                    nm = a.get('name', b'')
                    nm = nm.decode() if isinstance(nm, bytes) else str(nm)
                    if 'eight' in nm: vals.append(weight)
                    elif 'ptical' in nm or 'opsz' in nm.lower(): vals.append(min(max(size / 2, a['minimum']), a['maximum']))
                    else: vals.append(a['default'])
                f.set_variation_by_axes(vals)
            except Exception as e:
                pass
        _fc[k] = f
    return _fc[k]

def ease(x): x = max(0, min(1, x)); return 1 - (1 - x) ** 3
def ease_io(x): x = max(0, min(1, x)); return 4 * x * x * x if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def back(x):
    x = max(0, min(1, x)); c1 = 1.4; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
def seg(t, a, b): return max(0, min(1, (t - a) / (b - a)))

_img = {}
def img(name):
    if name not in _img:
        _img[name] = Image.open(name if name.startswith('/') else SH + name + '.jpg').convert('RGB')
    return _img[name]

# ---------- background (photo, blurred, slow drift) ----------
_bgbase = None
def background(gt):
    global _bgbase
    if _bgbase is None:
        src = Image.open('/tmp/aurora/app/img/hero.jpg').convert('RGB')
        s = max(W * 1.35 / src.width, H * 1.35 / src.height)
        src = src.resize((int(src.width * s), int(src.height * s)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
        dark = Image.new('RGB', src.size, (8, 8, 8))
        _bgbase = Image.blend(src, dark, 0.80)
    bw, bh = _bgbase.size
    ox = (bw - W) / 2 + math.sin(gt * 0.11) * (bw - W) / 2.2
    oy = (bh - H) / 2 + math.cos(gt * 0.08) * (bh - H) / 2.4
    bg = _bgbase.crop((int(ox), int(oy), int(ox) + W, int(oy) + H))
    return bg

_vig = None
def vignette():
    global _vig
    if _vig is None:
        m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
        d.ellipse((-W * .35, -H * .15, W * 1.35, H * 1.15), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(220))
        _vig = m
    return _vig

def base(gt):
    bg = background(gt)
    black = Image.new('RGB', (W, H), (0, 0, 0))
    return Image.composite(bg, black, vignette())

# ---------- devices ----------
PHONE_SW = 640
def phone_frame(sw):
    """returns (frame RGBA, screen offset, screen size, mask)"""
    sh = int(sw * 1688 / 780)
    bez = int(sw * 0.035); rad = int(sw * 0.13)
    fw, fh = sw + 2 * bez, sh + 2 * bez
    fr = Image.new('RGBA', (fw + 40, fh + 40), (0, 0, 0, 0))
    # shadow
    sd = Image.new('L', fr.size, 0); ImageDraw.Draw(sd).rounded_rectangle((20, 34, 20 + fw, 34 + fh), rad + bez, fill=170)
    sd = sd.filter(ImageFilter.GaussianBlur(26))
    fr.paste((0, 0, 0, 255), (0, 0), sd)
    d = ImageDraw.Draw(fr)
    d.rounded_rectangle((20, 20, 20 + fw, 20 + fh), rad + bez, fill=(28, 28, 30, 255))
    d.rounded_rectangle((20, 20, 20 + fw, 20 + fh), rad + bez, outline=(92, 90, 88, 255), width=3)
    d.rounded_rectangle((24, 24, 16 + fw, 16 + fh), rad + bez - 4, outline=(10, 10, 10, 255), width=2)
    # side buttons
    d.rounded_rectangle((20 + fw - 1, 20 + int(fh * .22), 20 + fw + 5, 20 + int(fh * .30)), 3, fill=(70, 68, 66, 255))
    d.rounded_rectangle((15, 20 + int(fh * .18), 21, 20 + int(fh * .23)), 3, fill=(70, 68, 66, 255))
    d.rounded_rectangle((15, 20 + int(fh * .26), 21, 20 + int(fh * .34)), 3, fill=(70, 68, 66, 255))
    mask = Image.new('L', (sw, sh), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), rad, fill=255)
    return fr, (20 + bez, 20 + bez), (sw, sh), mask

_pf = {}
def phone(screen_img, sw=PHONE_SW, island=True):
    if sw not in _pf: _pf[sw] = phone_frame(sw)
    fr, off, (sw_, sh_), mask = _pf[sw]
    out = fr.copy()
    sc = screen_img.resize((sw_, sh_), Image.LANCZOS) if screen_img.size != (sw_, sh_) else screen_img
    out.paste(sc, off, mask)
    if island:
        d = ImageDraw.Draw(out)
        iw, ih = int(sw_ * .28), int(sw_ * .075)
        cx = off[0] + sw_ // 2
        d.rounded_rectangle((cx - iw // 2, off[1] + 14, cx + iw // 2, off[1] + 14 + ih), ih // 2, fill=(0, 0, 0, 255))
    return out

def laptop(screen_img, sw=900):
    sh = int(sw * 900 / 1440)
    bez = 22; top = 26
    fw, fh = sw + 2 * bez, sh + bez + top
    base_h = 34; base_w = int(fw * 1.16)
    im = Image.new('RGBA', (base_w + 60, fh + base_h + 70), (0, 0, 0, 0))
    ox = (im.width - fw) // 2
    sd = Image.new('L', im.size, 0); ImageDraw.Draw(sd).rounded_rectangle((ox, 30, ox + fw, fh + base_h + 30), 30, fill=160)
    im.paste((0, 0, 0, 255), (0, 10), sd.filter(ImageFilter.GaussianBlur(28)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((ox, 10, ox + fw, 10 + fh), 22, fill=(22, 22, 24, 255), outline=(85, 84, 82, 255), width=3)
    d.ellipse((ox + fw // 2 - 4, 20, ox + fw // 2 + 4, 28), fill=(55, 55, 55, 255))
    sc = screen_img.resize((sw, sh), Image.LANCZOS)
    im.paste(sc, (ox + bez, 10 + top))
    bx = (im.width - base_w) // 2; by = 10 + fh
    d.polygon([(bx + 14, by), (bx + base_w - 14, by), (bx + base_w, by + base_h - 10), (bx, by + base_h - 10)], fill=(150, 148, 146, 255))
    d.rounded_rectangle((bx, by + base_h - 14, bx + base_w, by + base_h), 8, fill=(118, 116, 114, 255))
    d.rounded_rectangle((im.width // 2 - 70, by, im.width // 2 + 70, by + 9), 5, fill=(110, 108, 106, 255))
    return im, (ox + bez, 10 + top), (sw, sh)

def paste_center(canvas, im, cx, cy, alpha=1.0, scale=1.0):
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if alpha < 1:
        a = im.getchannel('A').point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    canvas.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)
    return (int(cx - im.width / 2), int(cy - im.height / 2), im.width, im.height)

# ---------- text ----------
def text_layer(lines, t_in, gt_local, y, sizes=(84, 40), step=None):
    """big headline (serif) + optional small line; animated rise"""
    lay = Image.new('RGBA', (W, 520), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    p = ease(seg(gt_local, t_in, t_in + 0.7))
    yy = 40
    if step is not None:
        f = font(DMS, 30, 700)
        txt = step
        tw = d.textlength(txt, font=f)
        d.rounded_rectangle((W / 2 - tw / 2 - 24, yy, W / 2 + tw / 2 + 24, yy + 56), 28, fill=(191, 148, 98, 40), outline=GOLD2, width=2)
        d.text((W / 2 - tw / 2, yy + 11), txt, font=f, fill=GOLD)
        yy += 86
    for i, (ln, kind) in enumerate(lines):
        if kind == 'h':
            f = font(SERIF, sizes[0], 600); col = CREAM
        elif kind == 'g':
            f = font(SERIF, sizes[0], 600); col = GOLD
        else:
            f = font(DMS, sizes[1], 400); col = MUTED
        tw = d.textlength(ln, font=f)
        sz = sizes[0] if kind in 'hg' else sizes[1]
        while tw > W - 100 and sz > 20:
            sz -= 3; f = font(SERIF if kind in 'hg' else DMS, sz, 600 if kind in 'hg' else 400); tw = d.textlength(ln, font=f)
        d.text(((W - tw) / 2, yy), ln, font=f, fill=col)
        yy += int((sizes[0] if kind in 'hg' else sizes[1]) * 1.22)
    a = lay.getchannel('A').point(lambda v: int(v * p)); lay.putalpha(a)
    return lay, int(y + (1 - p) * 60)

def tap(canvas, x, y, t, t0):
    """finger tap ripple at (x,y) starting at t0"""
    k = t - t0
    if k < -0.35 or k > 0.9: return
    d = ImageDraw.Draw(canvas, 'RGBA')
    if k < 0:  # finger approaching
        p = ease(1 + k / 0.35); r = 34
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, int(110 * p)), outline=(255, 255, 255, int(200 * p)), width=3)
        return
    # press + ripple
    r0 = 34 * (1 - 0.18 * math.sin(min(1, k / 0.18) * math.pi))
    a0 = int(160 * (1 - seg(k, 0.25, 0.6)))
    d.ellipse((x - r0, y - r0, x + r0, y + r0), fill=(255, 255, 255, a0))
    rr = 34 + 90 * ease(k / 0.6); ar = int(200 * (1 - seg(k, 0, 0.6)))
    d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=(232, 196, 150, ar), width=5)

def notif(title, body, app='Gmail · Turnos Estudio Aurora', when='ahora', w=920):
    h = 210
    im = Image.new('RGBA', (w + 40, h + 50), (0, 0, 0, 0))
    sd = Image.new('L', im.size, 0); ImageDraw.Draw(sd).rounded_rectangle((20, 26, 20 + w, 26 + h), 40, fill=150)
    im.paste((0, 0, 0, 255), (0, 0), sd.filter(ImageFilter.GaussianBlur(20)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((20, 16, 20 + w, 16 + h), 40, fill=(38, 37, 36, 255), outline=(70, 66, 62, 255), width=2)
    ic = Image.open('/tmp/aurora/app/img/icons/icon-192.png').convert('RGBA').resize((92, 92), Image.LANCZOS)
    im.paste(ic, (52, 16 + (h - 92) // 2), ic)
    d.text((166, 44), app, font=font(DMS, 27, 500), fill=(170, 165, 158))
    d.text((20 + w - 30 - d.textlength(when, font=font(DMS, 27, 400)), 44), when, font=font(DMS, 27, 400), fill=(150, 145, 138))
    d.text((166, 88), title, font=font(DMS, 35, 700), fill=CREAM)
    d.text((166, 140), body, font=font(DMS, 31, 400), fill=(205, 198, 190))
    return im

def screen_scroll(im, y0, y1, p, sh=1688):
    y = y0 + (y1 - y0) * ease_io(p)
    return im.crop((0, int(y), im.width, int(y) + sh))

def xfade(a, b, p):
    if p <= 0: return a
    if p >= 1: return b
    return Image.blend(a, b, p)
