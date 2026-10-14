import {runtimeQuery} from '../platform/runtimeQuery';
import {animation,AnimationClip,Node,Quat,SkeletalAnimation,Vec3} from 'cc';

// Cocos 3.8.8 imports FBX/GLB skeletal curves as ExoticAnimation. Read those
// curves once and build normal public tracks; never mutate a shared source asset.
interface ImportedCurve<T>{times:ArrayLike<number>;values:{get(index:number,out:T):void}}
interface ImportedJoint{_path:string;_position?:ImportedCurve<Vec3>;_rotation?:ImportedCurve<Quat>;_scale?:ImportedCurve<Vec3>}
const walks=new WeakMap<AnimationClip,Map<string,AnimationClip>>();
const limb=/^(leg\d*([._]|$)|tentacle\d*([._]|$)|foot([._]|$)|fin([._]|$)|tail([._]|$))/i;

/** Amplify the authored alternating gait, preserving its axes and foot phasing. */
export function readableEnemyWalk(source:AnimationClip,family='unknown',flying=false,idle=false):AnimationClip{
 const profile=family+'/'+flying+'/'+idle,cached=walks.get(source)?.get(profile);if(cached)return cached;
 const joints=(source as unknown as {_exoticAnimation?:{_nodeAnimations:ImportedJoint[]}})._exoticAnimation?._nodeAnimations;
 if(!joints?.length)return source;
 const clip=new AnimationClip();clip.name=source.name;clip.duration=source.duration;clip.sample=source.sample;clip.wrapMode=AnimationClip.WrapMode.Loop;
 let legs=0,maxSwing=0;
 for(const joint of joints){
  const name=joint._path.split('/').pop()??'',isLimb=limb.test(name)&&!idle;
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
  // Add feature-specific motion only to actual articulated joints. Never scale or
  // deform the whole creature, and never modify imported source clips.
  const feature=enemyJointMotion(name,family,flying,idle);
  if(feature){
   legs++;const baseValues=values.slice(),baseTimes=times.slice(),duration=Math.max(.01,source.duration);
   times.length=0;values.length=0;
   for(let i=0;i<=32;i++){
    const t=duration*i/32;let j=0;while(j<baseTimes.length-2&&baseTimes[j+1]<t)j++;
    const k=Math.min(j+1,baseTimes.length-1),f=Math.max(0,Math.min(1,(t-baseTimes[j])/Math.max(.00001,baseTimes[k]-baseTimes[j])));
    const q=Quat.slerp(new Quat(),baseValues[j],baseValues[k],f),a=2*Math.PI*i/32*feature.cycles+feature.phase;
    const offset=new Quat();Quat.fromEuler(offset,feature.x*Math.sin(a),feature.y*Math.sin(a),feature.z*Math.sin(a));Quat.multiply(q,q,offset);Quat.normalize(q,q);
    times.push(t);values.push(q);
   }
  }
  const track=new animation.QuatTrack();track.path=new animation.TrackPath().toHierarchy(joint._path).toProperty('rotation');
  Array.from(track.channels())[0].curve.assignSorted(times.map((t,i)=>[t,{value:values[i]}] as [number,{value:Quat}]));clip.addTrack(track);
 }
 if(!legs){clip.destroy();return source;}
 // 3.8.8 hashes only imported exotic tracks. Public-track skeletal clips must
 // have a distinct bake key, otherwise different species share the first pose.
 (clip as unknown as {_hash:number})._hash=((source.hash^profile.split('').reduce((h,c)=>Math.imul(h,31)^c.charCodeAt(0),0x62a7e901))>>>0)||1;
 let variants=walks.get(source);if(!variants){variants=new Map();walks.set(source,variants);}variants.set(profile,clip);
 if(typeof location!=='undefined'&&runtimeQuery().get('gait')==='1')console.info('[Enemy gait]',source.name,'limb joints',legs,'swing degrees',Math.round(maxSwing*180/Math.PI));
 return clip;
}

/** Shared clips with live joint evaluation so limb motion and feature lights stay in sync. */
export function prepareEnemyLocomotion(animations:SkeletalAnimation[],family='unknown',flying=false):void{
 for(const rig of animations){
  rig.useBakedAnimation=false;
  const originalDefault=rig.defaultClip;
  rig.clips=rig.clips.map(clip=>clip&&/(^|[|_])(walk|idle)$/i.test(clip.name)?readableEnemyWalk(clip,family,flying,/(^|[|_])idle$/i.test(clip.name)):clip);
  if(originalDefault&&/(^|[|_])(walk|idle)$/i.test(originalDefault.name))rig.defaultClip=readableEnemyWalk(originalDefault,family,flying,/(^|[|_])idle$/i.test(originalDefault.name));
 }
}

/** Actual travelled distance controls cadence. Tick seconds exclude playback speed. */
export function enemyWalkRate(speed:number,bodyHeight:number):number{
 return Math.max(.28,Math.min(2.25,speed/Math.max(.28,bodyHeight*.52)));
}


/** Local bone axes are shared by the production rig families (flying wings use fin bones). */
export function enemyJointMotion(name:string,family:string,flying:boolean,idle:boolean):{x:number;y:number;z:number;cycles:number;phase:number}|undefined{
 const side=/[._]R([._]|$)/i.test(name)?-1:1,part=Number(name.match(/\.(\d+)$/)?.[1]??0),index=Number(name.match(/(?:leg|tentacle)(\d+)/i)?.[1]??0);
 if(/^head$/i.test(name))return{x:idle?2:4,y:idle?4:2,z:0,cycles:1,phase:.6};
 if(/^(fin|wing)/i.test(name))return{x:side*(flying?(part?14:28):(idle?4:8)),y:0,z:side*(flying?6:3),cycles:flying?2:1,phase:part*-.7};
 if(/^spine/i.test(name))return{x:0,y:idle?4:9,z:0,cycles:1,phase:part*-.65};
 if(/^tail/i.test(name))return{x:family==='scorpion'?(idle?3:7):0,y:family==='scorpion'?0:idle?5:11,z:0,cycles:1,phase:-1.2-part*.55};
 if(/^claw/i.test(name))return{x:(idle?4:10)*side,y:(idle?2:5)*side,z:part?(idle?6:12)*side:0,cycles:1,phase:side*.9+part*.6};
 if(/^eye[._]/i.test(name))return{x:idle?4:7,y:side*3,z:0,cycles:1,phase:side*.7};
 if(/^tentacle/i.test(name))return{x:idle?4:8,y:0,z:idle?3:5,cycles:1,phase:index*1.4-part*.8};
 if(/^arm[._]/i.test(name))return{x:(idle?2:8)*side,y:0,z:0,cycles:1,phase:side*Math.PI/2};
 // Idle feet stay planted; a walking distal joint lifts while its partner plants.
 if(!idle&&/^(leg|foot)/i.test(name)&&family!=='unknown')return{x:(part?7:5)*side,y:0,z:0,cycles:1,phase:index*(family==='centipede'?.8:Math.PI)+side*Math.PI/2-part*.5};
 return undefined;
}

/** Attach small feature lights directly to the articulated production joints. */
export function prepareEnemyFeatureSockets(model:Node):void{
 const nodes:Node[]=[];const visit=(n:Node)=>{nodes.push(n);n.children.forEach(visit);};visit(model);
 const candidates=nodes.filter(n=>/^(claw[._][LR]\.1|fin[._][LR]\.1|wing[._][LR]\.1|head|tentacle[01]\.1)$/i.test(n.name));
 for(const [i,joint]of candidates.slice(0,3).entries()){
  if(joint.getChildByName('FX_Enemy_Accent'+i))continue;
  const marker=new Node('FX_Enemy_Accent'+i);marker.layer=joint.layer;marker.setParent(joint);marker.setPosition(0,0,0);
 }
}
