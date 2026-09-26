from pathlib import Path
import json,subprocess,os,hashlib,datetime
R=Path(__file__).resolve().parent;W=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');blender=W/'tmp/tools/blender-4.5.13-windows-x64/blender.exe'
state={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'serial-two-threads','done':[]}
for ID in ['B10','M03','M04','M02','M05','E01','B07']:
 for step in (['review_runtime'] if ID=='B07' else ['build_enemy','finish_materials','review_runtime']):
  print('RECOVERY_START',ID,step,flush=True)
  log=R/f'recovery-{ID}-{step}.log'
  with log.open('w',encoding='utf8') as stream:
   done=subprocess.run([str(blender),'-b','-t','2','--python-exit-code','1','--python',str(R/(step+'.py')),'--',ID],cwd=W,stdout=stream,stderr=subprocess.STDOUT)
   stream.flush();os.fsync(stream.fileno())
  if done.returncode:raise RuntimeError(f'{ID} {step} failed; see {log.name}')
  text=log.read_text('utf8',errors='replace')
  marker={'build_enemy':'ENEMY_RIG_BUILT','finish_materials':'MATERIALS_FINISHED','review_runtime':'FBX_VERIFIED'}[step]
  if marker not in text:raise RuntimeError('Missing success marker: '+ID+' '+step)
  state['done'].append(ID+':'+step)
  with (R/'recovery-status.json').open('w',encoding='utf8') as stream:
   json.dump(state,stream,indent=2);stream.flush();os.fsync(stream.fileno())
  print('RECOVERY_DONE',ID,step,flush=True)
print('RECOVERY_BATCH_COMPLETE',flush=True)