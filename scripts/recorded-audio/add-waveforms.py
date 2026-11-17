import sys,pathlib,json
ROOT=pathlib.Path(__file__).parent;sys.path.insert(0,str(ROOT/'python-deps'))
import soundfile as sf
import numpy as np
p=ROOT/'prepared'/'samples'/'recorded-beats.json';c=json.loads(p.read_text())
for a in c['loops']+c['oneShots']:
 x,sr=sf.read(p.parent/a['file'],always_2d=True);m=np.max(abs(x),axis=1);bins=np.array_split(m,48);a['waveform']=[round(float(np.max(b)) if len(b) else 0,4) for b in bins]
p.write_text(json.dumps(c,indent=2)+'\n')
