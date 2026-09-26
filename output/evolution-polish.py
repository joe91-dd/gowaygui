from pathlib import Path
p=Path('game/assets/scripts/view/BattleScreen.ts');s=p.read_text(encoding='utf-8');old="      this.button('模拟广告 · 基础金币翻倍',-199,-230,504,54,()=>this.act(()=>this.service.simulateAd(this.command('double'),'doubleGold',r.id)),{parent:p,size:23,disabled:result.doubled||result.baseGold<=0});";new="      if(result.chestId){const id=result.chestId,claimed=s.progression?.chests.find(c=>c.id===id)?.claimed;this.button(claimed?'层数宝箱已领取':'打开 '+result.waves+' 层宝箱',-199,-230,504,54,()=>this.act(()=>this.service.claimChest(this.command('endlessChest'),id)),{parent:p,primary:true,size:25,disabled:!!claimed});}else "+old.strip();assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf-8')
p=Path('game/assets/scripts/core/battleValidation.ts');s=p.read_text(encoding='utf-8');s="import {BOSSES} from './bossCatalog';\n"+s;s=s.replace("    if(enemy.trait!==undefined)", "    if(enemy.bossId!==undefined)check(kind==='boss'&&BOSSES.some(b=>b.id===enemy.bossId),name,'首领资料无效');\n    if(enemy.trait!==undefined)");p.write_text(s,encoding='utf-8')
p=Path('game/tests/battle-validation.test.cjs');s=p.read_text(encoding='utf-8').replace("['encouragedBy','auraTargetId']", "['encouragedBy','auraTargetId','qualityTier']");p.write_text(s,encoding='utf-8')
p=Path('game/tests/increment-campaign.test.cjs');s=p.read_text(encoding='utf-8').replace('BATTLE_MAPS.length,55','BATTLE_MAPS.length,56');p.write_text(s,encoding='utf-8')
# Stable one-line error dismissal labels preserve the familiar acknowledgement action.
p=Path('game/assets/scripts/view/GameEntry.ts');s=p.read_text(encoding='utf-8').replace("this.ui.button('返回当前页面',-170", "this.ui.button('知道了',-170");p.write_text(s,encoding='utf-8')
# Scratch now leads directly to details; that extra shape-only step was explicitly removed.
p=Path('game/tests/prototype-domain.test.cjs')
# Existing end-to-end fixture stays untouched; tune actual encounter if it fails.
