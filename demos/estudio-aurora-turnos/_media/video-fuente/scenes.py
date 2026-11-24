from render import *
PSW = 560; PS = PSW / 780; PCX, PCY = 540, 1210
_fr, _off, _ss, _m = phone_frame(PSW); PFW, PFH = _fr.size
def screen_xy(px, py, cx=PCX, cy=PCY):
    return cx - PFW / 2 + _off[0] + px * PS, cy - PFH / 2 + _off[1] + py * PS
def headline(c, t, lines, y=110, sizes=(84, 40), t_in=0.1, step=None):
    lay, yy = text_layer(lines, t_in, t, y, sizes=sizes, step=step); c.paste(lay, (0, yy), lay)
def out_fade(c, t, dur, gt):
    if t > dur - 0.2: return Image.blend(c, base(gt), seg(t, dur - 0.2, dur))
    return c
def phone_in(t, a=0.0, b=0.6):
    return PCY + (1 - back(seg(t, a, b))) * 700, min(1, seg(t, a, a + 0.35))
Z = '/tmp/aurora/zip/'
_ph = {}
def photo_bg(name, t, dur, dark=0.55, zoom=(1.0, 1.12), pan=(0, 0)):
    if name not in _ph:
        src = Image.open(Z + name + '.png').convert('RGB')
        s = max(W * 1.15 / src.width, H * 1.15 / src.height)
        _ph[name] = src.resize((int(src.width * s), int(src.height * s)), Image.LANCZOS)
    src = _ph[name]
    z = zoom[0] + (zoom[1] - zoom[0]) * ease_io(t / dur)
    cw, ch = W * 1.15 / z * (src.width / (W * 1.15)) / (src.width / (W * 1.15)), 0
    cw = src.width / z; ch = src.width / z * H / W
    if ch > src.height: ch = src.height; cw = ch * W / H
    p = t / dur
    cx = src.width / 2 + pan[0] * p * (src.width - cw) / 2; cy = src.height / 2 + pan[1] * p * (src.height - ch) / 2
    im = src.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.BILINEAR)
    g = Image.new('L', (1, 256)); 
    for i in range(256): g.putpixel((0, i), int(255 * (0.25 + 0.75 * (i / 255) ** 1.4)))
    shade = g.resize((W, H)).transpose(Image.FLIP_TOP_BOTTOM)
    black = Image.new('RGB', (W, H), (6, 5, 4))
    im = Image.blend(im, black, dark)
    return im

def bubble(text, who, w=820):
    f = font(DMS, 36, 500); fs = font(DMS, 26, 500)
    im = Image.new('RGBA', (w + 40, 190), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    sd = Image.new('L', im.size, 0); ImageDraw.Draw(sd).rounded_rectangle((20, 24, 20 + w, 24 + 140), 34, fill=150)
    im.paste((0, 0, 0, 255), (0, 0), sd.filter(ImageFilter.GaussianBlur(16)))
    d.rounded_rectangle((20, 14, 20 + w, 14 + 140), 34, fill=(32, 30, 29, 245), outline=(70, 66, 62, 255), width=2)
    d.ellipse((44, 42, 44 + 84, 42 + 84), fill=(37, 211, 102, 255))
    d.text((86, 84), who[0], font=font(DMS, 40, 700), fill=(255, 255, 255), anchor='mm')
    d.text((150, 34), who + ' · WhatsApp', font=fs, fill=(170, 165, 158))
    d.text((150, 74), text, font=f, fill=CREAM)
    d.ellipse((20 + w - 70, 64, 20 + w - 30, 104), fill=(37, 211, 102, 255))
    d.text((20 + w - 50, 84), '1', font=font(DMS, 26, 700), fill=(10, 10, 10), anchor='mm')
    return im

# 0 - 3.0  gancho
def s_hook(t, gt, dur):
    c = photo_bg('08_interior_salon', t, dur, dark=0.5, zoom=(1.0, 1.1))
    msgs = [('¿Tenés turno el sábado?', 'Carla', 0.15, 520), ('Hola! ¿Cuánto sale el balayage?', 'Romina', 0.45, 700), ('¿Hay lugar mañana a la tarde?', 'Lucía', 0.75, 880)]
    for txt, who, t0, y in msgs:
        p = back(seg(t, t0, t0 + 0.45))
        if t > t0:
            paste_center(c, bubble(txt, who), 540 + (1 - p) * 120, y, alpha=min(1, seg(t, t0, t0 + 0.25)) * (1 - 0.45 * seg(t, 1.6, 2.0)), scale=0.9 + 0.1 * p)
    # sello "sin responder"
    d = ImageDraw.Draw(c, 'RGBA'); q = ease(seg(t, 1.2, 1.5))
    if q > 0:
        txt = '3 mensajes sin responder'; f = font(DMS, 34, 700); tw = d.textlength(txt, font=f)
        d.rounded_rectangle((540 - tw / 2 - 30, 1010, 540 + tw / 2 + 30, 1080), 35, fill=(200, 60, 50, int(230 * q)))
        d.text((540 - tw / 2, 1024), txt, font=f, fill=(255, 255, 255, int(255 * q)))
    lay, yy = text_layer([('¿Cuántos turnos perdés', 'h'), ('por no contestar a tiempo?', 'g')], 0.05, t, 1180, sizes=(80, 40))
    c.paste(lay, (0, yy), lay)
    return out_fade(c, t, dur, gt)

# 3.0 - 9.6  app propia
def s_devices(t, gt, dur):
    c = base(gt)
    headline(c, t, [('Tu propia app de turnos', 'h'), ('tus clientas reservan solas', 'g')], y=110)
    lp, _, _ = laptop(img('40_desk_home'), sw=880)
    p = ease(seg(t, 0.2, 1.0))
    paste_center(c, lp, 540 - (1 - p) * 900 + 0 * t, 920, alpha=min(1, seg(t, 0.2, 0.7)))
    ph = phone(screen_scroll(img('02_full') if os.path.exists(SH + '02_full.jpg') else img('01_home'), 0, 0, 0) if False else img('01_home'), sw=330)
    p2 = back(seg(t, 0.6, 1.4))
    paste_center(c, ph, 800 + (1 - p2) * 600, 1380 - 20 * math.sin(t * 1.2), alpha=min(1, seg(t, 0.6, 1.0)))
    # chips
    d = ImageDraw.Draw(c, 'RGBA')
    for i, (txt, t0) in enumerate([('Las 24 horas', 2.6), ('Desde el celu', 4.0), ('o la compu', 4.8)]):
        q = ease(seg(t, t0, t0 + 0.4))
        if q <= 0: continue
        f = font(DMS, 38, 600); tw = d.textlength(txt, font=f); x0 = 80; y0 = 1220 + i * 110 + (1 - q) * 30
        d.rounded_rectangle((x0, y0, x0 + tw + 60, y0 + 80), 40, fill=(191, 148, 98, int(235 * q)))
        d.text((x0 + 30, y0 + 18), txt, font=f, fill=(23, 17, 11, int(255 * q)))
    return out_fade(c, t, dur, gt)

# 9.6 - 13.5  reserva rápida
def s_booking(t, gt, dur):
    c = base(gt)
    headline(c, t, [('Eligen servicio,', 'h'), ('día y horario… y listo', 'g')], y=70)
    frames = [(0, img('03_step1')), (0.65, img('04_step1_sel')), (1.3, img('07_step2_time')), (2.1, img('09_form')), (2.95, img('10_ok'))]
    cur = max(i for i, (ts, _) in enumerate(frames) if t >= ts)
    scr = frames[cur][1]
    if cur + 1 < len(frames) and t > frames[cur + 1][0] - 0.15:
        scr = xfade(scr, frames[cur + 1][1], seg(t, frames[cur + 1][0] - 0.15, frames[cur + 1][0]))
    cy, al = phone_in(t, 0, 0.5)
    paste_center(c, phone(scr, sw=PSW), PCX, cy, alpha=al)
    for tt, (px, py) in [(0.5, (390, 701)), (1.15, (612, 1624)), (1.95, (612, 1624)), (2.8, (390, 1584))]:
        x, y = screen_xy(px, py, cy=cy); tap(c, x, y, t, tt)
    return out_fade(c, t, dur, gt)

# 13.5 - 18.0  aviso + panel
def s_panel(t, gt, dur):
    c = base(gt)
    headline(c, t, [('Te llega el aviso al instante', 'h'), ('y manejás todo desde tu panel', 'g')], y=70, sizes=(72, 40))
    lp, _, _ = laptop(img('44_desk_panel_list'), sw=900)
    p = ease(seg(t, 0.9, 1.6))
    paste_center(c, lp, 540, 880 + (1 - p) * 300, alpha=min(1, seg(t, 0.9, 1.3)))
    scr = img('30_mail_owner') if t < 2.4 else img('23_panel')
    if 2.2 < t < 2.4: scr = xfade(img('30_mail_owner'), img('23_panel'), seg(t, 2.2, 2.4))
    p2 = back(seg(t, 0.1, 0.7))
    paste_center(c, phone(scr, sw=400), 760, 1440 + (1 - p2) * 700, alpha=min(1, seg(t, 0.1, 0.4)))
    n1 = notif('Nuevo turno: Balayage · jue 26, 10 h', 'Lucía Fernández reservó desde tu página')
    q = back(seg(t, 0.3, 0.8)); out = ease(seg(t, 2.0, 2.4))
    if 0.3 < t < 2.4:
        paste_center(c, n1, 540, -150 + q * 560 - out * 500, alpha=min(1, seg(t, 0.3, 0.5)))
    return out_fade(c, t, dur, gt)

# 18.0 - fin  cierre
def s_outro(t, gt, dur):
    c = photo_bg('02_balayage_rubio_miel', t, dur, dark=0.62, zoom=(1.05, 1.18), pan=(0, -0.3))
    a1 = 1 - ease(seg(t, 2.4, 2.8))
    lay, yy = text_layer([('Un turno perdido', 'h'), ('es plata perdida', 'g')], 0.05, t, 700, sizes=(104, 40))
    if a1 > 0:
        a = lay.getchannel('A').point(lambda v: int(v * a1)); lay.putalpha(a); c.paste(lay, (0, yy), lay)
    if t > 2.5:
        lg = Image.open('/home/claude/josenunez-dev/assets/logo-zx.webp').convert('RGBA').resize((300, 300), Image.LANCZOS)
        paste_center(c, lg, 540, 640, alpha=min(1, seg(t, 2.55, 2.9)), scale=0.7 + 0.3 * back(seg(t, 2.55, 3.2)))
        lay2, y2 = text_layer([('Pedí la tuya', 'h'), ('en Zenix AR', 'g')], 2.7, t, 820, sizes=(100, 40))
        c.paste(lay2, (0, y2), lay2)
        d = ImageDraw.Draw(c, 'RGBA'); q = ease(seg(t, 3.3, 3.8))
        for i, txt in enumerate(['WhatsApp 2901 471353', 'Instagram @zenix.com.ar']):
            f = font(DMS, 42, 600); tw = d.textlength(txt, font=f); y0 = 1140 + i * 120 + (1 - q) * 30
            d.rounded_rectangle((540 - tw / 2 - 40, y0, 540 + tw / 2 + 40, y0 + 96), 48, fill=(191, 148, 98, int(240 * q)) if i == 0 else (0, 0, 0, int(120 * q)), outline=None if i == 0 else (191, 148, 98, int(255 * q)), width=3)
            d.text((540 - tw / 2, y0 + 22), txt, font=f, fill=(23, 17, 11, int(255 * q)) if i == 0 else CREAM + (int(255 * q),))
        lay3, y3 = text_layer([('App de turnos a medida para tu negocio', 's')], 3.6, t, 1420, sizes=(80, 36))
        c.paste(lay3, (0, y3), lay3)
    if t > dur - 0.5: c = Image.blend(c, Image.new('RGB', (W, H), (0, 0, 0)), seg(t, dur - 0.5, dur))
    return c

SCENES = [('01', s_hook, 3.0), ('02', s_devices, 6.6), ('03', s_booking, 3.9), ('04', s_panel, 4.5), ('05', s_outro, 5.6)]
