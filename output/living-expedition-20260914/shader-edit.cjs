const fs=require('fs');function edit(file,fn){let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const r=(a,b)=>{if(!s.includes(a))throw Error(file+' missing '+a.slice(0,90));s=s.replace(a,b);};fn(r,()=>s,v=>s=v);fs.writeFileSync(file,s);}
edit('game/assets/resources/art-modern/battle-paint.effect',(r,g,s)=>{
 r('keyParams: { value: [0, 0, 0, 0] }','keyParams: { value: [0, 0, 0, 0] }\n        surfaceRect: { value: [0, 0, 1, 1] }');s(g().replaceAll('vec4 mainColor; vec4 keyParams;','vec4 mainColor; vec4 keyParams; vec4 surfaceRect;'));
 r('if(keyParams.x>6.5){','if(keyParams.x>6.5&&keyParams.x<7.5){');
 const a=g().indexOf('      float outer=exp'),b=g().indexOf('\n    if(keyParams.x>4.5',a);
 s(g().slice(0,a)+`      float rim=exp(-pow((r-.81)/.019,2.0));
      float arcs=pow(.5+.5*cos(a*3.0-t*.42),10.0);
      float stream=pow(.5+.5*cos(a-t*.75),22.0)*exp(-pow((r-.81)/.041,2.0));
      float alpha=rim*(.07+arcs*.13)+stream*.19;if(alpha<.025)discard;
      return vec4(mix(mainColor.rgb,vec3(.90,.91,.79),stream*.34),alpha);
    }
`+g().slice(b));
 r('float alpha = (1.0 - smoothstep(0.05, 1.0, radius)) * 0.52;', 'float alpha = exp(-radius*radius*6.5)*.62 + exp(-radius*radius*2.4)*.16;');
 r('return vec4(0.13, 0.19, 0.12, alpha);','return vec4(0.12, 0.16, 0.13, alpha);');
 const c=g().indexOf('    vec2 flowUV=uv;'),d=g().indexOf('    if (keyParams.x > 1.5',c);
 s(g().slice(0,c)+`    vec2 flowUV=uv;vec4 base=texture(mainTexture,uv);
    vec2 localUV=(uv-surfaceRect.xy)/surfaceRect.zw;
    // Cool stone and ice are not water. The sea mask is also confined to the outside shore.
    float chroma=smoothstep(.22,.43,min(base.g,base.b)-base.r)*smoothstep(.54,.78,base.g)*smoothstep(.69,.85,base.g/max(base.b,.001));
    vec2 island=abs(localUV-.5)/vec2(.43,.44);
    float shore=keyParams.y>1.5?smoothstep(.96,1.16,pow(island.x,4.0)+pow(island.y,4.0)):1.0;
    float water=chroma*shore;
    if(keyParams.x<.5&&keyParams.w>.5){
      flowUV+=vec2(sin(localUV.y*72.0-cc_time.x*1.1)+sin(localUV.x*49.0+localUV.y*32.0-cc_time.x*1.7)*.4,cos(localUV.x*65.0+localUV.y*37.0-cc_time.x*1.3))*vec2(.0038,.0024)*surfaceRect.zw*water;
      flowUV=clamp(flowUV,surfaceRect.xy+.0007,surfaceRect.xy+surfaceRect.zw-.0007);
    }
    vec4 c=texture(mainTexture,flowUV);
    if(keyParams.x<.5&&keyParams.w>.5){
      float caustic=pow(.5+.5*sin(localUV.x*154.0+localUV.y*95.0-cc_time.x*1.5),14.0)*pow(.5+.5*sin(localUV.y*162.0-cc_time.x*1.1),6.0);
      c.rgb+=vec3(.09,.17,.18)*caustic*water;
      if(keyParams.y>2.5){float gem=smoothstep(.28,.48,c.b-c.r)*smoothstep(.55,.9,c.b)*(1.0-water);float pulse=pow(.5+.5*sin(cc_time.x*1.8-localUV.y*19.0-localUV.x*8.0),3.0);c.rgb+=vec3(.11,.35,.51)*gem*pulse;}
    }
    if(keyParams.x>7.5){float gem=smoothstep(.10,.35,c.b-c.r)*smoothstep(.38,.8,c.b)*(1.0-smoothstep(.2,.5,min(c.r,c.b)-c.g));float lava=smoothstep(.24,.5,c.r-c.b)*smoothstep(.5,.85,c.r);float flow=pow(.5+.5*sin(uv.y*143.0-cc_time.x*2.4),4.0);c.rgb+=vec3(.19,.39,.54)*gem*(.20+flow*.65)+vec3(.55,.20,.01)*lava*flow*.45;}
`+g().slice(d));
 r('if (keyParams.y > 0.5) {','if (keyParams.x<.5&&keyParams.y>.5&&keyParams.y<1.5) {');
});
edit('game/tools/companion-rig.glsl',(r,g,s)=>{
 const a=g().indexOf('    }else if(role<2.5){'),b=g().indexOf('    }else if(role<3.5){',a);
 s(g().slice(0,a)+`    }else if(role<2.5){
      float breath=.5-.5*cos(t*1.55),growth=.60+.40*(.5-.5*cos(t*.94));
      vec2 stringTop=rigGear2.xy+vec2(-.018,.022),stringBottom=rigGear3.xy+vec2(-.031,-.023),stringAxis=stringBottom-stringTop;
      float stringU=clamp(dot(q-stringTop,stringAxis)/dot(stringAxis,stringAxis),0.0,1.0);
      float stringLine=(1.0-smoothstep(.0012,.0027,length(q-stringTop-stringAxis*stringU)))*(1.0-c.a);
      pigment(c,vec3(.64,.70,.59),stringLine);
      // Sculpted jade ivy: opaque emerald leaves, fine pearl veins and a travelling growth bud.
      for(int strand=0;strand<2;strand++){
        vec2 bottom=strand==0?rigGear3.xy:rigGear5.xy,top=strand==0?rigGear2.xy:rigGear4.xy;
        vec2 at=strand==0?q:p,axis=top-bottom;float len=max(length(axis),.001);
        vec2 dir=axis/len,normal=vec2(-dir.y,dir.x);float u=dot(at-bottom,dir)/len;
        float curve=strand==0?sin(u*3.14159)*.027:0.0;
        float coil=sin(u*22.0-t*.22)*.010,visibility=smoothstep(0.0,.06,u)*(1.0-smoothstep(.99,1.06,u));
        vec2 stem=bottom+axis*u+normal*(curve+coil);float d=abs(dot(at-stem,normal));
        float reveal=(1.0-smoothstep(growth,growth+.10,u)),vine=(1.0-smoothstep(.003,.0057,d))*visibility;
        pigment(c,vec3(.07,.28,.22),vine);
        float vein=exp(-pow(d/.0018,2.0))*visibility;
        light(emission,glowAlpha,vec3(.51,.84,.65),vein*(.33+.33*breath));
        float energy=exp(-pow((u-fract(t*.18+float(strand)*.36))/.07,2.0))*visibility;
        light(emission,glowAlpha,vec3(.63,.88,.71),exp(-pow(d/.0065,2.0))*energy*.65);
        for(int i=0;i<6;i++){
          float v=.10+float(i)*.16,side=mod(float(i),2.0)*2.0-1.0;
          vec2 anchor=bottom+axis*v+normal*((strand==0?sin(v*3.14159)*.027:0.0)+sin(v*22.0-t*.22)*.010);
          vec2 leafAxis=normalize(normal*side+dir*.70),leafNormal=vec2(-leafAxis.y,leafAxis.x),delta=at-anchor;
          float lengthLeaf=.064,along=dot(delta,leafAxis)/lengthLeaf,bend=sin(along*3.14159)*(.004+.002*sin(t*.9+v*8.0));
          float crosswise=dot(delta,leafNormal)-bend,width=.018*pow(max(0.0,sin(clamp(along,0.0,1.0)*3.14159)),.85);
          float leaf=(1.0-smoothstep(width-.002,width+.0015,abs(crosswise)))*smoothstep(0.0,.07,along)*(1.0-smoothstep(.93,1.0,along))*smoothstep(v-.1,v+.04,growth);
          pigment(c,mix(vec3(.055,.25,.19),vec3(.26,.56,.36),clamp(along+crosswise*17.0,0.0,1.0)),leaf);
          float spine=exp(-pow(crosswise/.0015,2.0))*leaf;
          float ribs=pow(.5+.5*cos(along*41.0-abs(crosswise)*420.0),18.0)*leaf*.28;
          light(emission,glowAlpha,vec3(.68,.84,.59),(spine*.65+ribs)*(.45+breath*.40));
          float edge=exp(-pow((abs(crosswise)-width)/.0018,2.0))*leaf;
          light(emission,glowAlpha,vec3(.25,.62,.47),edge*(.35+breath*.22));
          vec2 tip=anchor+leafAxis*lengthLeaf;float sparkle=softPoint(at,tip,vec2(.0035,.005))*pow(.5+.5*sin(t*1.7+v*11.0),7.0)*smoothstep(v,v+.1,growth);
          light(emission,glowAlpha,vec3(.91,.92,.68),sparkle*.86);
        }
        vec2 bud=bottom+axis*growth+normal*((strand==0?sin(growth*3.14159)*.027:0.0)+sin(growth*22.0-t*.22)*.010);
        light(emission,glowAlpha,vec3(.55,.87,.70),star(at,bud,.024)*(.36+breath*.33));
      }
`+g().slice(b));
});
