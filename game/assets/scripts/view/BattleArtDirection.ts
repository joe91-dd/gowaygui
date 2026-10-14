import {EffectAsset} from 'cc';
import {cloneEffectData,requireEffectPasses} from './EffectDataClone';

/** A separate presentation shader: never rewrites the atlas, route UVs or shared source effect. */
const terrainEffects=new WeakMap<EffectAsset,EffectAsset>();
export function illustratedBattleEffect(source:EffectAsset):EffectAsset{
 const cached=terrainEffects.get(source);if(cached?.isValid)return cached;
 const effect=new EffectAsset('battle-illustration-v1');
 const techniques=cloneEffectData(source.techniques),shaders=cloneEffectData(source.shaders),combinations=cloneEffectData(source.combinations);
 requireEffectPasses(techniques,'battle-illustration-v1');
 for(const shader of shaders){
  const old=shader.name;shader.name=old+'-illustration-v1';shader.hash=(shader.hash^0x36ab5701)>>>0;
  for(const technique of techniques)for(const pass of technique.passes)if(pass.program===old)pass.program=shader.name;
  for(const key of ['glsl1','glsl3','glsl4'] as const){
   const program=(shader as any)[key];if(!program?.frag)continue;
   const sample=key==='glsl1'?'texture2D':'texture';
   const grade=`
    // Reduce microtexture, retain the painted road boundary and broad shapes.
    if(keyParams.x > -0.5 && keyParams.x < 0.5){
      vec2 d=vec2(.0011,.0018)*surfaceRect.zw;
      vec3 soft=(${sample}(mainTexture,flowUV+vec2(d.x,0.0)).rgb
                +${sample}(mainTexture,flowUV-vec2(d.x,0.0)).rgb
                +${sample}(mainTexture,flowUV+vec2(0.0,d.y)).rgb
                +${sample}(mainTexture,flowUV-vec2(0.0,d.y)).rgb)*.25;
      c.rgb=mix(c.rgb,soft,.34);
      float luminance=dot(c.rgb,vec3(.299,.587,.114));
      c.rgb=mix(vec3(luminance),c.rgb,.80);
      // Broad midtones instead of clipped white foam and fluorescent foliage.
      c.rgb=c.rgb*.88+vec3(.025,.038,.039);
      float grass=smoothstep(.02,.18,c.g-max(c.r,c.b));
      c.rgb=mix(c.rgb,c.rgb*vec3(.92,.98,1.06),grass*.6);
      float rim=smoothstep(.28,.74,length((localUV-.5)*vec2(1.0,1.15)));
      c.rgb*=1.0-rim*.10;
    }
   `;
   if(!program.frag.includes('c *= mainColor;'))throw new Error('Battle illustration shader source is incompatible');
   program.frag=program.frag.replace('c *= mainColor;',grade+'\n c *= mainColor;');
  }
 }
 effect.techniques=techniques;effect.shaders=shaders;effect.combinations=combinations;
 effect.onLoaded();terrainEffects.set(source,effect);return effect;
}
