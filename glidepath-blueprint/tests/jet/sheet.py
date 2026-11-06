import sys, os
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]
names = [('a-captain-dusk-guided-apu-bleed', 'A · Captain view, dusk, guided callout on APU BLEED'), ('b-overhead-powered-lit', 'B · Overhead powered, integral lighting'), ('b2-overhead-closeup-lit', 'B2 · Overhead close-up, lit legends'), ('c-pedestal-masters-thrust', 'C · Pedestal: ENG MASTER and thrust levers'),
         ('d-displays-engine-start', 'D · Displays during ENG 2 start'), ('e-engine-fire-warning', 'E · Engine fire: master warning + alert'), ('e2-fire-pushbutton-lit', 'E2 · ENG 2 FIRE pushbutton lit'), ('f-debrief-overlay', 'F · Debrief over the cockpit')]
W, H, cols = 640, 400, 3
rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, (H + 34) * rows + 50), (12, 18, 24))
dr = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17); fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: f = fb = ImageFont.load_default()
dr.text((16, 13), 'Jet procedure trainer · hero renders (1920×1200, supersampled) · generic twin-jet, our own flows and wording', fill=(230, 238, 241), font=fb)
for i, (n, label) in enumerate(names):
    p = os.path.join(D, n + '.png')
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
    x, y = (i % cols) * W, 50 + (i // cols) * (H + 34)
    sheet.paste(im, (x, y)); dr.text((x + 10, y + H + 7), label, fill=(200, 214, 220), font=f)
sheet.save(os.path.join(D, '00-contact-sheet.png')); print('sheet saved', sheet.size)
