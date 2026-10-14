"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORLD_G1_IDS = exports.RAID_G1_IDS = exports.ORDINARY_G1 = exports.ENEMY_G1_GRADES = exports.ENEMY_G1 = void 0;
exports.enemyG1 = enemyG1;
exports.enemyG1Grade = enemyG1Grade;
exports.chapterG1 = chapterG1;
exports.endlessG1 = endlessG1;
exports.raidG1 = raidG1;
exports.worldG1 = worldG1;
exports.mobG1 = mobG1;
exports.mobG1Pool = mobG1Pool;
exports.g1EnemyAssetKeys = g1EnemyAssetKeys;
/** Approved species catalog. Imported source geometry uses a two-unit reference height. */
exports.ENEMY_G1 = [
    {
        "id": "B01",
        "key": "g1-b01",
        "name": "礁钳统领",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/b01",
        "model": "models-enemy-g1/b01/b01/b01"
    },
    {
        "id": "B02",
        "key": "g1-b02",
        "name": "荆背獠王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "shock",
        "icon": "enemy-g1/icons/b02",
        "model": "models-enemy-g1/b02/b02/b02"
    },
    {
        "id": "B03",
        "key": "g1-b03",
        "name": "珊脊蜥王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "mortar",
        "icon": "enemy-g1/icons/b03",
        "model": "models-enemy-g1/b03/b03/b03"
    },
    {
        "id": "B04",
        "key": "g1-b04",
        "name": "苔角鹿王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "rally",
        "icon": "enemy-g1/icons/b04",
        "model": "models-enemy-g1/b04/b04/b04"
    },
    {
        "id": "B05",
        "key": "g1-b05",
        "name": "墨潮祭司",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "octopus",
        "effect": "drain",
        "icon": "enemy-g1/icons/b05",
        "model": "models-enemy-g1/b05/b05/b05"
    },
    {
        "id": "B06",
        "key": "g1-b06",
        "name": "晶核岩卫",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "shock",
        "icon": "enemy-g1/icons/b06",
        "model": "models-enemy-g1/b06/b06/b06"
    },
    {
        "id": "B07",
        "key": "g1-b07",
        "name": "铁吻鳄王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/b07",
        "model": "models-enemy-g1/b07/b07/b07"
    },
    {
        "id": "B08",
        "key": "g1-b08",
        "name": "螺堡领主",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "hermit",
        "effect": "rally",
        "icon": "enemy-g1/icons/b08",
        "model": "models-enemy-g1/b08/b08/b08"
    },
    {
        "id": "B09",
        "key": "g1-b09",
        "name": "岚翼鳐王",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "ray",
        "effect": "frost",
        "icon": "enemy-g1/icons/b09",
        "model": "models-enemy-g1/b09/b09/b09"
    },
    {
        "id": "B10",
        "key": "g1-b10",
        "name": "孢冠长老",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "mortar",
        "icon": "enemy-g1/icons/b10",
        "model": "models-enemy-g1/b10/b10/b10"
    },
    {
        "id": "H01",
        "key": "g1-h01",
        "name": "苍潮龙王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/h01",
        "model": "models-enemy-g1/h01/h01/h01"
    },
    {
        "id": "H02",
        "key": "g1-h02",
        "name": "幽渊墨皇",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "octopus",
        "effect": "drain",
        "icon": "enemy-g1/icons/h02",
        "model": "models-enemy-g1/h02/h02/h02"
    },
    {
        "id": "H03",
        "key": "g1-h03",
        "name": "熔礁魔君",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "shock",
        "icon": "enemy-g1/icons/h03",
        "model": "models-enemy-g1/h03/h03/h03"
    },
    {
        "id": "H04",
        "key": "g1-h04",
        "name": "晶脊岩王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "frost",
        "icon": "enemy-g1/icons/h04",
        "model": "models-enemy-g1/h04/h04/h04"
    },
    {
        "id": "M01",
        "key": "g1-m01",
        "name": "小墨团",
        "kind": "ink",
        "height": 2,
        "flying": false,
        "rigFamily": "blob",
        "effect": "ink",
        "icon": "enemy-g1/icons/m01",
        "model": "models-enemy-g1/m01/m01/m01"
    },
    {
        "id": "M02",
        "key": "g1-m02",
        "name": "快跑蟹",
        "kind": "runner",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "runner",
        "icon": "enemy-g1/icons/m02",
        "model": "models-enemy-g1/m02/m02/m02"
    },
    {
        "id": "M03",
        "key": "g1-m03",
        "name": "铁壳蟹",
        "kind": "armored",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "armored",
        "icon": "enemy-g1/icons/m03",
        "model": "models-enemy-g1/m03/m03/m03"
    },
    {
        "id": "M04",
        "key": "g1-m04",
        "name": "雾泡怪",
        "kind": "mist",
        "height": 2,
        "flying": true,
        "rigFamily": "floating",
        "effect": "frost",
        "icon": "enemy-g1/icons/m04",
        "model": "models-enemy-g1/m04/m04/m04"
    },
    {
        "id": "M05",
        "key": "g1-m05",
        "name": "吐墨螺",
        "kind": "snail",
        "height": 2,
        "flying": false,
        "rigFamily": "snail",
        "effect": "mortar",
        "icon": "enemy-g1/icons/m05",
        "model": "models-enemy-g1/m05/m05/m05"
    },
    {
        "id": "E01",
        "key": "g1-e01",
        "name": "搬壳大蟹",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "shock",
        "icon": "enemy-g1/icons/e01",
        "model": "models-enemy-g1/e01/e01/e01"
    },
    {
        "id": "M06",
        "key": "g1-m06",
        "name": "潮毒蛛",
        "kind": "ink",
        "height": 2,
        "flying": false,
        "rigFamily": "spider",
        "effect": "web",
        "icon": "enemy-g1/icons/m06",
        "model": "models-enemy-g1/m06/m06/m06"
    },
    {
        "id": "M07",
        "key": "g1-m07",
        "name": "炮背螺兽",
        "kind": "snail",
        "height": 2,
        "flying": false,
        "rigFamily": "snail",
        "effect": "mortar",
        "icon": "enemy-g1/icons/m07",
        "model": "models-enemy-g1/m07/m07/m07"
    },
    {
        "id": "M08",
        "key": "g1-m08",
        "name": "海萤医师",
        "kind": "mist",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "heal",
        "icon": "enemy-g1/icons/m08",
        "model": "models-enemy-g1/m08/m08/m08"
    },
    {
        "id": "M09",
        "key": "g1-m09",
        "name": "帆翼蝠鱼",
        "kind": "runner",
        "height": 2,
        "flying": true,
        "rigFamily": "ray",
        "effect": "ranged",
        "icon": "enemy-g1/icons/m09",
        "model": "models-enemy-g1/m09/m09/m09"
    },
    {
        "id": "E02",
        "key": "g1-e02",
        "name": "缚丝蛛卫",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "spider",
        "effect": "web",
        "icon": "enemy-g1/icons/e02",
        "model": "models-enemy-g1/e02/e02/e02"
    },
    {
        "id": "E03",
        "key": "g1-e03",
        "name": "潮铃海马",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "floating",
        "effect": "heal",
        "icon": "enemy-g1/icons/e03",
        "model": "models-enemy-g1/e03/e03/e03"
    },
    {
        "id": "E04",
        "key": "g1-e04",
        "name": "符潮乌贼",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "octopus",
        "effect": "magic",
        "icon": "enemy-g1/icons/e04",
        "model": "models-enemy-g1/e04/e04/e04"
    },
    {
        "id": "E05",
        "key": "g1-e05",
        "name": "阵鼓海象",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "rally",
        "icon": "enemy-g1/icons/e05",
        "model": "models-enemy-g1/e05/e05/e05"
    },
    {
        "id": "E06",
        "key": "g1-e06",
        "name": "棱镜海胆",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "blob",
        "effect": "magic",
        "icon": "enemy-g1/icons/e06",
        "model": "models-enemy-g1/e06/e06/e06"
    },
    {
        "id": "E07",
        "key": "g1-e07",
        "name": "掘礁穿山甲",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "charge",
        "icon": "enemy-g1/icons/e07",
        "model": "models-enemy-g1/e07/e07/e07"
    },
    {
        "id": "E08",
        "key": "g1-e08",
        "name": "双镰螳虾",
        "kind": "elite",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "slash",
        "icon": "enemy-g1/icons/e08",
        "model": "models-enemy-g1/e08/e08/e08"
    },
    {
        "id": "E09",
        "key": "g1-e09",
        "name": "风眼鸥",
        "kind": "elite",
        "height": 2,
        "flying": true,
        "rigFamily": "ray",
        "effect": "ranged",
        "icon": "enemy-g1/icons/e09",
        "model": "models-enemy-g1/e09/e09/e09"
    },
    {
        "id": "B11",
        "key": "g1-b11",
        "name": "织潮蛛后",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "spider",
        "effect": "web",
        "icon": "enemy-g1/icons/b11",
        "model": "models-enemy-g1/b11/b11/b11"
    },
    {
        "id": "B12",
        "key": "g1-b12",
        "name": "焰轮海星王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "blob",
        "effect": "fireRain",
        "icon": "enemy-g1/icons/b12",
        "model": "models-enemy-g1/b12/b12/b12"
    },
    {
        "id": "M10",
        "key": "g1-m10",
        "name": "盾叶海胆",
        "kind": "armored",
        "height": 2,
        "flying": false,
        "rigFamily": "blob",
        "effect": "armorBreak",
        "icon": "enemy-g1/icons/m10",
        "model": "models-enemy-g1/m10/m10/m10"
    },
    {
        "id": "M11",
        "key": "g1-m11",
        "name": "电须鳗",
        "kind": "mist",
        "height": 2,
        "flying": false,
        "rigFamily": "serpent",
        "effect": "focusFire",
        "icon": "enemy-g1/icons/m11",
        "model": "models-enemy-g1/m11/m11/m11"
    },
    {
        "id": "M12",
        "key": "g1-m12",
        "name": "爆盐河豚",
        "kind": "mist",
        "height": 2,
        "flying": true,
        "rigFamily": "floating",
        "effect": "slow",
        "icon": "enemy-g1/icons/m12",
        "model": "models-enemy-g1/m12/m12/m12"
    },
    {
        "id": "M13",
        "key": "g1-m13",
        "name": "钻沙鼠",
        "kind": "runner",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "anchor",
        "icon": "enemy-g1/icons/m13",
        "model": "models-enemy-g1/m13/m13/m13"
    },
    {
        "id": "M14",
        "key": "g1-m14",
        "name": "走根幼苗",
        "kind": "mist",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "silence",
        "icon": "enemy-g1/icons/m14",
        "model": "models-enemy-g1/m14/m14/m14"
    },
    {
        "id": "M15",
        "key": "g1-m15",
        "name": "灯笼鮟仔",
        "kind": "snail",
        "height": 2,
        "flying": true,
        "rigFamily": "floating",
        "effect": "shield",
        "icon": "enemy-g1/icons/m15",
        "model": "models-enemy-g1/m15/m15/m15"
    },
    {
        "id": "B13",
        "key": "g1-b13",
        "name": "陨火角鲸",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "ray",
        "effect": "fireRain",
        "icon": "enemy-g1/icons/b13",
        "model": "models-enemy-g1/b13/b13/b13"
    },
    {
        "id": "B14",
        "key": "g1-b14",
        "name": "裂潮海蛇",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "serpent",
        "effect": "drain",
        "icon": "enemy-g1/icons/b14",
        "model": "models-enemy-g1/b14/b14/b14"
    },
    {
        "id": "B15",
        "key": "g1-b15",
        "name": "赤怒海狮",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "rally",
        "icon": "enemy-g1/icons/b15",
        "model": "models-enemy-g1/b15/b15/b15"
    },
    {
        "id": "B16",
        "key": "g1-b16",
        "name": "菌伞女王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "beacon",
        "icon": "enemy-g1/icons/b16",
        "model": "models-enemy-g1/b16/b16/b16"
    },
    {
        "id": "B17",
        "key": "g1-b17",
        "name": "藤冠螳王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/b17",
        "model": "models-enemy-g1/b17/b17/b17"
    },
    {
        "id": "B18",
        "key": "g1-b18",
        "name": "铁帆蚌堡",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "blob",
        "effect": "mortar",
        "icon": "enemy-g1/icons/b18",
        "model": "models-enemy-g1/b18/b18/b18"
    },
    {
        "id": "B19",
        "key": "g1-b19",
        "name": "雷喙翼王",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "ray",
        "effect": "shock",
        "icon": "enemy-g1/icons/b19",
        "model": "models-enemy-g1/b19/b19/b19"
    },
    {
        "id": "B20",
        "key": "g1-b20",
        "name": "镜潮水母",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "floating",
        "effect": "frost",
        "icon": "enemy-g1/icons/b20",
        "model": "models-enemy-g1/b20/b20/b20"
    },
    {
        "id": "W01",
        "key": "g1-w01",
        "name": "负岳玄鳌",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/w01",
        "model": "models-enemy-g1/w01/w01/w01"
    },
    {
        "id": "W02",
        "key": "g1-w02",
        "name": "万触渊主",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "octopus",
        "effect": "drain",
        "icon": "enemy-g1/icons/w02",
        "model": "models-enemy-g1/w02/w02/w02"
    },
    {
        "id": "W03",
        "key": "g1-w03",
        "name": "焚潮巨猿",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "shock",
        "icon": "enemy-g1/icons/w03",
        "model": "models-enemy-g1/w03/w03/w03"
    },
    {
        "id": "W04",
        "key": "g1-w04",
        "name": "星冠狮鹫",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "quadruped",
        "effect": "frost",
        "icon": "enemy-g1/icons/w04",
        "model": "models-enemy-g1/w04/w04/w04"
    },
    {
        "id": "B21",
        "key": "g1-b21",
        "name": "葬锚鳗王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "serpent",
        "effect": "drain",
        "icon": "enemy-g1/icons/b21",
        "model": "models-enemy-g1/b21/b21/b21"
    },
    {
        "id": "B22",
        "key": "g1-b22",
        "name": "深灯鮟皇",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "floating",
        "effect": "mortar",
        "icon": "enemy-g1/icons/b22",
        "model": "models-enemy-g1/b22/b22/b22"
    },
    {
        "id": "B23",
        "key": "g1-b23",
        "name": "锈帆锤鲨",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/b23",
        "model": "models-enemy-g1/b23/b23/b23"
    },
    {
        "id": "B24",
        "key": "g1-b24",
        "name": "琥珀蜂后",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "winged",
        "effect": "beacon",
        "icon": "enemy-g1/icons/b24",
        "model": "models-enemy-g1/b24/b24/b24"
    },
    {
        "id": "B25",
        "key": "g1-b25",
        "name": "潮鼓蛙王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "shock",
        "icon": "enemy-g1/icons/b25",
        "model": "models-enemy-g1/b25/b25/b25"
    },
    {
        "id": "B26",
        "key": "g1-b26",
        "name": "盐晶蝎皇",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "scorpion",
        "effect": "web",
        "icon": "enemy-g1/icons/b26",
        "model": "models-enemy-g1/b26/b26/b26"
    },
    {
        "id": "B27",
        "key": "g1-b27",
        "name": "贝冠鹦皇",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "winged",
        "effect": "rally",
        "icon": "enemy-g1/icons/b27",
        "model": "models-enemy-g1/b27/b27/b27"
    },
    {
        "id": "B28",
        "key": "g1-b28",
        "name": "巨吻海豹",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "frost",
        "icon": "enemy-g1/icons/b28",
        "model": "models-enemy-g1/b28/b28/b28"
    },
    {
        "id": "B29",
        "key": "g1-b29",
        "name": "海参堡主",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "centipede",
        "effect": "beacon",
        "icon": "enemy-g1/icons/b29",
        "model": "models-enemy-g1/b29/b29/b29"
    },
    {
        "id": "B30",
        "key": "g1-b30",
        "name": "骨帆旗鱼",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "mortar",
        "icon": "enemy-g1/icons/b30",
        "model": "models-enemy-g1/b30/b30/b30"
    },
    {
        "id": "B31",
        "key": "g1-b31",
        "name": "藤壳象王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "breakwater",
        "icon": "enemy-g1/icons/b31",
        "model": "models-enemy-g1/b31/b31/b31"
    },
    {
        "id": "B32",
        "key": "g1-b32",
        "name": "月刃蝙王",
        "kind": "boss",
        "height": 2,
        "flying": true,
        "rigFamily": "winged",
        "effect": "drain",
        "icon": "enemy-g1/icons/b32",
        "model": "models-enemy-g1/b32/b32/b32"
    },
    {
        "id": "B33",
        "key": "g1-b33",
        "name": "锚臂龙虾",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "crab",
        "effect": "shock",
        "icon": "enemy-g1/icons/b33",
        "model": "models-enemy-g1/b33/b33/b33"
    },
    {
        "id": "B34",
        "key": "g1-b34",
        "name": "潮砂蜈王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "centipede",
        "effect": "web",
        "icon": "enemy-g1/icons/b34",
        "model": "models-enemy-g1/b34/b34/b34"
    },
    {
        "id": "B35",
        "key": "g1-b35",
        "name": "礁鬃狮王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "rally",
        "icon": "enemy-g1/icons/b35",
        "model": "models-enemy-g1/b35/b35/b35"
    },
    {
        "id": "B36",
        "key": "g1-b36",
        "name": "棘冠豪王",
        "kind": "boss",
        "height": 2,
        "flying": false,
        "rigFamily": "quadruped",
        "effect": "fireRain",
        "icon": "enemy-g1/icons/b36",
        "model": "models-enemy-g1/b36/b36/b36"
    },
    {
        "id": "M16",
        "key": "g1-m16",
        "name": "盾珊卫",
        "kind": "armored",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "shock",
        "icon": "enemy-g1/icons/m16",
        "model": "models-enemy-g1/m16/m16/m16"
    },
    {
        "id": "M17",
        "key": "g1-m17",
        "name": "墨泡潜贼",
        "kind": "ink",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "shock",
        "icon": "enemy-g1/icons/m17",
        "model": "models-enemy-g1/m17/m17/m17"
    },
    {
        "id": "M18",
        "key": "g1-m18",
        "name": "棘籽射手",
        "kind": "snail",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "shock",
        "icon": "enemy-g1/icons/m18",
        "model": "models-enemy-g1/m18/m18/m18"
    },
    {
        "id": "M19",
        "key": "g1-m19",
        "name": "潮钟侍者",
        "kind": "mist",
        "height": 2,
        "flying": false,
        "rigFamily": "biped",
        "effect": "shock",
        "icon": "enemy-g1/icons/m19",
        "model": "models-enemy-g1/m19/m19/m19"
    }
];
exports.ENEMY_G1_GRADES = [
    { name: '蓝色', color: '#4DACEB', scale: 1.00 },
    { name: '紫色', color: '#AC77DD', scale: 1.13 },
    { name: '橙色', color: '#E79A48', scale: 1.27 },
    { name: '红色', color: '#DE6456', scale: 1.42 },
    { name: '金色', color: '#EAC254', scale: 1.58 },
];
exports.ORDINARY_G1 = exports.ENEMY_G1.filter(x => x.id.startsWith('B'));
exports.RAID_G1_IDS = ['H01', 'H02', 'H03', 'H04'];
// Preserve the established order of the first four world encounters.
exports.WORLD_G1_IDS = ['W01', 'W02', 'W03', 'W04'];
function enemyG1(key) { return exports.ENEMY_G1.find(x => x.key === key || x.id === key); }
function enemyG1Grade(level, wave = 1) {
    const grade = level === 50 ? Math.floor(Math.max(0, wave - 1) / 100) : Math.floor(Math.max(0, level) / 10);
    return Math.min(4, grade);
}
function chapterG1(level) { return exports.ORDINARY_G1[Math.max(0, Math.min(49, Math.floor(level))) % exports.ORDINARY_G1.length]; }
function endlessG1(wave) { return exports.ORDINARY_G1[Math.max(0, Math.floor(wave / 10) - 1) % exports.ORDINARY_G1.length]; }
function raidG1(level) {
    const index = level === 55 ? 3 : level >= 51 && level <= 53 ? level - 51 : -1;
    return index < 0 ? undefined : enemyG1(exports.RAID_G1_IDS[index]);
}
function worldG1(index) { return enemyG1(exports.WORLD_G1_IDS[((index % 4) + 4) % 4]); }
function mobG1(kind) { return exports.ENEMY_G1.find(x => x.kind === kind && !x.id.startsWith('B') && !x.id.startsWith('W') && !x.id.startsWith('H')); }
function mobG1Pool(level, kind) {
    const pool = exports.ENEMY_G1.filter(x => x.kind === kind && x.kind !== 'boss');
    if (pool.length <= 1)
        return pool;
    const chapter = Math.max(0, Math.floor(level / 5)), start = chapter % pool.length;
    return level < 3 ? [pool[0]] : [pool[start], pool[(start + 1) % pool.length]];
}
function g1EnemyAssetKeys(level) {
    const keys = ['ink', 'runner', 'armored', 'mist', 'snail', 'elite'].flatMap(kind => mobG1Pool(level, kind).map(x => x.key));
    if (level === 56)
        keys.push(...exports.WORLD_G1_IDS.map(id => enemyG1(id).key));
    else if (raidG1(level))
        keys.push(raidG1(level).key);
    else if (level === 50)
        keys.push(endlessG1(10).key);
    else
        keys.push(chapterG1(level).key);
    // Cocos' loose spread transform treats Set as one element; materialize it explicitly.
    return Array.from(new Set(keys));
}
