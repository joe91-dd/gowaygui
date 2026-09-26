import {mobG1Pool,ORDINARY_G1} from './enemyG1Catalog';
import type {EnemyKind} from './types';
export interface FaunaModel {key:string;name:string;kind:EnemyKind;height:number;flying:boolean;sourceName:string}
export const FAUNA_MODELS:FaunaModel[]=[
  {
    "key": "fauna-00",
    "name": "虚空来客",
    "kind": "mist",
    "height": 1.45,
    "flying": false,
    "sourceName": "Alien"
  },
  {
    "key": "fauna-01",
    "name": "礁岸猎犬",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Dog"
  },
  {
    "key": "fauna-02",
    "name": "羽冠掠食者",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Birb"
  },
  {
    "key": "fauna-03",
    "name": "暗爪灵猫",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Cat"
  },
  {
    "key": "fauna-04",
    "name": "刺甲荆妖",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Cactoro"
  },
  {
    "key": "fauna-05",
    "name": "赤冠狂禽",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Chicken"
  },
  {
    "key": "fauna-06",
    "name": "尖鳍鱼人",
    "kind": "snail",
    "height": 1.45,
    "flying": false,
    "sourceName": "Fish"
  },
  {
    "key": "fauna-07",
    "name": "翡翠软泥",
    "kind": "mist",
    "height": 1.45,
    "flying": false,
    "sourceName": "GreenBlob"
  },
  {
    "key": "fauna-08",
    "name": "棘刺软泥",
    "kind": "mist",
    "height": 1.45,
    "flying": false,
    "sourceName": "GreenSpikyBlob"
  },
  {
    "key": "fauna-09",
    "name": "毒冠菌王",
    "kind": "snail",
    "height": 1.45,
    "flying": false,
    "sourceName": "Mushnub Evolved"
  },
  {
    "key": "fauna-10",
    "name": "毒芽菌兵",
    "kind": "snail",
    "height": 1.45,
    "flying": false,
    "sourceName": "Mushnub"
  },
  {
    "key": "fauna-11",
    "name": "深潮术士",
    "kind": "mist",
    "height": 1.45,
    "flying": false,
    "sourceName": "Wizard"
  },
  {
    "key": "fauna-12",
    "name": "绯潮软泥",
    "kind": "mist",
    "height": 1.45,
    "flying": false,
    "sourceName": "PinkBlob"
  },
  {
    "key": "fauna-13",
    "name": "礁堡蛮兵",
    "kind": "armored",
    "height": 1.45,
    "flying": false,
    "sourceName": "Orc"
  },
  {
    "key": "fauna-14",
    "name": "风翼斥候",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Pigeon"
  },
  {
    "key": "fauna-15",
    "name": "影刃潜行者",
    "kind": "runner",
    "height": 1.45,
    "flying": false,
    "sourceName": "Ninja"
  },
  {
    "key": "fauna-16",
    "name": "霜牙巨兽",
    "kind": "armored",
    "height": 1.45,
    "flying": false,
    "sourceName": "Yeti"
  },
  {
    "key": "fauna-17",
    "name": "长角战领",
    "kind": "armored",
    "height": 1.45,
    "flying": true,
    "sourceName": "Alpaking Evolved"
  },
  {
    "key": "fauna-18",
    "name": "毒针蜂后",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Armabee Evolved"
  },
  {
    "key": "fauna-19",
    "name": "刺翼工蜂",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Armabee"
  },
  {
    "key": "fauna-20",
    "name": "角冠守卫",
    "kind": "armored",
    "height": 1.45,
    "flying": true,
    "sourceName": "Alpaking"
  },
  {
    "key": "fauna-21",
    "name": "深渊吐息者",
    "kind": "snail",
    "height": 1.45,
    "flying": true,
    "sourceName": "Glub Evolved"
  },
  {
    "key": "fauna-22",
    "name": "酸液幼兽",
    "kind": "snail",
    "height": 1.45,
    "flying": true,
    "sourceName": "Glub"
  },
  {
    "key": "fauna-23",
    "name": "浮岩领主",
    "kind": "armored",
    "height": 1.45,
    "flying": true,
    "sourceName": "Goleling Evolved"
  },
  {
    "key": "fauna-24",
    "name": "潮翼幼龙",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Dragon"
  },
  {
    "key": "fauna-25",
    "name": "浮岩卫兵",
    "kind": "armored",
    "height": 1.45,
    "flying": true,
    "sourceName": "Goleling"
  },
  {
    "key": "fauna-26",
    "name": "风翼斥候 · 战斗形态",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Pigeon"
  },
  {
    "key": "fauna-27",
    "name": "深海触腕",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Tentacle"
  },
  {
    "key": "fauna-28",
    "name": "骷影咒灵",
    "kind": "mist",
    "height": 1.45,
    "flying": true,
    "sourceName": "Ghost Skull"
  },
  {
    "key": "fauna-29",
    "name": "幽潮游魂",
    "kind": "mist",
    "height": 1.45,
    "flying": true,
    "sourceName": "Ghost"
  },
  {
    "key": "fauna-30",
    "name": "深海龙王",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Dragon Evolved"
  },
  {
    "key": "fauna-31",
    "name": "回旋风兽",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Hywirl"
  },
  {
    "key": "fauna-32",
    "name": "海岛战祭",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Tribal"
  },
  {
    "key": "fauna-33",
    "name": "墨触潜袭者",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Squidle"
  },
  {
    "key": "fauna-34",
    "name": "深渊魔裔",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Demon"
  },
  {
    "key": "fauna-35",
    "name": "噬浪巨鲨",
    "kind": "ink",
    "height": 1.45,
    "flying": true,
    "sourceName": "Shark"
  },
  {
    "key": "fauna-36",
    "name": "羽冠掠食者 · 战斗形态",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Birb"
  },
  {
    "key": "fauna-37",
    "name": "虚空来客 · 战斗形态",
    "kind": "mist",
    "height": 2,
    "flying": false,
    "sourceName": "Alien"
  },
  {
    "key": "fauna-38",
    "name": "蓝焰魔将",
    "kind": "elite",
    "height": 2,
    "flying": false,
    "sourceName": "BlueDemon"
  },
  {
    "key": "fauna-39",
    "name": "深渊魔裔 · 战斗形态",
    "kind": "elite",
    "height": 2,
    "flying": false,
    "sourceName": "Demon"
  },
  {
    "key": "fauna-40",
    "name": "刺甲荆妖 · 战斗形态",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Cactoro"
  },
  {
    "key": "fauna-41",
    "name": "尖鳍鱼人 · 战斗形态",
    "kind": "snail",
    "height": 2,
    "flying": false,
    "sourceName": "Fish"
  },
  {
    "key": "fauna-42",
    "name": "毒沼猎手",
    "kind": "snail",
    "height": 2,
    "flying": false,
    "sourceName": "Frog"
  },
  {
    "key": "fauna-43",
    "name": "暴齿龙兽",
    "kind": "armored",
    "height": 2,
    "flying": false,
    "sourceName": "Dino"
  },
  {
    "key": "fauna-44",
    "name": "铁拳海僧",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Monkroose"
  },
  {
    "key": "fauna-45",
    "name": "影刃潜行者 · 战斗形态",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Ninja"
  },
  {
    "key": "fauna-46",
    "name": "王冠菌主",
    "kind": "snail",
    "height": 2,
    "flying": false,
    "sourceName": "MushroomKing"
  },
  {
    "key": "fauna-47",
    "name": "骨面重装兵",
    "kind": "armored",
    "height": 2,
    "flying": false,
    "sourceName": "Orc Skull"
  },
  {
    "key": "fauna-48",
    "name": "海岛战祭 · 战斗形态",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Tribal"
  },
  {
    "key": "fauna-49",
    "name": "霜牙巨兽 · 战斗形态",
    "kind": "armored",
    "height": 2,
    "flying": false,
    "sourceName": "Yeti"
  },
  {
    "key": "fauna-50",
    "name": "礁堡蛮兵 · 战斗形态",
    "kind": "armored",
    "height": 2,
    "flying": false,
    "sourceName": "Orc"
  },
  {
    "key": "fauna-51",
    "name": "赤帆海盗王",
    "kind": "elite",
    "height": 2,
    "flying": false,
    "sourceName": "Captain Barbarossa"
  },
  {
    "key": "fauna-52",
    "name": "独眼海盗",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Henry"
  },
  {
    "key": "fauna-53",
    "name": "月爪剑卫",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Bunny"
  },
  {
    "key": "fauna-54",
    "name": "红帆女船长",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Anne"
  },
  {
    "key": "fauna-55",
    "name": "鲨鳍督军",
    "kind": "elite",
    "height": 2,
    "flying": false,
    "sourceName": "Sharky"
  },
  {
    "key": "fauna-56",
    "name": "双刃锤鲨",
    "kind": "elite",
    "height": 2,
    "flying": false,
    "sourceName": "Mako"
  },
  {
    "key": "fauna-57",
    "name": "骷髅水手",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Skeleton"
  },
  {
    "key": "fauna-58",
    "name": "无首刽子手",
    "kind": "runner",
    "height": 2,
    "flying": false,
    "sourceName": "Skeleton Headless"
  }
];
export const BOSS_MODEL_INDICES=[6,13,17,27,28,31,32,33,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,23,29,34,35,18,21,15,11,30,25,20,24,7,8,9,22,26];
export const bossModelIndex=(index:number)=>BOSS_MODEL_INDICES[((index%BOSS_MODEL_INDICES.length)+BOSS_MODEL_INDICES.length)%BOSS_MODEL_INDICES.length];
export function encounterModels(level:number,kind:EnemyKind):FaunaModel[]{
 return mobG1Pool(level,kind).map(approved=>({...approved,sourceName:approved.name}));
}
export function enemyModelFor(level:number,kind:EnemyKind,ordinal:number,bossIndex?:number):FaunaModel{
 if(bossIndex!==undefined){const asset=ORDINARY_G1[Math.max(0,bossIndex)%ORDINARY_G1.length];return {...asset,sourceName:asset.name};}
 const pool=encounterModels(level,kind);return pool[Math.abs(ordinal)%Math.max(1,pool.length)]??FAUNA_MODELS[0];
}
