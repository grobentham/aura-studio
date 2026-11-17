# Dynamic instrument source notices

Three velocity-layer instrument banks are selected from Meta Open Sound, Meta Creative Audio team, under CC0 1.0. Source commit: `514c926efecdb3c7812bf00eedf8e5c8d61dd681`.

Source: https://github.com/facebookincubator/Meta-open-sound/tree/514c926efecdb3c7812bf00eedf8e5c8d61dd681/systems/instruments

The copied mono OGG preview bytes are unchanged. Notes are selected at no more than four-semitone intervals over the native instrument ranges. Every selected file is checked against the source collection's SHA256SUMS. The exact source manifests, specifications and SFZ maps are in `sources/`. CC0 terms are in `CC0-1.0.txt`. The instrument bank JSON is a new Aura manifest; it does not execute source code.

Prepared banks: Dynamic Upright (MIDI21–108,23 roots,4 layers), Dynamic Nylon (MIDI40–83,12 roots,3 layers), Dynamic Steel (MIDI40–84,12 roots,3 layers). Total164 OGG samples,16,571,166 audio bytes; bank JSON12,855 bytes. These are genuine recorded dynamic layers, not a filtered copy of one recording. The guitars have no dedicated release, muted or palm-muted samples; neither collection has recorded round-robin alternates.

SoundTouchJS2.1.1 is Copyright Olli Parviainen, Ryan Berdeen, Jakub Fiala, Steve 'Cutter' Blades and contributors, under MPL-2.0. Exact npm publication source commit from npm provenance: `8d19a91524c578f9ac414c7e7db2a5a1a605ff12`. Official source: https://github.com/cutterbl/SoundTouchJS/tree/8d19a91524c578f9ac414c7e7db2a5a1a605ff12 . Package tarball integrity pins and source provenance URL are in `../../vendor/soundtouch/package-provenance.json`.

Runtime files are ../../vendor/soundtouch/index.js, SoundTouchNode.js, constants.js, processOffline.js and soundtouch-processor.js. These minimal runtime modules are unmodified and have no bare package imports. The processor source map embeds its 14 TypeScript sources; additional preferred TypeScript sources from the exact publication revision are in ../../vendor/soundtouch/typescript/. Keep copyright headers, the full LICENSE, package-provenance.json and source availability with distribution.

No third-party demo music or paid/commercial samples are included. The selected recordings are distributed with Aura Studio and loaded on demand; SoundTouch is used for explicit offline clip transforms. The sample hash manifest is ../dynamic-manifest.json. Runtime DSP files are in ../../vendor/soundtouch/.
