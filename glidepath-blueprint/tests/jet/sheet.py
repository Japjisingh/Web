import sys, os
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]
SET = sys.argv[2] if len(sys.argv) > 2 else 'all'
names = [('a-captain-dusk-guided-apu-bleed', 'A · Captain view, dusk, guided callout on APU BLEED'), ('b-overhead-powered-lit', 'B · Overhead powered, integral lighting'), ('b2-overhead-closeup-lit', 'B2 · Overhead close-up, lit legends'), ('c-pedestal-masters-thrust', 'C · Pedestal: ENG MASTER and thrust levers'),
         ('d-displays-engine-start', 'D · Displays during ENG 2 start'), ('e-engine-fire-warning', 'E · Engine fire: master warning + alert'), ('e2-fire-pushbutton-lit', 'E2 · ENG 2 FIRE pushbutton lit'), ('f-debrief-overlay', 'F · Debrief over the cockpit')]
if SET == 'captain':
    names = [('before-cap-dusk', 'BEFORE · captain view, dusk'), ('cap-dusk', 'AFTER · captain view, dusk'), ('cap-day', 'AFTER · captain view, day'),
             ('cap-night', 'AFTER · captain view, night'), ('wide-raw-dusk', 'Wide, overlay hidden, dusk'), ('wide-raw-day', 'Wide, overlay hidden, day')]
    # before/after pair at full width
    a, b = os.path.join(D, 'before-cap-dusk.png'), os.path.join(D, 'cap-dusk.png')
    if os.path.exists(a) and os.path.exists(b):
        A_, B_ = Image.open(a).convert('RGB').resize((960, 600), Image.LANCZOS), Image.open(b).convert('RGB').resize((960, 600), Image.LANCZOS)
        pair = Image.new('RGB', (1930, 640), (12, 18, 24)); pair.paste(A_, (0, 40)); pair.paste(B_, (970, 40)); d2 = ImageDraw.Draw(pair)
        try: fpb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
        except Exception: fpb = ImageFont.load_default()
        d2.text((12, 8), 'BEFORE', fill=(255, 170, 170), font=fpb); d2.text((982, 8), 'AFTER', fill=(160, 240, 190), font=fpb)
        pair.save(os.path.join(D, 'before-after-cap-dusk.png')); print('pair saved')
if SET == 'avionics':
    names = [('g-fcu-selected-values', 'G · FCU: SPD 160, HDG 279, ALT 12000, V/S +1500, AP 1'), ('h-efis-pfd-bugs-baro-fd', 'H · EFIS + PFD: bugs, QNH 1009, FD, LS, V-speeds'),
             ('i-nd-arc-40-constraints', 'I · ND: ARC, 40 NM, CSTR overlay, VOR 1 pointer'), ('j-flight-computers-init-perf', 'J · Flight computers: INIT (1) and PERF (2)'),
             ('k-radio-transponder', 'K · Radio panels and transponder'), ('l-systems-pages-grid', 'L · Systems pages: PRESS, COND, DOOR, WHEEL, F/CTL, STATUS'), ('m-fire-agent2-callout', 'M · Fire drill: AGENT 2 after ~30 s (guided)')]
W, H, cols = 640, 400, 3
rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, (H + 34) * rows + 50), (12, 18, 24))
dr = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17); fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: f = fb = ImageFont.load_default()
dr.text((16, 13), ('Jet trainer · working avionics (1920×1200, dusk, Ultra)' if SET == 'avionics' else 'Jet trainer · captain-view premium pass (1920×1200, supersampled)' if SET == 'captain' else 'Jet procedure trainer · hero renders (1920×1200, supersampled) · generic twin-jet, our own flows and wording'), fill=(230, 238, 241), font=fb)
for i, (n, label) in enumerate(names):
    p = os.path.join(D, n + '.png')
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
    x, y = (i % cols) * W, 50 + (i // cols) * (H + 34)
    sheet.paste(im, (x, y)); dr.text((x + 10, y + H + 7), label, fill=(200, 214, 220), font=f)
sheet.save(os.path.join(D, {'captain': '00-captain-contact-sheet.png', 'avionics': '00-avionics-contact-sheet.png'}.get(SET, '00-contact-sheet.png'))); print('sheet saved', sheet.size)
