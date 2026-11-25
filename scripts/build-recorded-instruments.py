#!/usr/bin/env python3
"""Build Aura's recorded instrument banks from pinned CC0 sources (VSCO 2 CE, VCSL).

Usage: python3 scripts/build-recorded-instruments.py --sources /path/to/clones [--only id,id]

Each source is a git clone at the pinned commit (a --filter=blob:none clone is enough; blobs are fetched on demand).
For every bank the script: selects roots and velocity layers from the source file names, verifies each sample's
pitch against its name (and fixes a consistent octave offset in a source's naming), trims leading silence, keeps
up to `seconds` of the recording with a short fade, resamples to 44.1 kHz, applies one common gain per bank
(recorded layer differences are preserved) and encodes OGG Vorbis. Provenance (path, git blob, SHA-256) is written
to samples/recorded-manifest.json.
"""
import argparse, hashlib, io, json, math, os, re, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'samples')
SR = 44100
PINS = {'vsco': ('VSCO-2-CE', 'https://github.com/sgossner/VSCO-2-CE', '440300901dfe9275fd84e0b7763af1f8443ae62e'),
        'vcsl': ('VCSL', 'https://github.com/sgossner/VCSL', 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e')}
NOTE = re.compile(r'(?:^|[_\-\s])([A-G])(#|s|b)?(-?\d)(?=[_\-.]|$)')
SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
DYN = {'ppp': 1, 'pp': 2, 'p': 3, 'mp': 4, 'mf': 5, 'f': 6, 'ff': 7, 'fff': 8,
       'soft': 2, 'quiet': 2, 'med': 5, 'medium': 5, 'loud': 7, 'hard': 7}


def midi_of(name):
    m = None
    for m in NOTE.finditer(os.path.splitext(name)[0]):
        pass
    if not m:
        return None
    letter, acc, octave = m.groups()
    return 12 * (int(octave) + 1) + SEMI[letter] + (1 if acc in ('#', 's') else -1 if acc == 'b' else 0)


def layer_of(name, mode):
    base = os.path.splitext(name)[0]
    if mode == 'vl':
        m = re.search(r'_vl?(\d+)(?:_|$)', base)
        return int(m.group(1)) if m else None
    if mode == 'dyn':
        for tok in re.split(r'[_\-]', base.lower()):
            t = re.sub(r'\d+$', '', tok)
            if t in DYN:
                return DYN[t]
        return None
    if mode == 'none':
        return 1
    raise ValueError(mode)


def rr_of(name):
    m = re.search(r'_rr(\d+)|_(\d+)\.(?:wav|flac)$|_RR(\d+)', name)
    return int(next(g for g in m.groups() if g)) if m else 1


def yin_f0(x, sr, fmin=25, fmax=2500):
    x = x - x.mean()
    n = min(len(x), int(sr * .2))
    if n < 2048:
        return None
    x = x[:n]
    tmax, tmin = int(sr / fmin), max(2, int(sr / fmax))
    tmax = min(tmax, n // 2)
    d = np.array([np.sum((x[:n - tmax] - x[t:t + n - tmax]) ** 2) for t in range(tmax)])
    d[0] = 1
    cm = d * np.arange(tmax) / np.maximum(np.cumsum(d), 1e-12)
    cand = np.where(cm[tmin:] < .15)[0]
    t = (cand[0] + tmin) if len(cand) else int(np.argmin(cm[tmin:]) + tmin)
    while t + 1 < tmax and cm[t + 1] < cm[t]:
        t += 1
    if cm[t] > .45:
        return None
    if 1 <= t < tmax - 1:
        a, b, c = cm[t - 1], cm[t], cm[t + 1]
        den = a - 2 * b + c
        t = t + (.5 * (a - c) / den if den else 0)
    f = sr / t if t > 0 else None
    return f if f and fmin <= f <= fmax * 1.2 else None


class Source:
    def __init__(self, base, key):
        self.key = key
        self.dir = os.path.join(base, PINS[key][0])
        head = subprocess.run(['git', '-C', self.dir, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
        if head != PINS[key][2]:
            sys.exit(f'{key} clone is at {head}, expected pinned {PINS[key][2]}')
        out = subprocess.run(['git', '-C', self.dir, 'ls-tree', '-r', 'HEAD'], capture_output=True, text=True).stdout
        self.files = {}
        for line in out.splitlines():
            meta, path = line.split('\t', 1)
            if path.lower().endswith(('.wav', '.flac')):
                self.files[path] = meta.split()[2]
        lic = subprocess.run(['git', '-C', self.dir, 'show', 'HEAD:LICENSE'], capture_output=True).stdout
        self.license = lic.decode('utf8', 'ignore')

    def list(self, folder, include=None, exclude=None):
        out = []
        for p in self.files:
            if not p.startswith(folder):
                continue
            name = p.rsplit('/', 1)[-1]
            if include and not re.search(include, name):
                continue
            if exclude and re.search(exclude, name):
                continue
            out.append(p)
        return sorted(out)

    def read(self, path):
        raw = subprocess.run(['git', '-C', self.dir, 'show', 'HEAD:' + path], capture_output=True, check=True).stdout
        data, sr = sf.read(io.BytesIO(raw), always_2d=True, dtype='float32')
        return data, sr, hashlib.sha256(raw).hexdigest()


def prepare(data, sr, seconds, stereo, pre=.008, gate_db=-48):
    if not stereo or data.shape[1] == 1:
        data = data.mean(axis=1, keepdims=True)
    else:
        data = data[:, :2]
    mono = np.abs(data).max(axis=1)
    thr = mono.max() * 10 ** (gate_db / 20)
    idx = np.argmax(mono > thr) if (mono > thr).any() else 0
    start = max(0, idx - int(pre * sr))
    data = data[start:start + int(seconds * sr)]
    if sr != SR:
        g = math.gcd(SR, sr)
        data = resample_poly(data, SR // g, sr // g, axis=0).astype('float32')
    fade = min(len(data), int(.08 * SR))
    data[-fade:] *= np.linspace(1, 0, fade)[:, None]
    fin = min(len(data), int(.003 * SR))
    data[:fin] *= np.linspace(0, 1, fin)[:, None]
    return data


def encode(data, path, quality):
    buf = io.BytesIO()
    sf.write(buf, data, SR, format='WAV', subtype='FLOAT')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'wav', '-i', 'pipe:0', '-c:a', 'libvorbis', '-q:a', str(quality), path],
                   input=buf.getvalue(), check=True)


def pick_layers(ranks, n):
    ranks = sorted(set(ranks))
    if n >= len(ranks):
        return ranks
    if n == 1:
        return [ranks[-1] if len(ranks) < 3 else ranks[len(ranks) // 2 + (len(ranks) % 2 == 0)]]
    return [ranks[round(i * (len(ranks) - 1) / (n - 1))] for i in range(n)]


def thin_roots(roots, spacing):
    roots = sorted(roots)
    keep = [roots[0]]
    for r in roots[1:]:
        if r - keep[-1] >= spacing:
            keep.append(r)
    if keep[-1] != roots[-1]:
        keep.append(roots[-1]) if roots[-1] - keep[-1] >= 2 else keep.__setitem__(-1, roots[-1])
    return keep


def group_shift(src, paths, layer_mode):
    """Detect a consistent octave offset in a folder's note names from a few samples."""
    diffs = []
    for p in paths[:: max(1, len(paths) // 8)][:8]:
        name = p.rsplit('/', 1)[-1]
        m = midi_of(name)
        if m is None:
            continue
        data, sr, _ = src.read(p)
        seg = data.mean(axis=1)
        a = np.argmax(np.abs(seg) > np.abs(seg).max() * .1)
        f0 = yin_f0(seg[a + int(.05 * sr):], sr)
        if f0:
            diffs.append(69 + 12 * math.log2(f0 / 440) - m)
    return int(round(np.median(diffs) / 12)) * 12 if len(diffs) >= 3 else 0


def build_pitched(src, d, manifest):
    table, shifts = {}, []
    for gi, (folder, inc, exc) in enumerate(d['from']):
        paths = src.list(folder, inc, exc)
        shift = group_shift(src, paths, d.get('layer', 'vl')) if d.get('verify', True) else 0
        shifts.append(shift)
        # loudness levels are made relative within each folder (0 = softest .. 1 = loudest), so sections that number
        # their dynamics differently (v1/v2 vs v1/v3) still line up
        own = sorted({layer_of(p.rsplit('/', 1)[-1], d.get('layer', 'vl')) for p in paths} - {None})
        rel = {r: (round(i / (len(own) - 1), 3) if len(own) > 1 else 1.0) for i, r in enumerate(own)}
        for p in paths:
            name = p.rsplit('/', 1)[-1]
            m = midi_of(name)
            lay = layer_of(name, d.get('layer', 'vl'))
            if m is None or lay is None:
                continue
            lay = rel[lay]
            key = (m + shift + d.get('transpose', 0), lay)
            if key in table and table[key][1] < gi:
                continue
            if key not in table or table[key][1] > gi or rr_of(name) < rr_of(table[key][0].rsplit('/', 1)[-1]):
                table[key] = (p, gi)
    table = {k: v[0] for k, v in table.items()}
    if not table:
        raise SystemExit(f"{d['id']}: no samples matched")
    n_layers = d.get('layers', 2)
    by_note = {}
    for (m, l) in table:
        by_note.setdefault(m, set()).add(l)
    lo, hi = d.get('range', (0, 127))
    roots = thin_roots([m for m in by_note if lo <= m <= hi], d.get('spacing', 3))
    # per note: the softest .. loudest takes that note actually has (recorded dynamics differ from note to note)
    choice = {}
    for r in roots:
        picked = pick_layers(sorted(by_note[r]), n_layers)
        while len(picked) < n_layers:
            picked.append(picked[-1])
        choice[r] = picked
    layers = list(range(n_layers))
    # read, verify pitch, prepare
    audio, offsets = {}, []
    cache = {}
    for r in roots:
        for li in layers:
            path = table[(r, choice[r][li])]
            if path not in cache:
                cache[path] = src.read(path)
            data, sr, sha = cache[path]
            audio[(r, li)] = (data, sr, sha, path)
            if d.get('verify', True):
                seg = data.mean(axis=1)
                a = np.argmax(np.abs(seg) > np.abs(seg).max() * .1)
                f0 = yin_f0(seg[a + int(.05 * sr):], sr)
                if f0:
                    offsets.append((r, li, 69 + 12 * math.log2(f0 / 440) - r))
    shift = 0
    if offsets:
        bad = {(r, li) for r, li, x in offsets if min(abs(x - k) for k in (0, 12, -12, 19, 24)) > 1.0}
        if len(bad) > len(offsets) * .35:
            print(f"  ! {d['id']}: pitch check inconclusive ({len(bad)}/{len(offsets)} off); keeping names")
            bad = set()
        for b in bad:
            audio.pop(b, None)
        # a note whose takes are all suspicious is dropped; a single odd take is replaced by the note's other take
        for r in roots:
            have = [li for li in layers if (r, li) in audio]
            if have and len(have) < len(layers):
                for li in layers:
                    audio.setdefault((r, li), audio[(r, have[-1] if li > have[-1] else have[0])])
    good_roots = [r for r in roots if all((r, li) in audio for li in range(len(layers)))]
    prepared = {k: prepare(v[0], v[1], d.get('seconds', 5), d.get('stereo', False)) for k, v in audio.items() if k[0] in good_roots}
    peak = max(float(np.abs(x).max()) for x in prepared.values())
    gain = (10 ** (-1 / 20)) / peak if peak else 1
    bank_id, notes, assets = d['id'], {}, []
    for r in good_roots:
        entry = []
        sounding = r + shift
        for li in range(len(layers)):
            data, sr, sha, path = audio[(r, li)]
            fname = f'{bank_id}/{sounding}-layer{li + 1}.ogg'
            encode(prepared[(r, li)] * gain, os.path.join(OUT, fname), d.get('quality', 4))
            entry.append({'layer': li + 1, 'data': fname, 'sourcePath': path, 'sourceSHA256': sha})
            assets.append({'file': fname, 'source': src.key, 'sourcePath': path, 'sourceGitBlob': src.files[path], 'sourceSHA256': sha,
                           'bytes': os.path.getsize(os.path.join(OUT, fname))})
        notes[str(sounding)] = entry if len(entry) > 1 else entry[0]['data']
    bank = {'version': 2, 'id': bank_id, 'name': d['name'], 'source': f"{src.key}:{d['from'][0][0]}", 'license': 'CC0-1.0',
            'notes': notes, 'nativeRange': [min(int(k) for k in notes), max(int(k) for k in notes)]}
    if len(layers) > 1:
        splits = [round(127 * (i + 1) / len(layers)) for i in range(len(layers) - 1)]
        bank['velocity'] = {'layers': len(layers), 'splits': splits, 'crossfadeWidth': 16, 'preserveRecordedLevels': True}
    bank['playback'] = {'loop': bool(d.get('loop')), 'maximumRetainedSeconds': d.get('seconds', 5)}
    with open(os.path.join(OUT, bank_id + '.json'), 'w') as f:
        json.dump(bank, f, separators=(',', ':'))
    manifest['banks'].append({'id': bank_id, 'name': d['name'], 'source': src.key, 'roots': [int(k) for k in notes], 'layers': len(layers),
                              'octaveCorrection': shifts, 'skippedForPitch': len(roots) - len(good_roots), 'assets': assets})
    total = sum(a['bytes'] for a in assets)
    print(f"  {bank_id}: {len(notes)} roots × {len(layers)} layers, range {bank['nativeRange']}, octave fix {shifts}, {total / 1048576:.1f} MB")


def build_kit(srcs, d, manifest):
    voices, assets = {}, []
    clips = {}
    for voice, (key, folder, pattern, count) in d['voices'].items():
        src = srcs[key]
        paths = [p for p in src.list(folder) if re.search(pattern, p.rsplit('/', 1)[-1])][:count]
        if not paths:
            raise SystemExit(f"{d['id']}: no samples for {voice} ({folder} / {pattern})")
        for i, p in enumerate(paths):
            data, sr, sha = src.read(p)
            clips[(voice, i)] = (prepare(data, sr, d.get('seconds', 2.5), False, gate_db=-40), p, sha, src)
    peak = max(float(np.abs(c[0]).max()) for c in clips.values())
    gain = (10 ** (-1 / 20)) / peak
    for (voice, i), (data, p, sha, src) in sorted(clips.items()):
        fname = f"{d['id']}/{voice}-{i + 1}.ogg"
        encode(data * gain, os.path.join(OUT, fname), 4)
        voices.setdefault(voice, []).append({'data': fname, 'sourcePath': p, 'sourceSHA256': sha})
        assets.append({'file': fname, 'source': src.key, 'sourcePath': p, 'sourceGitBlob': src.files[p], 'sourceSHA256': sha,
                       'bytes': os.path.getsize(os.path.join(OUT, fname))})
    bank = {'version': 2, 'id': d['id'], 'name': d['name'], 'license': 'CC0-1.0', 'voices': voices}
    with open(os.path.join(OUT, d['id'] + '.json'), 'w') as f:
        json.dump(bank, f, separators=(',', ':'))
    manifest['banks'].append({'id': d['id'], 'name': d['name'], 'kit': True, 'assets': assets})
    print(f"  {d['id']}: {len(voices)} voices, {sum(a['bytes'] for a in assets) / 1048576:.1f} MB")


VC, VS = 'vcsl', 'vsco'
PITCHED = [
    # replacements for the old low-bitrate General MIDI sounds
    dict(id='steinway-grand', name='Concert Grand', src=VC, layers=3, spacing=3, seconds=7, stereo=True, quality=5,
         **{'from': [('Chordophones/Zithers/Grand Piano, Steinway B/', r'^JHPiano_NoSus_Close_', None)]}),
    dict(id='kawai-grand', name='Bright Grand', src=VC, layers=3, spacing=3, seconds=6, stereo=True, quality=5,
         **{'from': [('Chordophones/Zithers/Grand Piano, Kawai/', r'^GPiano_sus_', None)]}),
    dict(id='fm-piano-tx81z', name='FM Electric Piano', src=VC, layers=3, spacing=3, seconds=5, stereo=False,
         **{'from': [('Electrophones/TX81Z/FM Piano/', None, None)]}),
    dict(id='recorded-vibraphone', verify=False, transpose=12, name='Vibraphone', src=VC, layers=2, spacing=3, seconds=6,
         **{'from': [('Idiophones/Struck Idiophones/Vibraphone/', r'^Vibes_hard_', None)]}),
    dict(id='recorded-tenor-sax', name='Tenor Sax', src=VC, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Aerophones/Reed Aerophones/Tenor Saxophone/', r'_NV_', None)]}),
    dict(id='recorded-flute', name='Concert Flute', src=VS, layers=1, spacing=2, seconds=4, loop=True, layer='none',
         **{'from': [('Woodwinds/Flute/susvib/', r'_1\.wav$', None)]}),
    dict(id='recorded-trumpet', name='Studio Trumpet', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Brass/Trumpet/susvib/', None, None)]}),
    dict(id='string-section', name='String Ensemble', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Strings/Violin Section/susVib/', None, None), ('Strings/Viola Section/susvib/', None, None),
                     ('Strings/Cello Section/susvib/', None, None)]}),
    dict(id='viola-section', name='Viola Section', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Strings/Viola Section/susvib/', None, None)]}),
    dict(id='contrabass-pizz', name='Upright Bass', src=VS, layers=2, spacing=3, seconds=3,
         **{'from': [('Strings/Solo Contrabass/Pizz/', None, None)]}),
    # new instruments
    dict(id='pizzicato-strings', name='Pizzicato Strings', src=VS, layers=2, spacing=3, seconds=2.5,
         **{'from': [('Strings/Violin Section/Pizz/', None, None), ('Strings/Cello Section/pizzT/', None, None)]}),
    dict(id='staccato-strings', name='Staccato Strings', src=VS, layers=2, spacing=3, seconds=1.6,
         **{'from': [('Strings/Violin Section/Spic/', None, None)]}),
    dict(id='contrabass-arco', name='Contrabass', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Strings/Solo Contrabass/SusVib/', None, None)]}),
    dict(id='concert-harp', name='Concert Harp', src=VC, layers=2, spacing=3, seconds=5, layer='dyn',
         **{'from': [('Chordophones/Composite Chordophones/Concert Harp/', None, None)]}),
    dict(id='clarinet', name='Clarinet', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Woodwinds/Clarinet/susLong/', None, None)]}),
    dict(id='oboe', name='Oboe', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Woodwinds/Oboe/Vib/', None, None)]}),
    dict(id='bassoon', name='Bassoon', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Woodwinds/Bassoon/sus/', None, None)]}),
    dict(id='french-horn', name='French Horn', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Brass/F Horn/sus/', None, None)]}),
    dict(id='trombone', name='Trombone', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Brass/Tenor Trombone/sus/', None, None)]}),
    dict(id='tuba', name='Tuba', src=VS, layers=2, spacing=3, seconds=4, loop=True,
         **{'from': [('Brass/Tuba/sus/', None, None)]}),
    dict(id='pipe-organ', name='Pipe Organ', src=VC, layers=1, spacing=2, seconds=4, loop=True, layer='none', stereo=True,
         **{'from': [('Aerophones/Edge-blown Aerophones/Pipe Organ/', r'^Rode_Man3Open_', None)]}),
    dict(id='harpsichord', name='Harpsichord', src=VC, layers=1, spacing=3, seconds=4, layer='none', stereo=True,
         **{'from': [('Chordophones/Zithers/Harpsichord, Flemish/', r'^HarpsiRH_', r'Rel')]}),
    dict(id='marimba', verify=False, transpose=12, name='Marimba', src=VC, layers=2, spacing=3, seconds=3, layer='dyn',
         **{'from': [('Idiophones/Struck Idiophones/Marimba/', None, None)]}),
    dict(id='xylophone', verify=False, transpose=12, name='Xylophone', src=VC, layers=2, spacing=3, seconds=2, layer='dyn',
         **{'from': [('Idiophones/Struck Idiophones/Xylophone/', r'^Xylo_', None)]}),
    dict(id='glockenspiel', verify=False, transpose=12, name='Glockenspiel', src=VC, layers=2, spacing=2, seconds=3, layer='dyn',
         **{'from': [('Idiophones/Struck Idiophones/Glockenspiel/', r'^glock_', None)]}),
    dict(id='tubular-bells', name='Tubular Bells', src=VC, layers=2, spacing=2, seconds=6, layer='dyn', verify=False, transpose=12,
         **{'from': [('Idiophones/Struck Idiophones/Tubular Bells 1/', None, None)]}),
    dict(id='kalimba', name='Kalimba', src=VC, layers=1, spacing=2, seconds=3, layer='none',
         **{'from': [('Idiophones/Plucked Idiophones/Kalimba, Tanzania/', None, None)]}),
    dict(id='harmonica', name='Harmonica', src=VC, layers=2, spacing=2, seconds=3, loop=True, layer='dyn',
         **{'from': [('Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/', None, r'_rel_|_Vib_')]}),
    dict(id='dan-tranh', name='Đàn Tranh (Zither)', src=VC, layers=2, spacing=2, seconds=4, layer='dyn',
         **{'from': [('Chordophones/Zithers/Dan Tranh/', r'^[A-G]', None)]}),
]
KITS = [
    dict(id='latin-percussion', name='Latin Percussion', seconds=2, voices={
        'kick': (VC, 'Idiophones/Struck Idiophones/Cajon/', r'hit1_f_rr', 2),
        'snare': (VC, 'Membranophones/Struck Membranophones/Conga/', r'HitN_v2', 2),
        'clap': (VC, 'Idiophones/Struck Idiophones/Claps/', r'Clap_rr', 2),
        'hat-closed': (VC, 'Idiophones/Struck Idiophones/Shaker, Small/', r'Down_rr', 2),
        'hat-open': (VC, 'Idiophones/Struck Idiophones/Tambourine 1/', r'Hit_v', 2),
        'tom': (VC, 'Membranophones/Struck Membranophones/Bongos/', r'BongoH_Hit1_v2', 2),
        'rim': (VC, 'Idiophones/Struck Idiophones/Claves/', r'Claves1_Hit', 2),
        'crash': (VC, 'Idiophones/Struck Idiophones/Cowbells/', r'Cowbell1_Hit', 2)}),
    dict(id='orchestral-percussion', name='Orchestral Percussion', seconds=4, voices={
        'kick': (VS, 'Percussion/', r'^BDrumNewhit_v6_rr', 2),
        'snare': (VS, 'Percussion/', r'^Snare2-HitSN_v7_rr', 2),
        'clap': (VS, 'Percussion/', r'^Claves1_Hit_v2_rr', 2),
        'hat-closed': (VS, 'Percussion/', r'^Triangle3-Hit_v2_rr', 2),
        'hat-open': (VS, 'Percussion/', r'^Sleighbells_Hit_v1_rr', 2),
        'tom': (VS, 'Percussion/', r'^LogDrumLo_MedM_v3_rr', 2),
        'rim': (VS, 'Percussion/', r'^Tamb1-Hit_v2_rr', 2),
        'crash': (VS, 'Percussion/', r'^cymbal-crash1_ff_rr', 2)}),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sources', required=True)
    ap.add_argument('--only', default='')
    args = ap.parse_args()
    only = {x for x in args.only.split(',') if x}
    srcs = {k: Source(args.sources, k) for k in PINS}
    mpath = os.path.join(OUT, 'recorded-manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) and only else {
        'version': 1, 'license': 'CC0-1.0',
        'sources': {k: {'repository': v[1], 'commit': v[2]} for k, v in PINS.items()},
        'process': {'rate': SR, 'format': 'OGG Vorbis', 'trim': 'leading silence (8 ms pre-roll kept)', 'fade': '80 ms end fade',
                    'gain': 'one common peak gain per bank; recorded layer differences preserved',
                    'pitch': 'each sample checked with YIN against its file name; consistent octave naming offsets corrected; mismatches skipped'},
        'banks': []}
    manifest['banks'] = [b for b in manifest['banks'] if b['id'] not in only]
    for d in PITCHED:
        if only and d['id'] not in only:
            continue
        print('building', d['id'])
        build_pitched(srcs[d['src']], d, manifest)
    for d in KITS:
        if only and d['id'] not in only:
            continue
        print('building', d['id'])
        build_kit(srcs, d, manifest)
    manifest['banks'].sort(key=lambda b: b['id'])
    with open(mpath, 'w') as f:
        json.dump(manifest, f, indent=1)


if __name__ == '__main__':
    main()
