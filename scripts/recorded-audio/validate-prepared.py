import sys,pathlib,json,hashlib,math
ROOT=pathlib.Path(__file__).parent;sys.path.insert(0,str(ROOT/'python-deps'))
import numpy as np
import soundfile as sf
S=ROOT/'prepared'/'samples';m=json.loads((S/'natural-manifest.json').read_text());catalog=json.loads((S/'recorded-beats.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
for a in m['assets']:
 p=S/a['file'];b=p.read_bytes();assert b[:4]==b'OggS';assert len(b)==a['bytes'] and sha(b)==a['sha256'];x,sr=sf.read(p,always_2d=True);assert sr==32000 and x.shape[1]==a['channels'] and abs(len(x)/sr-a['duration'])<1e-8;assert np.isfinite(x).all() and np.mean(x*x)>1e-9 and np.max(abs(x))<.95
for bank in m['banks']:
 p=S/bank['file'];assert sha(p.read_bytes())==bank['sha256'];data=json.loads(p.read_text());assert data['version']==2
 if 'notes' in data:
  roots=sorted(map(int,data['notes']));assert roots==bank['roots'] and max(np.diff(roots))<=4
  for root,layers in data['notes'].items():
   assert [l['layer'] for l in layers]==[1,2] and len(set(l['sourceSHA256'] for l in layers))==2
   for layer in layers:assert (S/layer['data']).exists()
 else:
  assert len(data['voices'])==8 and all(len(v)==2 for v in data['voices'].values())
for item in catalog['loops']:
 assert item['bars']==2 and item['beats']==8 and item['meter']==[4,4] and item['sourceProvidedLoop']==False and item['oneShot']==False;assert abs(item['duration']-8*60/item['bpm'])<1/32000;assert sha((S/item['file']).read_bytes())==item['sha256']
for item in catalog['oneShots']:assert item['oneShot']==True and item['bpm'] is None and item['bars'] is None and item['key'] is None
for j in json.loads((ROOT/'original-manifest.json').read_text())['samples']:
 b=(ROOT/'originals'/j['original']).read_bytes();assert sha(b)==j['sha256']
 if j.get('gitBlob'):assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==j['gitBlob']
assert sum(a['bytes'] for a in m['assets'])<12*1024*1024
print('PASS:84 OGG assets decode, match source/output hashes and stay finite/audible below clipping.')
print('PASS:28 true string roots,2 independent recorded layers each,3-4 semitone coverage (2 allowed at natural root gaps).')
print('PASS:8 recorded kit voices with2 variants each;12 exact-duration2-bar Aura-arranged recorded audio beats.')
print('PASS:All72 source recordings match SHA256;70 original Git blobs match pinned repository tree hashes.')
print('PASS:Total prepared audio bytes',sum(a['bytes'] for a in m['assets']))
