from pathlib import Path
import json,uuid
r=Path('game/assets/scripts')
p=r/'view/ArtV2Assets.ts';s=p.read_text(encoding='utf-8');s=s.replace('export type ArtV2Image=', 'export type ArtV2Image="companion-signatures"|"abyss-bosses"|');s=s.replace('const IMAGES:ArtV2Image[]=[','const IMAGES:ArtV2Image[]=["companion-signatures","abyss-bosses",');s=s.replace('const modern:Partial<Record<ArtV2Image,string>>={','const modern:Partial<Record<ArtV2Image,string>>={"companion-signatures":"companion-signatures","abyss-bosses":"abyss-bosses",');s=s.replace("    const enemy=this.images.get('battle-enemies-painted')!;",'''    const signatures=this.images.get('companion-signatures')!,sy=[0,253,516,790,1067],sh=[249,263,275,274,305];
    ['stone','spike','crystal','leaf','bubble'].forEach((role,row)=>{for(let col=0;col<4;col++)this.frames.set(('signature-'+role+'-'+col) as ArtV2Slice,frame(signatures.texture!,col*280.5,sy[row],280.5,sh[row]));});
    const bosses=this.images.get('abyss-bosses')!;for(let i=0;i<6;i++)this.frames.set(('boss-'+i) as ArtV2Slice,frame(bosses.texture!,i%3*418+2,Math.floor(i/3)*627+30,414,560));
    const enemy=this.images.get('battle-enemies-painted')!;''');s=s.replace("key.startsWith('pose-')||", "key.startsWith('pose-')||key.startsWith('signature-')||key.startsWith('boss-')||");p.write_text(s,encoding='utf-8')
p=r/'view/GameEntry.ts';s=p.read_text(encoding='utf-8');s="import {AchievementMenus} from './AchievementMenus';\n"+s;s=s.replace('new CompanionMotion(heroSprite,role,image)','new CompanionMotion(heroSprite,role,image,this.art!)')
s=s.replace("['排行',6,()=>this.communityEntry('rankings')]]", "['排行',6,()=>this.communityEntry('rankings')],['成就',6,()=>new AchievementMenus(this.ui,this.service!,k=>this.command(k),()=>this.go('home'),e=>this.error(e)).open()],['工会',5,()=>this.ui.toast('功能开发中，马上就来...')],['世界挑战',7,()=>this.ui.toast('功能开发中，马上就来...')]]")
s=s.replace('const x=-526+i*175,n=', 'const x=-558+i*124,n=').replace('x,0,nav,166,78','x,0,nav,120,78').replace('this.ui.modernIcon(icon,0,16,48,n);','const mark=this.ui.modernIcon(icon,0,16,43,n);if(i>=8){mark.addComponent(UIOpacity).opacity=85;}').replace('n,146,31','n,120,31').replace('if(i<6)this.ui.line(x+87,-25,x+87,23','if(i<9)this.ui.line(x+62,-25,x+62,23')
p.write_text(s,encoding='utf-8')
p=r/'view/IslandUI.ts';s=p.read_text(encoding='utf-8');s="import {GoldFlow} from './GoldFlow';\n"+s;s=s.replace('g.stroke();return n;\n  }\n  battleFigure', "g.stroke();if(turtleQuality(t).tier===6){const glow=this.group('完美品质流光',0,0,n);glow.addComponent(GoldFlow).side=side;}return n;\n  }\n  battleFigure")
s=s.replace("if(!this.art?.attach(n,`book-${id}`,side,side))this.icon('growth-history',0,0,side,n);return n;", "if(!this.art?.attach(n,`book-${id}`,side,side))this.icon('growth-history',0,0,side,n);const skill=SKILL_BY_ID[id];const g=n.addComponent(Graphics);g.lineWidth=2;g.strokeColor=color(skill.active?'#C99C38':skill.precious?'#D95252':'#E0C449');g.roundRect(-side/2+1,-side/2+1,side-2,side-2,side*.18);g.stroke();if(skill.active){const glow=this.group('职业主动金色流光',0,0,n);glow.addComponent(GoldFlow).side=side;}return n;")
p.write_text(s,encoding='utf-8')
# Texture metadata: use known import format with new IDs, preserve filtering.
meta=Path('game/assets/resources/art-modern/portraits-clean.png.meta').read_text(encoding='utf-8');old=json.loads(meta)['uuid']
for name in ['companion-signatures','abyss-bosses']:
 out=Path('game/assets/resources/art-modern/'+name+'.png.meta');out.write_text(meta.replace(old,str(uuid.uuid4())).replace('portraits-clean',name),encoding='utf-8')
