from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(r"C:/Users/Administrator/Documents/ChatGPT/gowaygui")
PREP = Path(r"C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-46923fb3-c84f-4dcb-8817-6cbd97a3658f.png")
ACTIVE = Path(r"C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-43708f93-bc01-4335-8472-f64c9bdb7699.png")
OUT = ROOT / "output" / "battle-ui-redesign-v2"
OUT.mkdir(parents=True, exist_ok=True)

FONT = r"C:/Windows/Fonts/msyh.ttc"
FONT_B = r"C:/Windows/Fonts/msyhbd.ttc"

def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)

def fit_crop(img, box):
    x, y, w, h = box
    return img.crop((x, y, x + w, y + h))

def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def text_center(draw, xy, text, fnt, fill):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    draw.text((xy[0] - (bbox[2] - bbox[0]) / 2, xy[1] - (bbox[3] - bbox[1]) / 2), text, font=fnt, fill=fill)

def paste_shadow(base, layer, xy, radius=18, opacity=90):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    x, y = xy
    w, h = layer.size
    sd.rounded_rectangle((x + 5, y + 8, x + w + 5, y + h + 8), radius=radius, fill=(0, 31, 45, opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    base.alpha_composite(shadow)
    base.alpha_composite(layer, xy)

def glow_ring(base, center, radius, color, alpha=120):
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    x, y = center
    for i in range(18, 0, -2):
        a = int(alpha * (19 - i) / 19)
        gd.ellipse((x - radius - i, y - radius - i * .42, x + radius + i, y + radius + i * .42), outline=(*color, a), width=3)
    gd.ellipse((x - radius, y - radius * .42, x + radius, y + radius * .42), outline=(*color, 220), width=3)
    base.alpha_composite(glow)

def pearl(base, center, scale=1.0):
    x, y = center
    glow_ring(base, (x, y + 15 * scale), 55 * scale, (99, 232, 241), 90)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    shell = [(x - 62 * scale, y + 18 * scale), (x - 44 * scale, y - 35 * scale), (x - 22 * scale, y - 56 * scale), (x, y - 41 * scale), (x + 22 * scale, y - 56 * scale), (x + 44 * scale, y - 35 * scale), (x + 62 * scale, y + 18 * scale), (x + 35 * scale, y + 47 * scale), (x, y + 55 * scale), (x - 35 * scale, y + 47 * scale)]
    d.polygon(shell, fill=(226, 247, 241, 240), outline=(91, 181, 184, 255))
    d.ellipse((x - 24 * scale, y - 24 * scale, x + 24 * scale, y + 24 * scale), fill=(255, 245, 204, 255), outline=(255, 255, 240, 255), width=max(1, int(3 * scale)))
    d.ellipse((x - 10 * scale, y - 15 * scale, x + 5 * scale, y - 1 * scale), fill=(255, 255, 255, 220))
    base.alpha_composite(layer)

def hp_bar(draw, x, y, w, value, color):
    rounded(draw, (x, y, x + w, y + 8), 4, (18, 49, 59, 180), (224, 251, 235, 210), 1)
    rounded(draw, (x + 2, y + 2, x + 2 + (w - 4) * value, y + 6), 3, color)

def portrait_cards(base, portraits, y, style):
    draw = ImageDraw.Draw(base)
    x0 = 28
    for i, portrait in enumerate(portraits):
        x = x0 + i * 124
        if style == "glass":
            fill = (232, 249, 240, 230)
            outline = (255, 255, 255, 180)
        else:
            fill = (9, 47, 61, 235)
            outline = (87, 222, 208, 210)
        rounded(draw, (x, y, x + 112, y + 86), 18, fill, outline, 2)
        icon = portrait.resize((58, 58), Image.Resampling.LANCZOS)
        base.alpha_composite(icon, (x + 8, y + 12))
        draw.text((x + 72, y + 16), str(i + 1), font=font(16, True), fill=(23, 80, 94, 255) if style == "glass" else (225, 251, 241, 255))
        hp_bar(draw, x + 70, y + 43, 34, (0.92, 0.7, 0.84, 0.56, 0.77)[i], ((77, 214, 153) if i != 3 else (255, 174, 74)))
        draw.text((x + 70, y + 56), "拖动", font=font(12), fill=(60, 122, 132, 255) if style == "glass" else (175, 235, 222, 255))

def skill_cards(base, skills, y, style):
    draw = ImageDraw.Draw(base)
    w = 78
    x0 = 696
    for i, icon in enumerate(skills):
        x = x0 + i * 86
        if style == "glass":
            rounded(draw, (x, y, x + w, y + 78), 18, (10, 90, 107, 220), (207, 252, 235, 220), 2)
        else:
            rounded(draw, (x, y, x + w, y + 78), 39, (12, 58, 72, 245), (74, 228, 221, 240), 3)
        base.alpha_composite(icon.resize((54, 54), Image.Resampling.LANCZOS), (x + 12, y + 8))
        text_center(draw, (x + w / 2, y + 68), f"{i + 1}", font(13, True), (226, 251, 238, 255))

def build(style):
    prep = Image.open(PREP).convert("RGB")
    active = Image.open(ACTIVE).convert("RGB")
    canvas = Image.new("RGBA", (1280, 720), (20, 111, 123, 255))
    map_img = fit_crop(active, (0, 126, 1280, 617)).resize((1280, 720), Image.Resampling.LANCZOS).convert("RGBA")
    canvas.alpha_composite(map_img)

    portraits = [fit_crop(prep, box).convert("RGBA") for box in [(182, 674, 60, 58), (322, 674, 60, 58), (462, 674, 60, 58), (602, 674, 60, 58), (742, 674, 60, 58)]]
    skills = [fit_crop(active, box).convert("RGBA") for box in [(811, 771, 52, 52), (898, 771, 52, 52), (986, 771, 52, 52), (1073, 771, 52, 52), (1161, 771, 52, 52)]]

    for center, color in [((570, 330), (97, 226, 224)), ((811, 221), (109, 185, 255)), ((1002, 422), (255, 184, 91)), ((421, 566), (129, 229, 167)), ((687, 448), (190, 145, 255))]:
        glow_ring(canvas, center, 42, color, 100)
    pearl(canvas, (1045, 485), .92)

    draw = ImageDraw.Draw(canvas)
    if style == "glass":
        top = Image.new("RGBA", (1218, 72), (238, 250, 239, 228))
        td = ImageDraw.Draw(top)
        rounded(td, (0, 0, 1218, 72), 26, (238, 250, 239, 228), (255, 255, 255, 220), 2)
        td.text((24, 16), "初到龟岛", font=font(24, True), fill=(20, 70, 83, 255))
        td.text((190, 17), "守护 20/20", font=font(21, True), fill=(20, 70, 83, 255))
        td.text((387, 17), "第 1/5 波", font=font(21, True), fill=(20, 70, 83, 255))
        td.text((570, 17), "◷ 00:00", font=font(21, True), fill=(33, 107, 120, 255))
        for i, label in enumerate(["1X", "布阵", "暂停"]):
            xx = 758 + i * 142
            rounded(td, (xx, 9, xx + 120, 63), 18, (255, 255, 255, 225), (175, 231, 217, 240), 2)
            text_center(td, (xx + 60, 36), label, font(20, True), (17, 87, 101, 255))
        paste_shadow(canvas, top, (31, 18), 26, 55)
        bottom = Image.new("RGBA", (1230, 110), (235, 249, 239, 225))
        bd = ImageDraw.Draw(bottom)
        rounded(bd, (0, 0, 1230, 110), 28, (235, 249, 239, 225), (255, 255, 255, 230), 2)
        bd.text((24, 13), "伙伴", font=font(17, True), fill=(21, 87, 98, 255))
        bd.text((703, 13), "技能", font=font(17, True), fill=(21, 87, 98, 255))
        paste_shadow(canvas, bottom, (25, 588), 28, 62)
        portrait_cards(canvas, portraits, 611, "glass")
        skill_cards(canvas, skills, 611, "glass")
        draw = ImageDraw.Draw(canvas)
        draw.text((1140, 615), "拖动头像互换", font=font(15, True), fill=(19, 101, 111, 230))
        draw.text((1090, 262), "海心珍珠", font=font(16, True), fill=(226, 255, 247, 230))
        name = "battle-hud-concept-a-glass.png"
    else:
        top = Image.new("RGBA", (1218, 64), (7, 48, 65, 235))
        td = ImageDraw.Draw(top)
        rounded(td, (0, 0, 1218, 64), 20, (7, 48, 65, 235), (89, 231, 218, 210), 2)
        td.text((24, 16), "初到龟岛", font=font(22, True), fill=(239, 252, 239, 255))
        td.text((199, 17), "♥ 20/20", font=font(20, True), fill=(154, 241, 219, 255))
        td.text((381, 17), "波次 1/5", font=font(20, True), fill=(239, 225, 167, 255))
        td.text((556, 17), "00:00", font=font(20, True), fill=(208, 245, 231, 255))
        for i, label in enumerate(["1X", "布阵", "暂停"]):
            xx = 760 + i * 142
            rounded(td, (xx, 7, xx + 118, 57), 16, (19, 88, 101, 245), (92, 227, 218, 220), 2)
            text_center(td, (xx + 59, 32), label, font(19, True), (241, 255, 240, 255))
        paste_shadow(canvas, top, (31, 20), 20, 90)
        bottom = Image.new("RGBA", (1240, 114), (4, 40, 57, 238))
        bd = ImageDraw.Draw(bottom)
        rounded(bd, (0, 0, 1240, 114), 22, (4, 40, 57, 238), (78, 222, 213, 215), 2)
        bd.text((24, 11), "伙伴 · 实时生命", font=font(17, True), fill=(191, 250, 228, 255))
        bd.text((723, 11), "主动技能", font=font(17, True), fill=(191, 250, 228, 255))
        paste_shadow(canvas, bottom, (20, 584), 22, 120)
        portrait_cards(canvas, portraits, 609, "navy")
        skill_cards(canvas, skills, 608, "navy")
        draw = ImageDraw.Draw(canvas)
        draw.text((1082, 670), "拖动头像交换站位", font=font(15, True), fill=(163, 248, 227, 255))
        draw.text((1055, 258), "守护目标", font=font(16, True), fill=(231, 255, 244, 255))
        name = "battle-hud-concept-b-navy.png"
    canvas.convert("RGB").save(OUT / name, quality=95)

build("glass")
build("navy")
