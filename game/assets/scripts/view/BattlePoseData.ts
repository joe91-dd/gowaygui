export const MAIN_POSES:number[][][]=[
 [[30,43,260,252,158,280],[338,43,283,252,474,280],[642,43,358,252,795,280],[993,43,251,252,1120,280]],
 [[16,365,286,266,161,610],[330,365,294,268,479,611],[653,356,289,275,800,610],[959,365,288,266,1113,610]],
 [[24,675,274,256,157,914],[342,646,277,285,474,914],[648,678,354,253,770,914],[996,677,250,254,1119,914]],
 [[60,995,224,197,171,1150],[378,1000,217,192,484,1150],[690,984,214,210,791,1150],[992,1010,230,180,1097,1150]]];
export const SUPPORT_POSES:number[][][]=[
 [[32,36,264,267,160,280],[340,26,275,277,468,280],[658,33,270,270,784,280],[971,38,273,265,1100,280]],
 [[18,321,286,295,151,598],[338,303,280,313,495,598],[642,322,283,294,777,598],[964,325,283,291,1100,598]],
 [[34,675,261,221,155,867],[350,675,267,221,473,867],[666,675,264,221,789,867],[974,673,269,223,1112,867]],
 [[8,927,301,287,157,1172],[318,891,307,323,478,1172],[627,929,307,285,778,1172],[942,925,303,289,1104,1172]]];
export const ENEMY_POSES:number[][][]=Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>[c*313.5,r*313.5,313.5,313.5,c*313.5+156.75,[258,552,858,1180][r]]));
export const poseRow=(kind:string):{atlas:'main'|'support'|'enemy';row:number;scale:number}|undefined=>{
 const enemy:Record<string,number>={runner:0,armored:1,snail:2,boss:3};
 if(kind in enemy)return{atlas:'enemy',row:enemy[kind],scale:kind==='boss'?.0062:kind==='armored'?.0038:.0033};
 const main:Record<string,number>={spike:0,stone:1,crystal:2,ink:3,runner:3};
 const support:Record<string,number>={leaf:0,bubble:1,sheep:2,golem:3};
 return kind in main?{atlas:'main',row:main[kind],scale:kind==='ink'||kind==='runner'?.005:.006}:kind in support?{atlas:'support',row:support[kind],scale:kind==='sheep'?.0047:kind==='golem'?.0065:.0058}:undefined;
};
