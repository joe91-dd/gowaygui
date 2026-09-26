const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const build = process.env.GOWAYGUI_TEST_BUILD || path.join(__dirname, '../.test-build');
const { validateBattle } = require(path.join(build, 'core/battleValidation.js'));
const { createBattle, stepBattle, commandBattle, getBattleEvents } = require(path.join(build, 'core/battle.js'));
const { LEVELS, ROLES, SKILLS } = require(path.join(build, 'core/data.js'));

const clone = value => JSON.parse(JSON.stringify(value));
function input(role, slot, level = 4) {
  const common = SKILLS.filter(s => !s.precious && !s.role && !["rebirth","sleep","extraTarget","taunt","pursuit"].includes(s.id)).slice(2).map(s => s.id);
  const exclusive = SKILLS.filter(s => s.role === role && !s.specialization).map(s => s.id);
  return { id:`unit-${role}`, slot, level, turtle:{ id:`turtle-${role}`, role, name:'',
    skills:[...common, ...exclusive], innate:{attack:80,health:80,defense:80,growth:100},
    training:{attack:0,health:0,defense:0,growth:0}, generation:0, bornAt:0, parentIds:[], locked:false } };
}
function fresh(levelId = 2, wave = 5) {
  return createBattle(levelId, wave, Object.keys(ROLES).map((role, i) => input(role, i)), {seed:1234567});
}
function moving() { const state=fresh(); stepBattle(state,8.375); return state; }
function reject(mutator, state = moving()) {
  mutator(state);
  assert.throws(() => validateBattle(state), error => error instanceof Error && /^战斗存档损坏：/.test(error.message));
}

test('real createBattle/stepBattle states throughout all five levels pass before and after JSON restoration', () => {
  const seen = { enemyKinds:new Set(), eventTypes:new Set(), statuses:new Set(), shields:0, commands:0, samples:0 };
  for (const level of LEVELS) {
    for (let wave=1;wave<=level.waves;wave++) {
      const state=createBattle(level.id,wave,Object.keys(ROLES).map((role,i)=>input(role,i,Math.min(wave,10))),{seed:wave*19+level.id});
      validateBattle(state);
      for (let step=0;step<360 && state.status==='fighting';step++) {
        for(const unit of (step%9===0?state.units:[])) {
          commandBattle(state,{type:'cast',unitId:unit.id,skillId:unit.skills.find(id=>SKILLS.find(s=>s.id===id)?.active)});
          validateBattle(state); seen.commands+=state.commands.length;
        }
        stepBattle(state,[.375,.625,.5][step%3]);
        validateBattle(state);
        const restored=clone(state); validateBattle(restored);
        assert.deepEqual(restored,state);
        seen.samples++;
        for(const e of state.enemies)seen.enemyKinds.add(e.kind);
        for(const e of state.events)seen.eventTypes.add(e.type);
        for(const u of [...state.units,...state.enemies])for(const status of u.statuses)seen.statuses.add(status.kind);
        seen.shields+=state.units.reduce((sum,u)=>sum+u.shields.length,0);
        if(step%5===0){getBattleEvents(state);validateBattle(state);}
      }
      assert.notEqual(state.status,'fighting',`${level.name} wave ${wave} exceeded the validation sample horizon`);
      validateBattle(state);
    }
  }
  assert.ok(seen.samples>1000);
  for(const kind of ['ink','runner','armored','mist','snail','elite','boss'])assert.ok(seen.enemyKinds.has(kind),kind);
  for(const type of ['attack','damage','heal','shield','control','spawn','defeat','waveEnd'])assert.ok(seen.eventTypes.has(type),type);
  assert.ok(seen.shields>0 && seen.commands>0);
});

test('zero-unit waves, leaks retaining positive HP, lost states and drained event queues are valid', () => {
  for(const coreHealth of [20,1]){
    const state=createBattle(0,1,[],{coreHealth});validateBattle(state);
    for(let i=0;i<200 && state.status==='fighting';i++){stepBattle(state,.5);validateBattle(state);}
    assert.ok(state.enemies.some(e=>!e.alive&&e.hp>0));
    assert.equal(state.status,coreHealth===1?'lost':'won');
    getBattleEvents(state);validateBattle(state);validateBattle(clone(state));
  }
});

test('validation has no mutation and serialized continuation remains identical', () => {
  const state=moving(), before=clone(state);validateBattle(state);assert.deepEqual(state,before);
  const resumed=clone(state);validateBattle(resumed);
  for(let i=0;i<80;i++){stepBattle(state,.125);stepBattle(resumed,.125);validateBattle(resumed);}
  assert.deepEqual(resumed,state);
});

test('every required top-level field rejects deletion', () => {
  const state=moving();
  // Older saved waves intentionally have no balance marker; compatibility is tested separately.
  const optional=new Set(['balanceVersion','mechanicsVersion','contributions','storms','summons','nextSummonId']);
  for(const key of Object.keys(state).filter(key=>!optional.has(key))) reject(s=>{delete s[key];},clone(state));
  const historical=clone(state);delete historical.balanceVersion;validateBattle(historical);
});

test('every required unit and enemy field rejects deletion', () => {
  const state=moving();assert.ok(state.enemies.length>0);
  const optionalUnit=new Set(['encouragedBy','auraTargetId','qualityTier']);
  const optionalEnemy=new Set(['blockedBy']);
  for(const key of Object.keys(state.units[0]).filter(k=>!optionalUnit.has(k)))reject(s=>{delete s.units[0][key];},clone(state));
  for(const key of Object.keys(state.enemies[0]).filter(k=>!optionalEnemy.has(k)))reject(s=>{delete s.enemies[0][key];},clone(state));
});

test('non-finite numbers, unsupported JSON values, sparse arrays and circular structures are rejected', () => {
  for(const bad of [NaN,Infinity,-Infinity]) {
    for(const change of [s=>s.elapsed=bad,s=>s.units[0].attack=bad,s=>s.enemies[0].hp=bad,s=>s.spawns[0].hpScale=bad,s=>s.extension={bad}])reject(change);
  }
  reject(s=>{s.units[0].drainHistory=[undefined];});
  reject(s=>{s.units[0].drainHistory=Array(2);});
  reject(s=>{s.extension=s;});
  reject(s=>{s.extension=1n;});
  reject(s=>{s.extension=()=>1;});
});

test('version, level, wave, tick consistency, remainder, core health and phase constraints are checked', () => {
  for(const change of [s=>s.version=2,s=>s.levelId=99,s=>s.wave=0,s=>s.wave=999,s=>s.tick=.5,
    s=>s.elapsed+=.1,s=>s.pendingSeconds=.05,s=>s.pendingSeconds=.25,s=>s.rng=-1,s=>s.rng=2**32,s=>s.status='unknown',
    s=>s.coreHealth=21,s=>s.coreHealth=0,s=>s.status='won'])reject(change);
  const lost=createBattle(0,1,[],{coreHealth:1});stepBattle(lost,120);validateBattle(lost);
  reject(s=>s.pendingSeconds=.01,lost);
});

test('routes, unique entity IDs, archive IDs, slots and legal compatible skill pools are checked', () => {
  for(const change of [s=>s.route=[],s=>s.route[1]={...s.route[0]},s=>s.routeLength+=1,
    s=>s.units[1].id=s.units[0].id,s=>s.enemies[0].id=s.units[0].id,
    s=>s.enemies.push({...s.enemies[0]}),s=>s.units[1].turtleId=s.units[0].turtleId,
    s=>s.units[1].slot=s.units[0].slot,s=>s.units[0].slot=5,s=>s.units[0].level=11,
    s=>s.units[0].role='unknown',s=>s.units[0].skills=['not-a-skill'],
    s=>s.units[0].skills=['armor','armor'],s=>s.units[0].skills=['greatHeal'],
    s=>s.units[0].skills=SKILLS.filter(k=>!k.role||k.role==='stone').slice(0,13).map(k=>k.id),
    s=>s.units[0].cooldowns.greatHeal=30,s=>s.units[0].skillActivations.unknown=1])reject(change);
});

test('health bounds, interval, shields, statuses, source references and per-skill numeric maps are checked', () => {
  for(const change of [s=>s.units[0].hp=-1,s=>s.units[0].hp=s.units[0].maxHp+1,
    s=>s.units[0].maxHp=0,s=>s.units[0].hp=0,s=>s.units[0].interval=0,
    s=>s.units[0].shield+=1,s=>s.units[0].lastDamageTick=s.tick+1,
    s=>s.units[0].cooldowns={hold:NaN},s=>s.units[0].reflectTicks={missing:1},
    s=>s.units[0].drainHistory=[{tick:s.tick+1,amount:1}],
    s=>s.units[0].statuses=[{kind:'weaken',amount:2,untilTick:100,sourceId:s.enemies[0].id}],
    s=>s.units[0].statuses=[{kind:'unknown',amount:1,untilTick:100,sourceId:s.enemies[0].id}],
    s=>s.units[0].statuses=[{kind:'stun',amount:1,untilTick:100,sourceId:'missing'}],
    s=>s.units[0].statuses=Array(2).fill({kind:'stun',amount:1,untilTick:100,sourceId:s.enemies[0].id}),
    s=>s.units[0].shields=[{amount:1,untilTick:100,sourceId:s.units[1].id,skillId:'hold'}],
    s=>s.enemies[0].blockedBy='missing',s=>s.enemies[0].kind='unknown',s=>s.enemies[0].speed=-1])reject(change);
});

test('spawn cursors, queued commands, event structure, counters and references reject inconsistent state', () => {
  for(const change of [s=>s.spawnCursor=s.spawns.length+1,s=>s.spawnCursor=-1,
    s=>s.spawns[0].time=-1,s=>s.spawns[0].hpScale=0,s=>s.spawns[0].kind='unknown',
    s=>s.nextEnemyId=0,s=>s.kills++,s=>s.leaked++,s=>s.nextEventId=1,
    s=>s.events[0].tick=s.tick+1,s=>s.events[0].sourceId='missing',
    s=>s.events[0].type='unknown',s=>s.events[0].skillId='unknown',s=>s.events[0].critical='yes',
    s=>s.events.push({...s.events.at(-1)}),s=>{delete s.events[0].sourceId;},
    s=>s.commands=[{type:'unknown',unitId:s.units[0].id,skillId:'hold'}],
    s=>s.commands=[{type:'cast',unitId:'missing',skillId:'hold'}],
    s=>s.commands=[{type:'cast',unitId:s.units[0].id,skillId:'greatHeal'}],
    s=>s.commands=Array(2).fill({type:'cast',unitId:s.units[0].id,skillId:'hold'})])reject(change);
});
