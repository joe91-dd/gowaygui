from pathlib import Path
p=Path('game/assets/scripts/view/GameEntry.ts');s=p.read_text(encoding='utf-8')
s=s.replace("this.ui.panel(384,-3,407,453,p,'#FFF9EC',243,22)","this.ui.panel(384,-3,407,453,p,'#FFF9EC',172,22)")
s=s.replace('this.ui.portrait(t.role,388,-5,212,p,true)','this.ui.portrait(t.role,388,-5,250,p,true)')
s=s.replace("388,-112,21,UI_COLORS.ink,p,375,36","388,-140,21,UI_COLORS.ink,p,375,36")
s=s.replace("388,-175,346,53","388,-187,346,53")
s=s.replace('this.ui.pet(t,0,29,112,n)','this.ui.pet(t,0,30,106,n)')
s=s.replace("0,-74,18,UI_COLORS.sand,n,209,28","0,-69,18,UI_COLORS.sand,n,209,26")
p.write_text(s,encoding='utf-8')
p=Path('game/assets/scripts/view/IslandUI.ts');s=p.read_text(encoding='utf-8')
needle="if(this.art?.ready){const n=this.group('龟龟立绘:'+role,x,y,parent,size*2,size*2);"
assert needle in s
s=s.replace(needle,"if(this.art?.ready){if(size>64&&this.pearlSurface(parent))return this.portrait(role,x,y,size*2,parent,true);const n=this.group('龟龟立绘:'+role,x,y,parent,size*2,size*2);",1)
p.write_text(s,encoding='utf-8')
print('Thin pearl surfaces, larger live display, secondary-page character consistency refined.')
