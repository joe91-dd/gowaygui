import {animation,AnimationClip,Quat,SkeletalAnimation,Vec3} from 'cc';

// Cocos 3.8.8 imports FBX/GLB skeletal curves as ExoticAnimation. Read those
// curves once and build normal public tracks; never mutate a shared source asset.
interface ImportedCurve<T>{times:ArrayLike<number>;values:{get(index:number,out:T):void}}
interface ImportedJoint{_path:string;_position?:ImportedCurve<Vec3>;_rotation?:ImportedCurve<Quat>;_scale?:ImportedCurve<Vec3>}
const walks=new WeakMap<AnimationClip,AnimationClip>();
const limb=/^(leg\d*([._]|$)|tentacle\d*([._]|$)|foot([._]|$)|fin([._]|$)|tail([._]|$))/i;

/** Amplify the authored alternating gait, preserving its axes and foot phasing. */
export function readableEnemyWalk(source:AnimationClip):AnimationClip{
 const cached=walks.get(source);if(cached)return cached;
 const joints=(source as unknown as {_exoticAnimation?:{_nodeAnimations:ImportedJoint[]}})._exoticAnimation?._nodeAnimations;
 if(!joints?.length)return source;
 const clip=new AnimationClip();clip.name=source.name;clip.duration=source.duration;clip.sample=source.sample;clip.wrapMode=AnimationClip.WrapMode.Loop;
 let legs=0,maxSwing=0;
 for(const joint of joints){
  const name=joint._path.split('/').pop()??'',isLimb=limb.test(name);
  // Fins/tails retain a lighter swimming motion; feet and tentacles visibly plant.
  const gain=/^(fin|tail)/i.test(name)?1.65:/^foot/i.test(name)?3.2:2.8;
  for(const property of ['position','scale'] as const){
   const curve=joint[property==='position'?'_position':'_scale'];if(!curve?.times.length)continue;
   const times=Array.from(curve.times),values=times.map((_,i)=>{const v=new Vec3();curve.values.get(i,v);return v;});
   if(isLimb&&property==='position'){
    const mean=new Vec3();for(const value of values)Vec3.add(mean,mean,value);Vec3.multiplyScalar(mean,mean,1/values.length);
    for(const value of values){const d=Vec3.subtract(new Vec3(),value,mean),length=d.length();Vec3.scaleAndAdd(value,mean,d,Math.min(gain,length>0?.14/length:gain));}
   }
   const track=new animation.VectorTrack();track.componentsCount=3;track.path=new animation.TrackPath().toHierarchy(joint._path).toProperty(property);
   for(let axis=0;axis<3;axis++)track.channels()[axis].curve.assignSorted(times.map((t,i)=>[t,values[i][(['x','y','z'] as const)[axis]]] as [number,number]));
   clip.addTrack(track);
  }
  const curve=joint._rotation;if(!curve?.times.length)continue;
  const times=Array.from(curve.times),values=times.map((_,i)=>{const q=new Quat();curve.values.get(i,q);return q;});
  if(isLimb){
   legs++;
   const mean=new Quat(0,0,0,0),reference=values[0];
   for(const q of values){const sign=Quat.dot(q,reference)<0?-1:1;mean.x+=q.x*sign;mean.y+=q.y*sign;mean.z+=q.z*sign;mean.w+=q.w*sign;}
   Quat.normalize(mean,mean);
   for(const q of values){
    const angle=2*Math.acos(Math.min(1,Math.abs(Quat.dot(mean,q))));
    const factor=Math.min(gain,angle>0?.58/angle:gain);maxSwing=Math.max(maxSwing,angle*factor);
    Quat.normalize(q,Quat.slerp(q,mean,q,factor));
   }
  }
  const track=new animation.QuatTrack();track.path=new animation.TrackPath().toHierarchy(joint._path).toProperty('rotation');
  Array.from(track.channels())[0].curve.assignSorted(times.map((t,i)=>[t,{value:values[i]}] as [number,{value:Quat}]));clip.addTrack(track);
 }
 if(!legs){clip.destroy();return source;}
 // 3.8.8 hashes only imported exotic tracks. Public-track skeletal clips must
 // have a distinct bake key, otherwise different species share the first pose.
 (clip as unknown as {_hash:number})._hash=((source.hash^0x51a7e901)>>>0)||1;
 walks.set(source,clip);
 if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('gait')==='1')console.info('[Enemy gait]',source.name,'limb joints',legs,'swing degrees',Math.round(maxSwing*180/Math.PI));
 return clip;
}

/** Keep GPU-baked skinning, including on large waves; build once per species. */
export function prepareEnemyLocomotion(animations:SkeletalAnimation[]):void{
 for(const rig of animations){
  const originalDefault=rig.defaultClip;
  rig.clips=rig.clips.map(clip=>clip&&/(^|[|_])walk$/i.test(clip.name)?readableEnemyWalk(clip):clip);
  if(originalDefault&&/(^|[|_])walk$/i.test(originalDefault.name))rig.defaultClip=readableEnemyWalk(originalDefault);
 }
}

/** Actual travelled distance controls cadence. Tick seconds exclude playback speed. */
export function enemyWalkRate(speed:number,bodyHeight:number):number{
 return Math.max(.28,Math.min(2.25,speed/Math.max(.28,bodyHeight*.52)));
}
