from scenes import *
c = photo_bg('02_balayage_rubio_miel', 0, 1, dark=0.6, zoom=(1.08, 1.08))
# degradado inferior para legibilidad
g = Image.new('L', (1, H)); 
for y in range(H): g.putpixel((0, y), int(230 * max(0, (y - 900) / 1020) ** 1.2))
c = Image.composite(Image.new('RGB', (W, H), (8, 7, 6)), c, g.resize((W, H)))
d = ImageDraw.Draw(c, 'RGBA')
# etiqueta
f = font(DMS, 34, 700); txt = 'APP DE TURNOS A MEDIDA'; tw = d.textlength(txt, font=f)
d.rounded_rectangle((540 - tw / 2 - 34, 300, 540 + tw / 2 + 34, 372), 36, fill=(191, 148, 98, 60), outline=GOLD2, width=3)
d.text((540 - tw / 2, 315), txt, font=f, fill=GOLD)
def ctext(t, y, size, col, fnt=SERIF, w=700):
    ff = font(fnt, size, w); tw = d.textlength(t, font=ff)
    d.text(((W - tw) / 2 + 3, y + 4), t, font=ff, fill=(0, 0, 0, 150)); d.text(((W - tw) / 2, y), t, font=ff, fill=col)
ctext('¿Cuántos turnos', 410, 112, CREAM)
ctext('perdés por no', 540, 112, CREAM)
ctext('contestar?', 670, 112, GOLD)
# celular con la app
ph = phone(img('10_ok'), sw=340)
paste_center(c, ph, 540, 1245)
# insignia
f2 = font(DMS, 40, 700); t2 = 'Un turno perdido es plata perdida'; tw2 = d.textlength(t2, font=f2)
d.rounded_rectangle((540 - tw2 / 2 - 40, 1590, 540 + tw2 / 2 + 40, 1680), 45, fill=(191, 148, 98, 245))
d.text((540 - tw2 / 2, 1609), t2, font=f2, fill=(23, 17, 11))
lg = Image.open('/home/claude/josenunez-dev/assets/logo-zx.webp').convert('RGBA').resize((90, 90), Image.LANCZOS)
f3 = font(DMS, 38, 600); t3 = 'Zenix AR'; tw3 = d.textlength(t3, font=f3)
x0 = 540 - (90 + 18 + tw3) / 2
c.paste(lg, (int(x0), 1740), lg); d.text((x0 + 108, 1764), t3, font=f3, fill=CREAM)
c.save('/tmp/aurora/portada-reel-turnos.jpg', quality=93)
