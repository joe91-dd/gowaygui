from pathlib import Path
r=Path(__file__).resolve().parents[1];p=r/'game/assets/scripts/view/IslandArrival.ts';s=p.read_text(encoding='utf-8')
s=s.replace("-329,226,this.root,499,200","-355,232,this.root,440,176").replace("this.logo,499,200","this.logo,440,176")
s=s.replace("'正在启航',0,-316,20", "'正在驶向海岛…',0,-309,23")
s=s.replace("this.loadImage('art-modern/sailing-arrival',this.scenery", "this.loadImage('art-modern/sailing-honor',this.scenery")
s=s.replace("this.failed=failed;this.status.string=failed?'暂未抵达，再试一次':'正在启航';", "this.failed=failed;this.status.string=failed?'暂未抵达，再试一次':'正在驶向海岛…';")
s=s.replace("this.loadArtwork();this.update(0,true);", "this.loadArtwork();this.update(0,true);",1)
s=s.replace("this.actions=this.ui.group('过渡操作',0,-316);", "this.actions=this.ui.group('过渡操作',0,-316);\n    this.ui.text('向着海岛，出发',-355,128,27,'#FFF0BC',this.root,440,42);\n    this.ui.text('伙伴正在准备迎接新的冒险',0,-343,16,'#FFF1C3',this.root,640,26);")
a=s.index('    this.progress.lineWidth=1.5;');b=s.index('\n  }',a)
s=s[:a]+'''    this.progress.lineWidth=2;this.progress.strokeColor=color('#E4C077');
    this.progress.fillColor=color('#173D50',216);this.progress.roundRect(-285,-9,570,18,9);this.progress.fill();this.progress.stroke();
    // Indeterminate until the real loader completes; never reports a fabricated percentage.
    const phase=(1-Math.cos(this.time*Math.PI/3.8))/2;
    this.progress.fillColor=color('#0FBDCB');this.progress.roundRect(-280+phase*370,-5,190,10,5);this.progress.fill();
    this.progress.fillColor=color('#FFF6CF',200);this.progress.circle(-188+phase*370,0,4);this.progress.fill();
'''+s[b:];p.write_text(s,encoding='utf-8')
p=r/'game/assets/resources/art-modern/sailing-arrival.effect';s=p.read_text(encoding='utf-8');a=s.index('vec4 frag(){');b=s.index('\n}%',a)
s=s[:a]+'''vec4 frag(){
  vec2 p=uv0;float t=arrivalMotion.x;
  vec3 base=texture(sceneTexture,p).rgb;
  float hull=oval(p,vec2(.69,.66),vec2(.31,.21));
  float sail=range(p.x,.53,.82,.04)*range(p.y,.17,.58,.04)*smoothstep(.20,.55,base.r);
  float crew=oval(p,vec2(.70,.54),vec2(.27,.20));
  float boat=max(hull,max(sail,crew));
  vec2 d=p-vec2(.70,.71);float rock=sin(t*.82)*.0016;
  vec2 shift=boat*vec2(-d.y*rock,d.x*rock+sin(t*.95)*.0012);
  float flag=range(p.x,.49,.75,.03)*range(p.y,.025,.18,.02)*smoothstep(.04,.17,base.g-base.b);
  shift+=flag*vec2(sin(t*2.2-p.x*29.)*.0014,sin(t*2.5-p.x*30.)*.0028);
  shift+=sail*vec2(sin(p.y*13.-t*1.25)*.0012,sin(p.x*22.-t)*.0007);
  float water=smoothstep(.56,.79,p.y)*range(p.x,.10,.99,.09)*smoothstep(.055,.21,base.b-base.r);
  shift+=water*vec2(sin(p.y*121.-t*1.7+sin(p.x*17.))*.0018,sin(p.x*88.+p.y*48.-t*1.2)*.0008);
  vec3 result=texture(sceneTexture,clamp(p+shift,.001,.999)).rgb;
  result+=water*vec3(.018,.029,.033)*sin(p.x*116.+p.y*170.-t*1.4);
  float wave=oval(p,vec2(.506,.471),vec2(.027,.047));
  float gem=oval(p,vec2(.900,.385),vec2(.02,.038));
  result+=vec3(.025,.13,.17)*(wave+gem)*(.45+.3*sin(t*1.9));
  return vec4(result,1.)*color;
}
'''+s[b:];p.write_text(s,encoding='utf-8');print('Loading artwork and motion wired')
