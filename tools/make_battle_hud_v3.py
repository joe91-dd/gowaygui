from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = Path(r"C:/Users/Administrator/Documents/ChatGPT/gowaygui")
PREP = Path(r"C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-46923fb3-c84f-4dcb-8817-6cbd97a3658f.png")
ACTIVE = Path(r"C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-43708f93-bc01-4335-8472-f64c9bdb7699.png")
OUT = ROOT / "output" / "battle-ui-redesign-v3"
OUT.mkdir(parents=True, exist_ok=True)
FONT = r"C:/Windows/Fonts/msyh.ttc"
FONT_B = r"C:/Windows/Fonts/msyhbd.ttc"

def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)

def rr(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def center(draw, xy, text, font, fill):
    b = draw.textbbox((0, 0), text, font=font)
    draw.text((xy[0] - (b[2] - b[0]) / 2, xy[1] - (b[3] - b[1]) / 2), text, font=font, fill=fill)

def glow(base, center_xy, radius, color, alpha=100):
    x, y = center_xy
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for n in range(16, 0, -2):
        d.ellipse((x - radius - n, y - radius * .35 - n, x + radius + n, y + radius * .35 + n), outline=(*color, int(alpha * (18 - n) / 18)), width=3)
    d.ellipse((x - radius, y - radius * .35, x + radius, y + radius * .35), outline=(*color, 230), width=3)
    base.alpha_composite(layer)

def pearl(base, center_xy, scale=1.0):
    x, y = center_xy
    glow(base, (x, y + 12 * scale), 62 * scale, (98, 235, 237), 100)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    shell = [(x - 66 * scale, y + 14 * scale), (x - 50 * scale, y - 38 * scale), (x - 24 * scale, y - 63 * scale), (x, y - 48 * scale), (x + 24 * scale, y - 63 * scale), (x + 50 * scale, y - 38 * scale), (x + 66 * scale, y + 14 * scale), (x + 36 * scale, y + 52 * scale), (x, y + 61 * scale), (x - 36 * scale, y + 52 * scale)]
    d.polygon(shell, fill=(224, 249, 242, 244), outline=(94, 188, 191, 255))
    d.ellipse((x - 26 * scale, y - 26 * scale, x + 26 * scale, y + 26 * scale), fill=(255, 244, 199, 255), outline=(255, 255, 239, 255), width=max(2, int(3 * scale)))
    d.ellipse((x - 10 * scale, y - 16 * scale, x + 5 * scale, y - 1 * scale), fill=(255, 255, 255, 220))
    base.alpha_composite(layer)

def card_shadow(base, box, radius=20, alpha=100):
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    x1, y1, x2, y2 = box
    d.rounded_rectangle((x1 + 4, y1 + 8, x2 + 4, y2 + 8), radius=radius, fill=(0, 27, 38, alpha))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))

def hp(draw, x, y, width, ratio, color):
    rr(draw, (x, y, x + width, y + 8), 4, (14, 43, 51, 220), (221, 250, 229, 180), 1)
    rr(draw, (x + 2, y + 2, x + 2 + (width - 4) * ratio, y + 6), 3, color)

def build(style):
    prep = Image.open(PREP).convert("RGB")
    active = Image.open(ACTIVE).convert("RGB")
    map_img = active.crop((0, 126, 1280, 743))
    map_img = ImageOps.fit(map_img, (1280, 720), method=Image.Resampling.LANCZOS, centering=(.5, .48)).convert("RGBA")
    canvas = map_img.copy()
    portraits = [prep.crop((x, 674, x + 60, 734)).convert("RGBA") for x in (182, 322, 462, 602, 742)]
    skills = [active.crop((x, 761, x + 56, 817)).convert("RGBA") for x in (808, 888, 969, 1049, 1130)]

    for xy, color in [((812, 219), (97, 226, 224)), ((605, 333), (109, 185, 255)), ((790, 391), (255, 185, 91)), ((1007, 421), (191, 145, 255))]:
        glow(canvas, xy, 42, color, 110)
    pearl(canvas, (1106, 480), 1.24)
    draw = ImageDraw.Draw(canvas)

    if style == "tide":
        top_box = (28, 16, 1252, 76)
        card_shadow(canvas, top_box, 24, 70)
        rr(draw, top_box, 24, (235, 249, 241, 218), (255, 255, 255, 230), 2)
        draw.text((52, 30), "初到龟岛", font=f(24, True), fill=(18, 72, 82, 255))
        for x, label, value in [(238, "守护", "20/20"), (430, "波次", "1/5"), (604, "时间", "00:00")]:
            draw.text((x, 29), label, font=f(14, True), fill=(74, 137, 141, 255))
            draw.text((x + 57, 28), value, font=f(21, True), fill=(18, 72, 82, 255))
        for x, label in [(1010, "1X"), (1091, "布阵"), (1180, "暂停")]:
            rr(draw, (x, 23, x + 70, 69), 18, (255, 255, 255, 190), (160, 224, 210, 220), 2)
            center(draw, (x + 35, 46), label, f(16, True), (18, 83, 94, 255))

        rail = (22, 568, 1258, 710)
        card_shadow(canvas, rail, 26, 90)
        rr(draw, rail, 26, (235, 249, 241, 230), (255, 255, 255, 235), 2)
        draw.text((45, 581), "伙伴", font=f(15, True), fill=(24, 98, 105, 255))
        draw.text((724, 581), "技能", font=f(15, True), fill=(24, 98, 105, 255))
        draw.line((684, 588, 684, 697), fill=(86, 177, 175, 150), width=2)
        for i, p in enumerate(portraits):
            x = 38 + i * 126
            rr(draw, (x, 603, x + 115, 697), 18, (247, 253, 244, 230), (169, 226, 211, 230), 2)
            canvas.alpha_composite(p.resize((60, 60), Image.Resampling.LANCZOS), (x + 9, 616))
            draw.text((x + 76, 614), str(i + 1), font=f(16, True), fill=(28, 100, 108, 255))
            hp(draw, x + 74, 642, 31, (.94, .78, .84, .56, .8)[i], (75, 207, 146) if i != 3 else (255, 172, 77))
            draw.text((x + 74, 657), "拖动", font=f(11), fill=(72, 133, 135, 255))
        for i, icon in enumerate(skills):
            x = 704 + i * 100
            rr(draw, (x, 604, x + 82, 688), 18, (9, 91, 103, 235), (191, 246, 228, 220), 2)
            canvas.alpha_composite(icon.resize((58, 58), Image.Resampling.LANCZOS), (x + 12, 611))
            center(draw, (x + 41, 695), str(i + 1), f(13, True), (25, 105, 112, 255))
        draw.text((1192, 584), "可拖动换位", font=f(13, True), fill=(24, 98, 105, 255), anchor="ra")
        draw.text((1060, 548), "海心珍珠", font=f(15, True), fill=(239, 255, 244, 235))
        path = OUT / "battle-hud-v3-tide.png"
    elif style == "command":
        top_box = (28, 16, 1252, 74)
        card_shadow(canvas, top_box, 24, 110)
        rr(draw, top_box, 24, (7, 43, 58, 235), (84, 226, 215, 220), 2)
        draw.text((52, 29), "初到龟岛", font=f(23, True), fill=(241, 255, 241, 255))
        for x, label in [(250, "守护 20/20"), (462, "波次 1/5"), (665, "00:00")]:
            draw.text((x, 31), label, font=f(19, True), fill=(188, 246, 224, 255))
        for x, label in [(1010, "1X"), (1091, "布阵"), (1180, "暂停")]:
            rr(draw, (x, 23, x + 70, 67), 18, (18, 83, 96, 245), (83, 226, 215, 220), 2)
            center(draw, (x + 35, 45), label, f(16, True), (241, 255, 241, 255))
        rail = (18, 564, 1262, 710)
        card_shadow(canvas, rail, 24, 135)
        rr(draw, rail, 24, (4, 36, 51, 238), (65, 218, 211, 220), 2)
        draw.text((43, 578), "伙伴 · 实时生命", font=f(15, True), fill=(185, 250, 227, 255))
        draw.text((717, 578), "主动技能", font=f(15, True), fill=(185, 250, 227, 255))
        draw.line((688, 586, 688, 698), fill=(69, 185, 178, 170), width=2)
        for i, p in enumerate(portraits):
            x = 33 + i * 126
            rr(draw, (x, 600, x + 115, 697), 20, (8, 57, 70, 245), (62, 219, 209, 220), 2)
            canvas.alpha_composite(p.resize((60, 60), Image.Resampling.LANCZOS), (x + 9, 614))
            draw.text((x + 76, 612), str(i + 1), font=f(16, True), fill=(220, 253, 235, 255))
            hp(draw, x + 74, 641, 31, (.94, .78, .84, .56, .8)[i], (70, 213, 151) if i != 3 else (255, 173, 80))
            draw.text((x + 74, 656), "拖动", font=f(11), fill=(166, 241, 221, 255))
        for i, icon in enumerate(skills):
            x = 708 + i * 100
            rr(draw, (x, 598, x + 84, 684), 42, (10, 72, 85, 245), (73, 235, 221, 240), 3)
            canvas.alpha_composite(icon.resize((58, 58), Image.Resampling.LANCZOS), (x + 13, 606))
            center(draw, (x + 42, 695), str(i + 1), f(13, True), (195, 249, 228, 255))
        draw.text((1194, 579), "拖动头像交换站位", font=f(13, True), fill=(184, 249, 227, 255), anchor="ra")
        draw.text((1054, 548), "守护目标", font=f(15, True), fill=(236, 255, 245, 235))
        path = OUT / "battle-hud-v3-command.png"
    else:
        top_box = (28, 16, 1252, 72)
        card_shadow(canvas, top_box, 22, 78)
        rr(draw, top_box, 22, (253, 247, 225, 226), (255, 255, 255, 235), 2)
        draw.text((52, 27), "初到龟岛", font=f(23, True), fill=(49, 75, 78, 255))
        draw.text((256, 27), "守护 20/20", font=f(18, True), fill=(38, 111, 113, 255))
        draw.text((454, 27), "第 1/5 波", font=f(18, True), fill=(38, 111, 113, 255))
        draw.text((650, 27), "00:00", font=f(18, True), fill=(38, 111, 113, 255))
        rr(draw, (930, 23, 1000, 65), 16, (33, 155, 157, 235), (255, 255, 255, 235), 2)
        center(draw, (965, 44), "1X", f(16, True), (255, 255, 255, 255))
        rr(draw, (1012, 23, 1101, 65), 16, (255, 255, 255, 235), (38, 143, 145, 220), 2)
        center(draw, (1056, 44), "布阵", f(16, True), (38, 111, 113, 255))
        rr(draw, (1113, 23, 1205, 65), 16, (255, 255, 235, 235), (38, 143, 145, 220), 2)
        center(draw, (1159, 44), "暂停", f(16, True), (38, 111, 113, 255))
        draw.line((90, 80, 1190, 80), fill=(255, 250, 226, 150), width=2)
        rail_left = (22, 578, 660, 710)
        rail_right = (676, 578, 1258, 710)
        card_shadow(canvas, rail_left, 22, 75)
        card_shadow(canvas, rail_right, 22, 85)
        rr(draw, rail_left, 22, (250, 247, 232, 235), (255, 255, 255, 235), 2)
        rr(draw, rail_right, 22, (14, 80, 88, 235), (112, 232, 211, 225), 2)
        draw.text((42, 588), "伙伴", font=f(14, True), fill=(36, 111, 112, 255))
        draw.text((696, 588), "技能操作", font=f(14, True), fill=(204, 250, 226, 255))
        for i, p in enumerate(portraits):
            x = 35 + i * 122
            rr(draw, (x, 603, x + 110, 699), 17, (255, 255, 247, 245), (210, 226, 203, 235), 2)
            canvas.alpha_composite(p.resize((58, 58), Image.Resampling.LANCZOS), (x + 8, 616))
            draw.text((x + 73, 614), str(i + 1), font=f(15, True), fill=(43, 106, 108, 255))
            hp(draw, x + 71, 642, 30, (.94, .78, .84, .56, .8)[i], (65, 196, 139) if i != 3 else (241, 158, 67))
            draw.text((x + 71, 658), "拖动", font=f(10), fill=(91, 136, 128, 255))
        for i, icon in enumerate(skills):
            x = 696 + i * 99
            rr(draw, (x, 604, x + 76, 686), 16, (8, 96, 102, 245), (120, 235, 214, 225), 2)
            canvas.alpha_composite(icon.resize((56, 56), Image.Resampling.LANCZOS), (x + 10, 611))
            center(draw, (x + 38, 696), str(i + 1), f(12, True), (211, 250, 224, 255))
        draw.text((1195, 588), "拖动换位", font=f(13, True), fill=(209, 252, 229, 255), anchor="ra")
        draw.text((1055, 548), "守护珍珠", font=f(15, True), fill=(255, 254, 233, 235))
        path = OUT / "battle-hud-v3-coral.png"
    canvas.convert("RGB").save(path, quality=95)

build("tide")
build("command")
build("coral")
