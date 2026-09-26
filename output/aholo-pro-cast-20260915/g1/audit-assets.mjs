import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),report={created:new Date().toISOString(),characters:[],errors:[]};
for(const id of ['yandun','yeling','shange','yangguang','chaoxing']){
 const file=path.join(root,'runtime-v2',id,id+'.glb'),bytes=await fs.readFile(file);if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('Bad GLB '+id);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const clips=doc.animations?.map(a=>a.name)||[];const checks={embeddedBuffers:doc.buffers.every(b=>!b.uri),embeddedTextures:(doc.images||[]).every(i=>i.bufferView!==undefined),hasSkin:!!doc.skins?.length,hasNineClips:clips.length===9,hasWeaponCore:doc.nodes.some(n=>n.name==='FX_Weapon_Core')};
 for(const [key,ok]of Object.entries(checks))if(!ok)report.errors.push(id+': '+key);
 for(const skin of doc.skins||[])if(skin.joints.some(j=>!doc.nodes[j]))report.errors.push(id+': missing joint');
 let tris=0,vertices=0;for(const m of doc.meshes)for(const p of m.primitives){tris+=p.indices!==undefined?doc.accessors[p.indices].count/3:doc.accessors[p.attributes.POSITION].count/3;vertices+=doc.accessors[p.attributes.POSITION].count;if(p.attributes.JOINTS_1!==undefined)report.errors.push(id+': more than four influences');}
 report.characters.push({id,bytes:bytes.length,triangles:tris,vertices,joints:doc.skins?.[0]?.joints.length||0,clips,checks,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
report.passed=!report.errors.length;await fs.writeFile(path.join(root,'asset-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
