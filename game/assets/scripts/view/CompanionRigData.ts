import type {Role} from '../core/types';
export type V4=[number,number,number,number];
export interface CompanionProfile {head:V4;armA:V4;armB:V4;pivots:V4;gear:V4;gear2:V4;gear3:V4;gear4:V4;gear5:V4;gear6:V4;gear7:V4;eyes:V4;eyeSize:V4;weapon:V4;handle:V4;}
export const COMPANION_PADDING=1.56;
const profile=(head:V4,gear:V4,gear2:V4,gear3:V4,eyes:V4):CompanionProfile=>({head,gear,gear2,gear3,eyes,eyeSize:[.043,.033,.030,.029],armA:[.23,.49,.23,.42],armB:[.79,.57,.20,.33],pivots:[.34,.53,.66,.52],weapon:[0,0,0,0],handle:[0,0,0,0],gear4:[0,0,.01,.01],gear5:[0,0,.01,.01],gear6:[0,0,.01,.01],gear7:[0,0,.01,.01]});
/** Coordinates measured in the actual neutral sprite crop, at the painted equipment. */
export const HOME_RIG:Record<Role,CompanionProfile>={
 stone:profile([.59,.32,.22,.20],[.374,.205,.095,.16],[.217,.368,.09,.13],[.493,.195,.07,.105],[.568,.269,.667,.268]),
 spike:profile([.50,.34,.25,.24],[.783,.635,.10,.29],[.837,.318,.018,.024],[.755,.895,.018,.024],[.499,.272,.653,.295]),
 crystal:profile([.58,.35,.26,.23],[.235,.178,.147,.139],[.245,.620,.03,.04],[.235,.178,.14,.13],[.484,.270,.672,.261]),
 leaf:profile([.48,.37,.28,.25],[.772,.650,.08,.105],[.767,.451,.025,.03],[.772,.650,.08,.105],[.423,.321,.596,.334]),
 bubble:profile([.56,.36,.26,.22],[.217,.244,.055,.083],[.229,.585,.03,.04],[.217,.244,.055,.083],[.467,.291,.692,.304]),
};
export const BATTLE_RIG:Record<Role,CompanionProfile>={
 stone:profile([.44,.53,.23,.19],[.340,.210,.10,.14],[.622,.199,.09,.13],[.825,.365,.10,.13],[.389,.547,.512,.553]),
 spike:profile([.54,.48,.24,.20],[.79,.651,.10,.22],[.810,.484,.02,.02],[.761,.873,.02,.02],[.49,.544,.616,.512]),
 crystal:profile([.57,.49,.25,.21],[.204,.293,.133,.143],[.255,.644,.03,.04],[.204,.293,.13,.14],[.529,.477,.668,.449]),
 leaf:profile([.48,.39,.27,.22],[.727,.655,.08,.11],[.72,.48,.025,.03],[.727,.655,.08,.11],[.407,.390,.548,.388]),
 bubble:profile([.50,.48,.26,.24],[.762,.285,.075,.10],[.752,.559,.03,.04],[.762,.285,.075,.10],[.444,.462,.600,.454]),
};
BATTLE_RIG.stone.armA=[.15,.68,.18,.22];BATTLE_RIG.stone.armB=[.78,.78,.23,.26];BATTLE_RIG.stone.pivots=[.29,.58,.64,.62];
// Rigid equipment crops include their grip, with a soft join confined to the fingers.
HOME_RIG.spike.weapon=[.774,.650,.125,.328];HOME_RIG.spike.handle=[.77,.650,1,.32];
HOME_RIG.crystal.weapon=[.229,.493,.132,.460];HOME_RIG.crystal.handle=[.24,.627,0,.35];
HOME_RIG.leaf.weapon=[.777,.604,.094,.222];HOME_RIG.leaf.handle=[.75,.535,1,.30];
HOME_RIG.bubble.weapon=[.216,.517,.098,.420];HOME_RIG.bubble.handle=[.22,.551,0,.34];
BATTLE_RIG.spike.weapon=[.798,.699,.112,.245];BATTLE_RIG.spike.handle=[.75,.807,1,.30];
BATTLE_RIG.crystal.weapon=[.253,.530,.143,.411];BATTLE_RIG.crystal.handle=[.26,.648,0,.34];
BATTLE_RIG.leaf.weapon=[.744,.597,.108,.270];BATTLE_RIG.leaf.handle=[.717,.48,1,.28];
BATTLE_RIG.bubble.weapon=[.760,.536,.104,.404];BATTLE_RIG.bubble.handle=[.745,.571,1,.34];
HOME_RIG.stone.gear4=[.218,.636,.06,.11];HOME_RIG.stone.gear5=[.783,.682,.045,.065];
HOME_RIG.spike.gear4=[.137,.292,.01,.01];HOME_RIG.spike.gear5=[.245,.595,.01,.01];
BATTLE_RIG.spike.gear4=[.229,.281,.01,.01];BATTLE_RIG.spike.gear5=[.360,.550,.01,.01];
HOME_RIG.stone.gear6=[.346,.918,.10,.047];HOME_RIG.stone.gear7=[.745,.902,.053,.037];
BATTLE_RIG.stone.gear4=[.149,.730,.08,.055];BATTLE_RIG.stone.gear5=[.705,.908,.085,.06];
BATTLE_RIG.stone.gear6=[.359,.799,.05,.045];BATTLE_RIG.stone.gear7=[.904,.824,.04,.055];
HOME_RIG.stone.eyes=[.568,.260,.667,.264];HOME_RIG.stone.eyeSize=[.039,.045,.023,.034];
HOME_RIG.spike.eyes=[.500,.278,.655,.282];HOME_RIG.spike.eyeSize=[.046,.056,.028,.045];
HOME_RIG.crystal.eyes=[.488,.269,.670,.262];HOME_RIG.crystal.eyeSize=[.046,.055,.034,.054];
HOME_RIG.leaf.eyes=[.423,.325,.600,.317];HOME_RIG.leaf.eyeSize=[.046,.049,.027,.044];
HOME_RIG.bubble.eyes=[.467,.287,.692,.289];HOME_RIG.bubble.eyeSize=[.050,.052,.038,.048];
// Perspective makes the far eye narrower in the battlefield paintings.
BATTLE_RIG.stone.eyes=[.337,.464,.489,.527];BATTLE_RIG.stone.eyeSize=[.021,.046,.047,.034];
BATTLE_RIG.spike.eyes=[.539,.536,.687,.506];BATTLE_RIG.spike.eyeSize=[.041,.045,.025,.040];
BATTLE_RIG.crystal.eyeSize=[.036,.048,.026,.038];
BATTLE_RIG.leaf.eyeSize=[.041,.044,.029,.038];BATTLE_RIG.bubble.eyeSize=[.042,.042,.030,.037];
export const ROLE_NUMBER:Record<Role,number>={stone:1,spike:2,crystal:3,leaf:4,bubble:5};
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function blinkAmount(role:Role,time:number):number {
 const offset=ROLE_NUMBER[role]*.71,cycle=4.7+ROLE_NUMBER[role]*.19,phase=(time+offset)%cycle;
 // A quick closure, a tiny closed hold, then a slower reopening; never crossfade the entire eye.
 const p=phase-(cycle-.26);if(p<0)return 0;
 return p<.085?smooth(p/.085):p<.115?1:1-smooth((p-.115)/.145);
}
export function gestureEnvelope(t:number,duration:number):number {
 const p=t/duration;if(p<=0||p>=1)return 0;
 if(p<.16)return -.12*Math.pow(Math.sin(p/.16*Math.PI),2);
 return p<.48?smooth((p-.16)/.32):p<.61?1:1-smooth((p-.61)/.39);
}
/** Attack: draw back → decisive release → settle. Cast: gather → open → recover. */
export function combatGesture(t:number,cast:boolean):number{
 const duration=cast?.9:.48,p=t/duration;if(p<0||p>=1)return 0;
 const wind=cast?.34:.30,contact=cast?.52:.43;
 if(p<wind)return -.30*smooth(p/wind);
 if(p<contact)return -.30+1.30*smooth((p-wind)/(contact-wind));
 return 1-smooth((p-contact)/(1-contact));
}
export function rigMotion(role:Role,time:number,gesture:number,reduced=false,battle=false):{body:V4;angles:V4} {
 if(reduced)return {body:[.50,.92,0,0],angles:[0,0,0,0]};
 const breath=Math.sin(time*(role==='stone'?1.55:1.85)),idle=Math.sin(time*.83),strength=1;
 const response:Record<Role,[number,number,number]>={stone:[-.13,.13,-.035],spike:[-.14,-.17,.055],crystal:[.065,-.18,-.04],leaf:[.05,-.23,.048],bubble:[-.22,.10,-.045]};
 const [a,b,h]=response[role],blink=blinkAmount(role,time);
 return {body:[.50,.92,(idle*.010+gesture*(role==='stone'?-.022:.030))*strength,breath*.012],angles:[(idle*.018+a*gesture)*strength,(-idle*.017+b*gesture)*strength,(Math.sin(time*.66)*.014+h*gesture)*strength,blink]};
}
