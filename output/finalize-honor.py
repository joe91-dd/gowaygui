from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'game/assets/scripts/view/CommunityMenus.ts';s=p.read_text(encoding='utf-8')
s=s.replace("name:r.ownerName,metric:'评分 '","name:r.ownerName,subject:this.petName(r.turtle),metric:'评分 '")
s=s.replace('.show(pet??r.turtle)', '.show(pet??r.turtle,{readOnly:r.ownerId!==LOCAL_PLAYER})')
s=s.replace('.show(pet);else this.ui.toast', '.show(pet,{readOnly:r.id!==LOCAL_PLAYER});else this.ui.toast')
# Only arenaRankDetail needs the owner-aware read-only option.
a=s.index('  private arenaRankDetail(');b=s.index('  private arenaDetails(',a)
s=s[:a]+s[a:b].replace('.show(t)', '.show(t,{readOnly:!own})').replace('.show(pet)', '.show(pet,{readOnly:!own})')+s[b:]
p.write_text(s,encoding='utf-8')
p=r/'game/assets/scripts/view/HonorBoard.ts';s=p.read_text(encoding='utf-8').replace('this.petMode?-108:-223','this.petMode?-108:-229');p.write_text(s,encoding='utf-8')
print('Final honor refinements applied')
