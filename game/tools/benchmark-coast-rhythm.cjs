// Deterministic play policies, not a claim that every human strategy wins.
const fs=require('node:fs'),path=require('node:path'),{sim}=require('./test-coast-trial.cjs');
const opening=process.argv.includes('--opening'),variety=process.argv.includes('--variety'),results=[];
for(let map=variety?2:0;map<5;map++)for(const seed of opening?[7,19,41,83,137]:variety?[7,137]:[41])for(const active of opening||variety?[true]:[true,false]){
 const result=sim(map,seed,active,opening?2:10);results.push(result);console.log(JSON.stringify(result));
}
const out=path.resolve(__dirname,'../temp/coast-rhythm-20260927');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,opening?'openings.json':variety?'variety.json':'simulation.json'),JSON.stringify(results,null,2));
if(opening&&results.some(r=>r.completed<2||r.core!==20))throw Error('An opening could not protect the pearl with the recruitment policy');
