import type {BattleState} from './battle';
/** Engine-independent save contracts. Growth uses integer hundredths. */
export type Role = 'stone' | 'spike' | 'crystal' | 'leaf' | 'bubble';
export type Gender = 'male' | 'female';
export type Aptitude = 'attack' | 'health' | 'defense';
export type Material = Aptitude | 'growth';
export type SkillId =
  | 'stoneMastery' | 'spikeMastery' | 'crystalMastery' | 'leafMastery' | 'calm'
  | 'fervor' | 'caprice' | 'polymorph' | 'giant'
  | 'scatter' | 'daze' | 'arcane' | 'holyLight' | 'spirit' | 'counterStorm'
  | 'strong' | 'armor' | 'resist' | 'swift' | 'reach' | 'steady' | 'regen' | 'openingShield' | 'lastShield' | 'encourage'
  | 'block' | 'reflect' | 'share' | 'hold'
  | 'critical' | 'lifesteal' | 'combo' | 'piercingShot'
  | 'bounce' | 'spellDrain' | 'shredResist' | 'crystalCannon'
  | 'doubleHeal' | 'healShield' | 'cleanse' | 'greatHeal'
  | 'rebirth' | 'sleep' | 'extraTarget' | 'taunt' | 'pursuit'
  | 'shredArmor' | 'root' | 'weaken' | 'bubbleRing';
export interface Traits { attack: number; health: number; defense: number; growth: number }
export interface Turtle {
  development?:{version:1;xp:number;points:Record<Aptitude,number>};
  id: string;
  role: Role;
  name: string;
  skills: SkillId[];
  innate: Traits;
  training: Traits;
  generation: number;
  bornAt: number;
  parentIds: string[];
  locked: boolean;
}
export interface HistoricalTurtle { turtle: Turtle; retiredAt: number; replacementId: string; eventId: string }
export interface RunTurtle {
  fusionRank?:1|2|3;
  id: string;
  turtle: Turtle;
  /** Current permanent ancestors, rebased after collecting this individual. */
  sources: string[];
  savedId?: string;
  consumedBy?: string;
  slot: number | null;
  placement?:Point;
  level: number;
  /** V0.6 fixed bench location; independent of the permanent asset lock. */
  benchSlot?: number;
  benchLocked?: boolean;
  /** Sleep survives wave changes and bench swaps; never modifies the permanent archive. */
  sleepUntilWave?: number;
  fallen?: boolean;
  loanId?: string;
  removed?: 'refresh' | 'replaced' | 'discard';
}
export type RunMode = 'chapter' | 'endless';
export type BookPackGrade='common'|'precious'|'active'|'mastery';
export type RewardGrant = {kind:'gold';amount:number} | {kind:'material';material:Material;amount:number} | {kind:'bookPack';grade:BookPackGrade;amount:number}
  | {kind:'book';skillId:SkillId;amount:number;pack?:'ordinary'|'fine'};
export interface RewardNode {wave:number;choices:RewardGrant[];chosen?:number;randomIndex?:number;
  format?:'stop-and-open';opened?:number[];closed?:boolean;drawing?:boolean;spentGold?:number;
}
export interface OutsideFusion {
  id:string; rule:'keep-one'; inputIds:[string,string]; parents:[Turtle,Turtle];
  candidate:Turtle; revealed:boolean; probabilityVersion:string;
}
export interface MergeEvent {
  id: string;
  inputIds: [string, string];
  outputId: string;
  originalSources: string[];
  wave: number;
  revealed: boolean;
  collectedId?: string;
  probabilityVersion: string;
}
export type RunPhase = 'prep' | 'combat' | 'between' | 'reveal' | 'result';
export interface RunState {
  lootIds?:string[];
  expedition?:import('./expeditionRules').ExpeditionState;
  mapVersion?:5|6;sceneRevision?:number;
  /** New campaigns pin their length; older ongoing saves keep their original wave count. */
  waveLimit?:number;
  bossRescuedWaves?:number[];
  contributions?:import('./battle').BattleState['contributions'];
  id: string;
  levelId: number;
  phase: RunPhase;
  wave: number;
  coreHealth: number;
  goldEarned: number;
  combatSeconds: number;
  startedAt: number;
  selectedSources: string[];
  usedSources: string[];
  units: Record<string, RunTurtle>;
  merges: Record<string, MergeEvent>;
  pendingMergeId?: string;
  mergeWavesUsed: number[];
  recruitAvailable: boolean;
  recruitCandidates: Turtle[];
  refreshUsed: boolean;
  battle?: BattleState;
  rulesVersion?: '0.6';
  mode?: RunMode;
  speed?: 1 | 2;
  resumeAfterReveal?: 'prep' | 'between' | 'combat';
  rewardNodes?: RewardNode[];
  rewardLedger?: {wave:number;source:'choice'|'stage';grant:RewardGrant;index?:number}[];
}
export interface RunResult {
  chestId?:string;
  contributions?:import('./battle').BattleState['contributions'];
  runId: string; levelId: number; victory: boolean; waves: number;
  baseGold: number; firstClearGold: number; combatSeconds: number; at: number; doubled: boolean;
  /** Actual material grants for this settlement. Missing means an older, unrecorded receipt; {} means none. */
  materials?: Partial<Record<Material, number>>;
  mode?: RunMode;
  skillBooks?: Partial<Record<SkillId,number>>;
  stages?: {wave:number;grants:RewardGrant[]}[];
  broughtIds?: string[];
  bestWave?: number;
}
export interface Settings { music: number; effects: number; quality: 'high' | 'low'; reducedMotion: boolean; autoSkills?:boolean;manualSkillTurtles?:string[] }
export type AdKind = 'stamina' | 'doubleGold' | 'refresh';
export interface GameSave {
  solo?:import("./soloProgress").SoloProgress;
  patrol?:import('./patrol').PatrolState;
  taskJournal?:import('./taskPolicy').TaskJournal;
  livingVersion?:1;
  mailbox?:import('./mail').Mailbox;
  bookPacks?:Partial<Record<BookPackGrade,number>>;
  progression?:import("./progression").ProgressionState;
  avatar?:{role:Role;image?:string};
  homeTeam?:string[];
  collectionOrder?:string[];
  economyVersion?:2|3;
  shop?:import('./shop').ShopState;
  schema: 1;
  community?: import('./communityTypes').CommunityState;
  revision: number;
  idCounter: number;
  rng: number;
  createdAt: number;
  clockHighWater: number;
  gold: number;
  stamina: number;
  staminaAt: number;
  materials: Record<Material, number>;
  /** Omitted in older saves; absence means no books, never a retroactive reward. */
  skillBooks?: Partial<Record<SkillId, number>>;
  collection: Record<string, Turtle>;
  history: Record<string, HistoricalTurtle>;
  capacity: number;
  unlockedLevel: number;
  cleared: number[];
  tutorialDone: boolean;
  tutorialStarted: boolean;
  settings: Settings;
  dailyAds: { day: string; total: number; counts: Record<AdKind, number> };
  run?: RunState;
  results: Record<string, RunResult>;
  commands: Record<string, { kind: string; result: unknown }>;
  rulesVersion?: '0.6';
  /** Preserve pre-existing >50 archives; this never permits adding above 50. */
  legacyCollectionAllowance?: number;
  outsideFusion?: OutsideFusion;
  bookReveal?: {commandId:string;receipt:import('./skillBooks').SkillBookReceipt;turtle:Turtle};
  endlessBest?: {waves:number;at:number;team:Turtle[]};
}
export interface SkillDefinition { specialization?:boolean; requires?:SkillId; precious?:boolean; id: SkillId; name: string; description: string; role?: Role; active?: boolean; cooldown?: number }
export interface RoleDefinition {
  id: Role; name: string; job: string; gender: Gender; color: string;
  health: number; attack: number; interval: number; armor: number; resist: number; range: number;
  starters: SkillId[];
}
export interface Point { x: number; z: number }
export type EnemyKind = 'ink' | 'runner' | 'armored' | 'mist' | 'snail' | 'elite' | 'boss';
export interface EnemyDefinition {
  id: EnemyKind; name: string; health: number; armor: number; resist: number;
  speed: number; attack: number; interval: number; range: number; leak: number;
}
export interface Spawn { rations?:number; bounty?:boolean; kind: EnemyKind; time: number; hpScale: number; attackScale: number; routeId?:number }
export interface LevelDefinition {
  sceneRevision?:number;
  stationVersion?:2|3|4|5|6; sceneArt?:string;sceneMirror?:boolean;
  layoutVersion?:2;
  routes?:Point[][];routeLabels?:string[];legacySlots?:Point[];
  sceneTheme?:number;hard?:boolean;
  id: number; name: string; subtitle: string; waves: number; targetSeconds: [number, number];
  spawnDuration: number; preparationSeconds: number; mergeWaves: number[];
  route: Point[]; slots: Point[]; difficulty: number;
}

