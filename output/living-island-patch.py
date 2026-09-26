from pathlib import Path
import json,uuid
root=Path('game/assets/scripts/view')
def edit(path,old,new):
 p=Path(path);s=p.read_text(encoding='utf-8-sig');assert old in s,(path,old[:70]);p.write_text(s.replace(old,new),encoding='utf-8')
shader=Path('game/assets/resources/art-modern/chroma-sprite.effect')
edit(shader,'alphaThreshold: { value: 0.5 }','''alphaThreshold: { value: 0.5 }
        portraitRect: { value: [0, 0, 1, 1] }
        portraitMotion: { value: [0, 0, 0, 0] }
        eyeA: { value: [0, 0, 0.04, 0.04] }
        eyeB: { value: [0, 0, 0.04, 0.04] }''')
edit(shader,'  vec4 frag () {','''  uniform PortraitParams { vec4 portraitRect; vec4 portraitMotion; vec4 eyeA; vec4 eyeB; };
  float region(vec2 p, vec2 center, vec2 radius) {
    return 1.0 - smoothstep(0.55, 1.0, length((p-center)/radius));
  }
  vec4 frag () {''')
edit(shader,'      o *= CCSampleWithAlphaSeparated(cc_spriteTexture, uv0);','''      vec2 sampleUV=uv0;
      vec2 p=(uv0-portraitRect.xy)/portraitRect.zw;
      float tm=portraitMotion.x, role=portraitMotion.y;
      if(role>0.5){
        // Chest expands around its lower anchor; there is no whole-body vertical bob.
        float chest=region(p,vec2(.53,.54),vec2(.43,.39));
        p.x-=sin(tm*(role<1.5?1.65:2.15))*.0035*(p.x-.5)*chest;
        p.y+=sin(tm*(role<1.5?1.65:2.15))*.0024*chest;
        float head=region(p,vec2((eyeA.x+eyeB.x)*.5,eyeA.y+.065),vec2(.24,.20));
        p.x+=sin(tm*.67)*.0025*head;
        p.y+=sin(portraitMotion.z*6.283)*.010*head;
        // Flexible leaves and a held staff move independently of the body.
        float weapon=role>3.5&&role<4.5?region(p,vec2(.89,.46),vec2(.14,.34)):region(p,vec2(role<2.5?.78:.12,.27),vec2(.18,.30));
        if(role>1.5)p.x+=sin(tm*(role<2.5?1.9:1.3)+p.y*5.0)*.004*weapon;
        sampleUV=portraitRect.xy+p*portraitRect.zw;
      }
      o *= CCSampleWithAlphaSeparated(cc_spriteTexture, sampleUV);
      if(role>0.5){
        // Close the eyelid over the iris using nearby skin from the same artwork.
        for(int i=0;i<2;i++){
          vec4 eye=i==0?eyeA:eyeB;
          float cover=region(p,eye.xy,eye.zw)*smoothstep(.05,.8,portraitMotion.w);
          vec2 skin=vec2(p.x,eye.y-eye.w*1.35);
          vec4 lid=CCSampleWithAlphaSeparated(cc_spriteTexture,portraitRect.xy+skin*portraitRect.zw);
          float crease=1.0-smoothstep(.0015,.0045,abs(p.y-eye.y-.005-((p.x-eye.x)/eye.z)*((p.x-eye.x)/eye.z)*.008));
          lid.rgb=mix(lid.rgb,lid.rgb*.38,crease*.8);
          o.rgb=mix(o.rgb,lid.rgb,cover);
        }
        float blue=max(0.0,min(o.b,o.g)-o.r-.08);
        float jewel=role<1.5?1.0:region(p,vec2(.15,.18),vec2(.23,.25));
        o.rgb+=vec3(.12,.48,.60)*blue*jewel*(.25+.22*sin(tm*2.0+p.y*8.0));
        if(role>3.5&&role<4.5){float lamp=region(p,vec2(.88,.55),vec2(.11,.14));o.rgb+=vec3(.18,.10,.015)*lamp*(.5+.25*sin(tm*3.1)+.12*sin(tm*7.3));}
      }''')
entry=root/'GameEntry.ts'
edit(entry,"import {avatarPicker,paintAvatar}","import {CompanionMotion} from './CompanionMotion';\nimport {avatarPicker,paintAvatar}")
edit(entry,"  private homeHeroRole:Role='stone';","  private companionMotion?:CompanionMotion;\n  private homeHeroRole:Role='stone';")
edit(entry,"this.homeWorld?.update(dt);}","this.homeWorld?.update(dt);this.companionMotion?.update(dt,!!this.service?.snapshot.settings.reducedMotion);}")
edit(entry,"this.ui.panel(-450,-4,380,536,this.ui.root,'#FFF9EC',237,24);","this.ui.panel(-450,7,380,514,this.ui.root,'#FFF9EC',237,24);")
edit(entry,"this.art?.attach(image,`hero-${role}`,490,423);","const heroSprite=this.art?.attach(image,`hero-${role}`,490,423);if(heroSprite)this.companionMotion=new CompanionMotion(heroSprite,role,image);")
edit(entry,"const nav=this.ui.panel(0,-307,1240,78,this.ui.root,'#FFF9EC',247,28);","const nav=this.ui.panel(0,-314,1240,76,this.ui.root,'#FFF9EC',247,24);")
edit(entry,"this.ui.modernIcon(icon,0,14,65,n);this.ui.text(title,0,-25,23","this.ui.modernIcon(icon,0,16,48,n);this.ui.text(title,0,-24,22")
edit(entry,"this.ui.panel(-164,-12,720,484,p,'#FFF4DD');this.ui.panel(396,-12,364,484,p,'#FFF4DD');","this.ui.panel(0,-12,1160,484,p,'#FFF9EC',248,20);this.ui.line(210,-232,210,188,p,'#D9E2DA');")
edit(entry,"this.ui.panel(-39,52,70,28,n,'#EBFAF7');this.ui.text(`${t.skills.length}技能`,-39,52,15,UI_COLORS.ink,n,66,23);","this.ui.text(`${t.skills.length}技能`,0,-80,16,UI_COLORS.sand,n,100,22);")
# Make room for the plain captions: no nested skill chips over every face.
edit(entry,"125-Math.floor(i/4)*146,162,138","133-Math.floor(i/4)*149,162,144")
meta={'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}}
(root/'CompanionMotion.ts.meta').write_text(json.dumps(meta,indent=2),encoding='utf8')
