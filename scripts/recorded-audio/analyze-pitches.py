import sys,json,pathlib,math
sys.path.insert(0,str(pathlib.Path(__file__).parent/'python-deps'))
import soundfile as sf
import numpy as np
base=pathlib.Path(__file__).parent
manifest=json.loads((base/'original-manifest.json').read_text())
for j in manifest['samples']:
 if not (('susvib_C1_' in j['path']) or ('LLVln_ArcoVib_C4_' in j['path']) or ('susvib_A2_' in j['path'])):continue
 data,sr=sf.read(base/'originals'/j['original'],always_2d=True)
 mono=np.mean(data,axis=1);seg=mono[int(.7*sr):int(2.7*sr)];spec=abs(np.fft.rfft(seg*np.hanning(len(seg)),n=262144));freq=np.fft.rfftfreq(262144,1/sr)
 out=[]
 for midi in [24,36,48,57,60,69]:
  target=440*2**((midi-69)/12);mask=(freq>target*.98)&(freq<target*1.02);idx=np.where(mask)[0][np.argmax(spec[mask])];out.append([midi,round(float(freq[idx]),2),round(float(spec[idx]),3)])
 print(j['path'],sr,data.shape,len(data)/sr,out)
