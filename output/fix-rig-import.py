from pathlib import Path
p=Path('game/assets/resources/art-modern/companion-surface.effect');s=p.read_text('utf8').replace('#include <builtin/internal/embedded-alpha>','').replace('#define SOURCE(p) CCSampleWithAlphaSeparated(cc_spriteTexture,p)','#define SOURCE(p) texture(cc_spriteTexture,p)');p.write_text(s,'utf8')
p=Path('game/tools/build-web.ps1');s=p.read_text('utf8').replace('SyntaxError:|Cannot find module','SyntaxError:|Cannot find module|Error EFX[0-9]+');p.write_text(s,'utf8')
