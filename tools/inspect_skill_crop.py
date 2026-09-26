from pathlib import Path
from PIL import Image

src = Image.open(Path(r"C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-43708f93-bc01-4335-8472-f64c9bdb7699.png")).convert("RGB")
crop = src.crop((1050, 735, 1280, 863)).resize((920, 512))
crop.save(Path(r"C:/Users/Administrator/Documents/ChatGPT/gowaygui/output/battle-ui-redesign-v2/skill-crop-inspect.png"))
