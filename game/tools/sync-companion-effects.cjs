const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),common=fs.readFileSync(path.join(__dirname,'companion-rig.glsl'),'utf8').trim();
for(const name of ['companion-surface','companion-world']){
 const file=path.join(root,'assets/resources/art-modern',name+'.effect');let text=fs.readFileSync(file,'utf8');
 const start=text.indexOf('// Shared by UI and world'),end=text.indexOf('\nvec4 frag()',start);
 if(start<0||end<0)throw new Error('Cannot locate shared fragment in '+name);
 text=text.slice(0,start)+common+text.slice(end);
 for(const property of ['rigGear4','rigGear5','rigGear6','rigGear7','rigWeapon','rigHandle'])if(!text.includes('       '+property+':'))text=text.replace('       rigEyeSize:',`       ${property}: { value: [0, 0, 0, 0] }\n       rigEyeSize:`);
 fs.writeFileSync(file,text);
}
console.log('Updated both companion shaders from the shared source.');
