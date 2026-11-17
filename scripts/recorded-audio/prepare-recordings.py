import sys,json,pathlib,hashlib,math,re,shutil
ROOT=pathlib.Path(__file__).parent
sys.path.insert(0,str(ROOT/'python-deps'))
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
OUT=ROOT/'prepared'/'samples';OUT.mkdir(parents=True,exist_ok=True)
for d in ['natural-violin','natural-cello','natural-kit','recorded-beats','natural-sources']:(OUT/d).mkdir(exist_ok=True)
original=json.loads((ROOT/'original-manifest.json').read_text());jobs=original['samples'];SR=32000
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(j):
 x,sr=sf.read(ROOT/'originals'/j['original'],always_2d=True,dtype='float32');assert np.isfinite(x).all();return x,sr
def compact(x,sr,limit):
 mono=np.max(np.abs(x),axis=1);peak=float(mono.max());found=np.flatnonzero(mono>max(.0001,peak*.001));first=max(0,int(found[0]) - int(sr*.03)) if len(found) else 0
 x=x[first:min(len(x),first+int(limit*sr))];g=math.gcd(sr,SR);x=resample_poly(x,SR//g,sr//g,axis=0).astype(np.float32);fade=min(len(x)//3,int(SR*.08));x[:min(64,len(x))]*=np.linspace(0,1,min(64,len(x)))[:,None];x[-fade:]*=np.linspace(1,0,fade)[:,None];return x,first/sr
def output(rel,x):
 p=OUT/rel;sf.write(p,x,SR,format='OGG',subtype='VORBIS');decoded,sr=sf.read(p,always_2d=True);assert sr==SR and len(decoded)==len(x) and np.isfinite(decoded).all() and np.mean(decoded*decoded)>1e-9;return {'file':rel,'sha256':sha(p),'bytes':p.stat().st_size,'sampleRate':SR,'channels':x.shape[1],'duration':len(x)/SR,'peak':float(np.max(np.abs(decoded)))}
semitones={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
assets=[];banks=[];all_data={}
for group,name,program,offset in [('natural-violin','Live Violin',40,0),('natural-cello','Bowed Cellos',42,12)]:
 selected=[j for j in jobs if j['group']==group];data=[];global_peak=0
 for j in selected:
  x,sr=load(j);source_duration=len(x)/sr;x,trim=compact(x,sr,8);global_peak=max(global_peak,float(np.max(np.abs(x))));data.append((j,x,trim,source_duration))
 bank={'version':2,'id':group,'name':name,'source':'vsco-2-ce','program':program,'license':'CC0-1.0','velocity':{'layers':2,'splits':[70],'crossfadeWidth':16,'preserveRecordedLevels':True},'playback':{'loop':False,'maximumRetainedSeconds':8,'note':'Original recorded bow attack and sustain retained; no guessed sustain loop. Notes longer than the retained recording fade naturally out.'},'notes':{}}
 for j,x,trim,source_duration in data:
  m=re.search(r'_([A-G])([0-9])_',j['path']);midi=(int(m[2])+1)*12+semitones[m[1]]+offset;layer=1 if re.search(r'_p.wav$|_v1_1.wav$',j['path']) else 2;rel=f'{group}/{midi}-layer{layer}.ogg';x=x*(.82/(global_peak or 1));info=output(rel,x);info.update({'sourceRepo':j['repo'],'sourceCommit':j['commit'],'sourcePath':j['path'],'sourceGitBlob':j.get('gitBlob'),'sourceSHA256':j['sha256'],'sourceDuration':source_duration,'trimStartSeconds':trim,'pitch':midi,'layer':layer,'sourceFilenameOctaveOffset':offset});assets.append(info);bank['notes'].setdefault(str(midi),[]).append({'layer':layer,'data':rel,'sourcePath':j['path'],'sourceSHA256':j['sha256'],'loop':False})
 for layers in bank['notes'].values():layers.sort(key=lambda a:a['layer']);assert [s['layer'] for s in layers]==[1,2]
 roots=sorted(map(int,bank['notes']));assert max(np.diff(roots))<=4;bank['nativeRange']=[roots[0],roots[-1]];p=OUT/(group+'.json');p.write_text(json.dumps(bank,separators=(',',':'))+'\n');banks.append({'id':group,'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size,'roots':roots,'layers':2,'nativeRange':bank['nativeRange'],'program':program,'name':name,'loop':False});print(group,len(roots),'roots',bank['nativeRange'])
limits={'kick':1.2,'snare':2,'clap':1,'hat-closed':.6,'hat-open':3,'tom':2.5,'rim':1,'crash':5.5}
kit={'version':2,'id':'natural-kit','name':'Live Room Kit','source':'virtuosity-drums-vcsl','license':'CC0-1.0','voices':{}};hits={}
for voice,limit in limits.items():
 family=[]
 for j in [j for j in jobs if j['group']=='natural-kit' and j['voice']==voice]:
  x,sr=load(j);x,trim=compact(x,sr,limit);family.append((j,x,trim))
 peak=max(float(np.max(np.abs(x))) for j,x,trim in family)
 for j,x,trim in family:
  x=x*(.78/(peak or 1));rel=f'natural-kit/{voice}-{j["variant"]}.ogg';info=output(rel,x);info.update({'sourceRepo':j['repo'],'sourceCommit':j['commit'],'sourcePath':j['path'],'sourceGitBlob':j.get('gitBlob'),'sourceSHA256':j['sha256'],'trimStartSeconds':trim,'oneShot':True,'bpm':None,'bars':None,'key':None,'voice':voice,'variant':j['variant']});assets.append(info);kit['voices'].setdefault(voice,[]).append({'data':rel,'sourcePath':j['path'],'sourceSHA256':j['sha256']});hits.setdefault(voice,[]).append(x)
p=OUT/'natural-kit.json';p.write_text(json.dumps(kit,separators=(',',':'))+'\n');banks.append({'id':'natural-kit','file':p.name,'sha256':sha(p),'bytes':p.stat().st_size,'name':'Live Room Kit','voices':8,'variants':2})
# These are new Aura arrangements of CC0 recordings, not loops supplied by the source drummer.
patterns=[
 ('pocket-acoustic','Pocket Acoustic',78,'Hip-hop',[0,1.5,4,6.5],[1,3,5,7],.5,0,'hat-closed'),
 ('easy-rock','Easy Rock',96,'Rock',[0,2,4,6],[1,3,5,7],.5,0,'hat-closed'),
 ('indie-drive','Indie Drive',118,'Indie',[0,1.5,2,4,5.5,6],[1,3,5,7],.5,0,'hat-closed'),
 ('jazz-ride','Jazz Room',110,'Jazz',[0,4],[3,7],.5,.17,'crash'),
 ('half-time-room','Half-time Room',82,'Hip-hop',[0,1.5,4,5.75],[2,6],.5,0,'hat-closed'),
 ('four-floor-live','Four on the Floor',124,'House',[0,1,2,3,4,5,6,7],[1,3,5,7],.5,0,'hat-open'),
 ('offbeat-room','Offbeat Room',90,'Reggae',[0,4],[2,6],.5,0,'hat-closed'),
 ('funk-pockets','Funk Pockets',106,'Funk',[0,.75,2.5,4,4.75,6.5],[1,3,5,7],.25,0,'hat-closed'),
 ('shuffle-room','Shuffle Room',102,'Blues',[0,2,4,6],[1,3,5,7],.5,.16,'hat-closed'),
 ('cross-stick-chill','Cross-stick Chill',86,'Chill',[0,2.5,4,6.5],[1,3,5,7],.5,0,'hat-closed'),
 ('acoustic-break','Acoustic Break',132,'Breakbeat',[0,1.5,3.5,4,6],[1,3,5,7],.5,0,'hat-closed'),
 ('tom-turnaround','Tom Turnaround',112,'Rock',[0,2,4,6],[1,3,5],.5,0,'hat-closed')
]
loops=[]
for id,name,bpm,genre,kicks,snares,step,swing,hat in patterns:
 n=int(round(8*60/bpm*SR));mix=np.zeros((n,2),dtype=np.float32);events=[]
 for b in kicks:events.append((b,'kick',.92))
 for b in snares:events.append((b,'rim' if id in ['cross-stick-chill','offbeat-room'] else 'snare',.86))
 for i,b in enumerate(np.arange(0,8,step)):
  if id=='jazz-ride':
   # Light cymbal color; no claim this is a ride sample.
   if i%2:continue
   b=float(b);v='hat-open';gain=.28
  else:b=float(b)+(swing if i%2 else 0);v=hat if not(hat=='hat-open' and i%2==0) else 'hat-closed';gain=.28 if i%2 else .35
  events.append((b,v,gain))
 if id=='funk-pockets':events.extend([(2.75,'snare',.2),(6.75,'snare',.23)])
 if id=='tom-turnaround':events.extend([(6.5,'tom',.65),(7,'tom',.72),(7.5,'snare',.8)])
 events.sort();counts={}
 for beat,voice,gain in events:
  variant=counts.get(voice,0)%len(hits[voice]);counts[voice]=counts.get(voice,0)+1;x=hits[voice][variant];x=x if x.shape[1]==2 else np.repeat(x,2,axis=1);start=int(round(beat*60/bpm*SR));indices=(np.arange(len(x))+start)%n;np.add.at(mix,indices,x*gain)
 peak=float(np.max(np.abs(mix)));mix*=.86/(peak or 1);rel=f'recorded-beats/{id}-{bpm}.ogg';info=output(rel,mix);assets.append(info);loops.append({'id':id,'name':name,'kind':'recorded-loop','category':'Drums','genre':genre,'bpm':bpm,'bars':2,'beats':8,'meter':[4,4],'key':None,'oneShot':False,'file':rel,'duration':n/SR,'sha256':info['sha256'],'bytes':info['bytes'],'source':'Virtuosity Drums acoustic recordings; arranged by Aura','sourceProvidedLoop':False,'arranger':'Aura','license':'CC0-1.0','arrangement': [{'beat':round(b,6),'voice':v,'gain':g} for b,v,g in events]})
(OUT/'recorded-beats.json').write_text(json.dumps({'version':1,'loops':loops,'oneShots':[{**a,'name':a['voice'].replace('-',' ').title()+' '+str(a['variant']),'kind':'recorded-one-shot','category':'Drums','source':'VCSL recorded hand clap' if a['voice']=='clap' else 'Virtuosity Drums acoustic kit','license':'CC0-1.0'} for a in assets if a.get('oneShot')]},indent=2)+'\n')
for name in ['vsco-LICENSE','vsco-README.md','virtuosity-LICENSE','virtuosity-README.md','vcsl-LICENSE','vcsl-README.md']:shutil.copyfile(ROOT/name,OUT/'natural-sources'/name)
manifest={'version':1,'license':'CC0-1.0','sources':{'vsco':{'repository':'https://github.com/sgossner/VSCO-2-CE','commit':'440300901dfe9275fd84e0b7763af1f8443ae62e'},'virtuosity':{'repository':'https://github.com/sfzinstruments/virtuosity_drums','commit':'9f04cf9a734527edfbb0a4eee1f674e45bbf71bc'},'vcsl':{'repository':'https://github.com/sgossner/VCSL','commit':'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'}},'banks':banks,'assets':assets,'process':{'rate':SR,'format':'OGG Vorbis','channels':'Original stereo preserved; mono drum close mics remain mono','resampling':'scipy.signal.resample_poly','stringsMaximumSeconds':8,'perFamilyGain':'One common peak scale per bank/voice; recorded layer differences preserved','tail':'80ms fade at the end of retained samples; beat tails wrap across loop boundary','arrangements':'Aura authored, rendered only from the recorded kit hits. No source-provided loop or AI/synthetic performance claim.'}}
(OUT/'natural-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('assets',len(assets),'audio bytes',sum(a['bytes'] for a in assets),'loops',len(loops));assert sum(a['bytes'] for a in assets)<20*1024*1024
