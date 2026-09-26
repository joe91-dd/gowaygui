/** Canonical tuning for the September playtest; no retrospective changes to receipts. */
export const RELEASE_BALANCE={version:'2026-09-15',normalBattleSeconds:[240,360],training:{aptitudeBase:5,aptitudePerStar:3,growthBase:12,growthPerStar:4},
 progression:{levelCap:50,pointsPerLevel:3,xpBase:60,xpLinear:12,xpSquare:2},
 ads:{perDay:6,perPlacement:3,suppliesGold:1200,suppliesGrowth:1},
 chapter:{spawnSecondsBase:32,spawnSecondsPerWave:2,enemyBase:16,enemyPerWave:3,healthWaveGrowth:1.08,healthBase:.60,healthPerLevel:.019,bossHealthBase:850,bossHealthPerLevel:30,bossFinalMultiplier:1.75},
 limits:{targets:5,shield:.4,attackSpeed:.8,slow:.6,critical:.6},
 loop:{expectedGoldRepeat:11000,expectedGoldFirst:21000,ordinaryBook:3500,basicPetPack:7200}} as const;
