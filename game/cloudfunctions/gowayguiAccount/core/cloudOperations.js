"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOUD_METHODS = void 0;
/** Explicit replay surface. Never dispatch arbitrary client-supplied method names. */
exports.CLOUD_METHODS = [
    'resumeOffline', 'buyDaily', 'recordRaidAttempt', 'enablePatrol', 'claimPatrol', 'claimMonthCard', 'enableIncrement', 'enableLiving',
    'allocatePetPoints', 'resetPetPoints', 'readMail', 'claimMail', 'deleteMail', 'openBookPack', 'receiveRoomMail', 'purchaseShop', 'purchaseShopPack', 'finishShopReveal',
    'receiveAccountParcel', 'receiveAdReward', 'communityAction', 'beginRaid', 'beginArena', 'beginArenaPractice', 'checkpointArena', 'finishArena', 'selectRaidPet', 'selectRaidStation',
    'raidExpeditionCommand', 'beginRaidWave', 'checkpointRaid', 'finishRaid', 'claimCodex', 'claimChest', 'claimArenaTier', 'matchArena', 'refreshClock', 'enablePrototype',
    'beginPrototypeRun', 'expeditionCommand', 'lockBench', 'setHomeTeam', 'swapCollectionOrder', 'deployBench', 'setBattleSpeed', 'prepareEndlessReward',
    'chooseEndlessReward', 'buyEndlessReward', 'closeEndlessReward', 'takeHome', 'discardTakeaway', 'releaseTurtle', 'startOutsideFusion', 'revealOutsideFusion',
    'keepOutsideFusion', 'revealSkillBook', 'finishBookReveal', 'fuseSkillBooks', 'updateAvatar', 'updateSettings', 'rename', 'setLocked', 'train', 'learnSkillBook',
    'beginRun', 'recruit', 'placeUnit', 'moveUnit', 'beginWave', 'checkpointBattle', 'completeWave', 'merge', 'reveal', 'collect', 'abandonRun'
];
