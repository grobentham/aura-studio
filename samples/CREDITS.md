# Aura Studio recorded instrument library

## Melodic instruments

Fluid (R3) SoundFont. Copyright (c) 2000–2002, 2008 Frank Wen and contributors.

Original SoundFont acknowledgements: Suren M. Seron, Scott Hanan, Steve Aupperle,
Chris Gillman, Alex Taubr, Chris Prola, Andrew Klenk, Winfried Hubbe, Dylan,
Tim Gort, Uros Katic, Ethan Winer.

MP3 note rendering: Benjamin Gleitzman / MIDI.js Soundfonts.
Source: https://github.com/gleitz/midi-js-soundfonts/tree/044fab8e1456bfafc5776e86dfd6bb8697149aef/FluidR3_GM

The rendered sample collection is distributed by that project as Creative Commons
Attribution 3.0 Unported (CC BY 3.0). See CC-BY-3.0.txt and
https://creativecommons.org/licenses/by/3.0/.

Aura selects a subset of the rendered notes, unchanged as MP3 data. Playback adds
pitch shifting between recorded roots, velocity gain/filtering, attack/release,
and crossfaded sustain loops for bowed strings and winds. These are adaptations
by Aura Studio, with no endorsement by the original authors implied.

The original Fluid SoundFont also includes this MIT notice:

Copyright (c) 2000–2002, 2008 Frank Wen

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Recorded percussion

Versilian Community Sample Library (VCSL), Versilian Studios LLC.
Source: https://github.com/sgossner/VCSL/tree/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e
License: CC0 1.0 Universal; see CC0-1.0.txt.

Two recorded takes are selected for each of eight drum/cymbal voices. Aura trims
leading silence and duration, converts to mono 32 kHz 16-bit PCM, normalizes each
take, and adds edge fades. Kick/tom/snare sources are acoustic percussion
recordings; this is not a commercial studio drum-kit library or a recreation of
a named hardware product. Exact source filenames are included in the bank JSON.

## Reproducibility and use

manifest.json records source commits, sample counts, sizes, and SHA-256 hashes.
Run `node scripts/build-sample-banks.mjs` from the repository root to rebuild.
The script downloads a selected subset and never executes source JavaScript.
The application serves these files from its own origin, with no third-party
sample CDN or account dependency. Sounds are loaded on demand and cached where
browser storage supports it. Sample caches are not project backups.

The original synthesized Aura presets and kits remain available and unchanged.

## Recorded instruments (2026 upgrade)

Concert Grand, Bright Grand, FM Electric Piano, String Ensemble, Upright Bass, Concert Flute, Tenor Sax, Studio Trumpet, Vibraphone and 22 new instruments/kits use real CC0 recordings from VSCO 2 CE and VCSL. See `recorded-sources/CREDITS.md` and `recorded-manifest.json`.
