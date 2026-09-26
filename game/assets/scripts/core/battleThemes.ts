/** Presentation only. A theme never owns movement, damage, skills or wave timing. */
export const THEME_ATLASES=['coasts','islands','adventures','challenges','bosses','endless'] as const;
export interface BattleTheme {name:string;atlas:string;panel:number;road:string}
const rows:[string,string][]=[
 ['晴湾海岸','#F0CD8B'],['珊瑚浅滩','#EFCEAA'],['潮汐湿地','#DAC598'],['古树海岛','#E2C599'],
 ['白帆礁群','#C8AD8E'],['月湾遗迹','#A8B3D7'],['风暴海峡','#AFBDB8'],['晶石深湾','#A9D8D9'],
 ['沉船群岛','#DBBE8D'],['海心王座','#D6DDE0'],['熔潮火山','#B99D88'],['霜晶冰窟','#CDE7EF'],
 ['幽光珊瑚','#B4AFD8'],['潮汐竞技场','#E9D2A0'],['双环古庭','#BEB09A'],['星夜群岛','#B2BBDC'],
 ['怒涛海岸','#B5C6CB'],['赤珊瑚礁','#ECD0A6'],['深渊神殿','#B6B1D6'],['玄鳌古殿','#DDCA9A'],
 ['晨曦海湾','#EBD4B5'],['翡翠雨林','#DCCCA4'],['幻晶暮湾','#B3CCDB'],['赤霞熔岸','#D0B4A4'],
];
export const BATTLE_THEMES:BattleTheme[]=rows.map(([name,road],i)=>({name,road,atlas:'map-atlas-'+THEME_ATLASES[Math.floor(i/4)],panel:i%4}));
export function battleThemeIndex(id:number,wave=1,bossIndex=0):number{
 if(id<50)return Math.floor(id/5);
 if(id===50)return [15,20,21,22,23][Math.floor(Math.max(0,wave-1)/5)%5];
 if(id===56)return [19,18,10,11][((bossIndex%4)+4)%4];
 return ({51:10,52:11,53:12,54:13,55:14} as Record<number,number>)[id]??0;
}
export const battleTheme=(id:number,wave=1,bossIndex=0)=>BATTLE_THEMES[battleThemeIndex(id,wave,bossIndex)];
