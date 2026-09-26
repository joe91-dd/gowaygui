from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = Path(r"C:/Users/Administrator/Documents/ChatGPT/gowaygui")
ACTIVE = Path(r"C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-43708f93-bc01-4335-8472-f64c9bdb7699.png")
OUT = ROOT / "output" / "battle-ui-premium"
OUT.mkdir(parents=True, exist_ok=True)
ASSET = ROOT / "game" / "assets" / "resources"
FONT = r"C:/Windows/Fonts/msyh.ttc"
FONT_B = r"C:/Windows/Fonts/msyhbd.ttc"

def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)

def text_center(draw, xy, text, fnt, fill):
    b = draw.textbbox((0, 0), text, font=fnt)
    draw.text((xy[0] - (b[2] - b[0]) / 2, xy[1] - (b[3] - b[1]) / 2), text, font=fnt, fill=fill)

def crop(path, box):
    return Image.open(path).convert("RGBA").crop(box)

def cover(base, box, image):
    x, y, w, h = box
    base.alpha_composite(ImageOps.fit(image, (w, h), method=Image.Resampling.LANCZOS), (x, y))

def glow(base, center, rx, ry, color, alpha=100):
    x, y = center
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(12, 0, -2):
        d.ellipse((x-rx-i, y-ry-i, x+rx+i, y+ry+i), outline=(*color, int(alpha*(13-i)/13)), width=3)
    d.ellipse((x-rx, y-ry, x+rx, y+ry), outline=(*color, 230), width=3)
    base.alpha_composite(layer)

def pearl(base, center):
    x, y = center
    glow(base, (x, y+10), 52, 18, (92, 235, 238), 90)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    shell = [(x-51,y+10),(x-40,y-30),(x-20,y-46),(x,y-35),(x+20,y-46),(x+40,y-30),(x+51,y+10),(x+28,y+33),(x,y+39),(x-28,y+33)]
    d.polygon(shell, fill=(230, 250, 245, 245), outline=(81, 186, 190, 255))
    d.ellipse((x-22,y-22,x+22,y+22), fill=(255,243,196,255), outline=(255,255,241,255), width=3)
    d.ellipse((x-8,y-14,x+5,y-2), fill=(255,255,255,225))
    base.alpha_composite(layer)

def hp(draw, x, y, w, ratio, fill):
    draw.rounded_rectangle((x,y,x+w,y+8), radius=4, fill=(12,34,43,200), outline=(242,255,239,190), width=1)
    draw.rounded_rectangle((x+2,y+2,x+2+(w-4)*ratio,y+6), radius=3, fill=fill)

def shadow_panel(base, box, skin):
    x,y,w,h=box
    shadow=Image.new("RGBA",base.size,(0,0,0,0))
    d=ImageDraw.Draw(shadow)
    d.rounded_rectangle((x+4,y+8,x+w+4,y+h+8),radius=24,fill=(0,18,27,120))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
    cover(base, box, skin)

def frame_overlay(base, frame, center, size):
    x,y=center
    layer=frame.resize((size,size),Image.Resampling.LANCZOS)
    base.alpha_composite(layer,(int(x-size/2),int(y-size/2)))

def build(style):
    active=Image.open(ACTIVE).convert("RGB")
    canvas=ImageOps.fit(active.crop((0,126,1280,743)),(1536,864),method=Image.Resampling.LANCZOS,centering=(.5,.48)).convert("RGBA")
    ui=ASSET/"art-v2"/"ui-skins.png"
    quality=ASSET/"art-v2"/"quality-frames.png"
    portraits=ASSET/"art-modern"/"portraits-clean-refined.png"
    skills=ASSET/"art-modern"/"skill-icons-release.png"
    portrait_boxes=[(4,170,430,596),(438,225,864,651),(872,155,1298,581),(1306,175,1732,601),(1740,160,2166,586)]
    portrait_imgs=[crop(portraits,b) for b in portrait_boxes]
    skill_imgs=[crop(skills,(i%3*412+103,(i//3)*470+250,i%3*412+351,(i//3)*470+502)) for i in range(5)]
    quality_imgs=[crop(quality,(28+i*386,170,28+i*386+384,554)) for i in range(5)]
    if style=="ivory":
        top_skin=crop(ui,(24,158,472,364))
        bottom_skin=crop(ui,(535,463,998,847))
        top_tint=(44,88,91,255); sub=(36,121,122,255); accent=(28,157,159,255)
        top_name="初到龟岛"; path=OUT/"battle-hud-premium-ivory.png"
    elif style=="navy":
        top_skin=crop(ui,(1048,159,1515,363))
        bottom_skin=crop(ui,(1039,600,1490,813))
        top_tint=(239,255,244,255); sub=(174,241,220,255); accent=(67,227,214,255)
        top_name="初到龟岛"; path=OUT/"battle-hud-premium-navy.png"
    else:
        top_skin=crop(ui,(521,158,1001,363))
        bottom_skin=crop(ui,(1050,464,1514,844))
        top_tint=(13,75,95,255); sub=(228,249,236,255); accent=(255,200,91,255)
        top_name="初到龟岛"; path=OUT/"battle-hud-premium-tactical.png"

    shadow_panel(canvas,(28,18,1480,72),top_skin)
    draw=ImageDraw.Draw(canvas)
    draw.text((60,38),top_name,font=font(28,True),fill=top_tint)
    for x,label,value in [(300,"守护","20/20"),(520,"波次","1/5"),(730,"时间","00:00")]:
        draw.text((x,39),label,font=font(14,True),fill=sub)
        draw.text((x+55,37),value,font=font(23,True),fill=top_tint)
    for x,label in [(1228,"1X"),(1320,"布阵"),(1416,"暂停")]:
        draw.rounded_rectangle((x,31,x+72,77),radius=16,fill=(9,57,70,170) if style!="ivory" else (255,255,250,190),outline=accent,width=2)
        text_center(draw,(x+36,54),label,font(16,True),sub if style!="ivory" else top_tint)

    for xy,color in [((976,250),(104,230,225)),((722,394),(106,185,255)),((1000,487),(255,181,90)),((1200,520),(190,144,255))]:
        glow(canvas,xy,54,18,color,100)
    pearl(canvas,(1330,570))
    draw.text((1330,626),"守护目标",font=font(15,True),fill=(245,255,245,225),anchor="mm")

    if style=="tactical":
        shadow_panel(canvas,(24,714,760,132),bottom_skin)
        shadow_panel(canvas,(804,714,708,132),bottom_skin)
    else:
        shadow_panel(canvas,(24,704,1488,142),bottom_skin)
    if style=="tactical":
        roster_x=[42,181,320,459,598]; skill_x=[832,964,1096,1228,1360]
        draw.text((50,725),"伙伴",font=font(16,True),fill=sub)
        draw.text((830,725),"主动技能",font=font(16,True),fill=sub)
    else:
        roster_x=[42,184,326,468,610]; skill_x=[850,976,1102,1228,1354]
        draw.text((50,715),"伙伴 · 实时生命",font=font(16,True),fill=sub)
        draw.text((850,715),"技能操作",font=font(16,True),fill=sub)
        draw.line((810,724,810,824),fill=accent,width=2)
    hp_colors=[(78,211,151),(78,211,151),(78,211,151),(255,175,74),(78,211,151)]
    ratios=[.94,.78,.84,.56,.80]
    for i,x in enumerate(roster_x):
        frame_overlay(canvas,quality_imgs[i],(x+45,775),94)
        canvas.alpha_composite(portrait_imgs[i].resize((68,68),Image.Resampling.LANCZOS),(x+11,741))
        draw.text((x+85,739),str(i+1),font=font(16,True),fill=sub)
        hp(draw,x+83,766,39,ratios[i],hp_colors[i])
        draw.text((x+83,782),"拖动",font=font(11),fill=sub)
    for i,x in enumerate(skill_x):
        draw.rounded_rectangle((x,740,x+92,818),radius=22,fill=(4,50,65,210),outline=accent,width=2)
        draw.ellipse((x-3,737,x+95,821),outline=(*accent[:3],95),width=2)
        canvas.alpha_composite(skill_imgs[i].resize((62,63),Image.Resampling.LANCZOS),(x+15,747))
        text_center(draw,(x+46,829),str(i+1),font(14,True),sub)
    draw.text((1450,721),"拖动头像可交换站位",font=font(14,True),fill=sub,anchor="ra")
    canvas.convert("RGB").save(path,quality=97)

build("ivory")
build("navy")
build("tactical")
