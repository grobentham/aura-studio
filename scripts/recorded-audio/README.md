# Recorded audio handoff

All output is in prepared/samples/. The owner may copy that directory's contents into aura-studio/samples/ and the matching cloud runtime. This task has not modified either checkout or deployed anything.

- natural-violin.json: Live Violin, program40,15 native roots MIDI55–96,2 real recorded dynamics p/f. Suggested catalog: category Strings, dynamic true, bank natural-violin, loop false, gain .55, release .35, preview[60,64,67].
- natural-cello.json: Bowed Cellos, program42,13 native roots MIDI36–77,2 real recorded dynamics v1/v3. This is a cello SECTION, never label solo cello. Suggested catalog: category Strings, dynamic true, bank natural-cello, loop false, gain .55, release .4, preview[48,55,60].
- natural-kit.json: Live Room Kit,8 standard Aura voices,2 recorded variants each, v2 OGGS in natural-kit/. Suggested gain .65 and source recorded tag.
- recorded-beats.json:12 audio beats (2bars/4-4,78–132BPM) and16 individual kick/snare/clap/hat/tom/rim/crash audio clips. Each has file,sha256,bytes,duration,oneShot,bpm,bars,key,source and license metadata. Loop fields sourceProvidedLoop:false and arranger:Aura make provenance explicit. A premade audio clip here is an Aura arrangement of real recorded acoustic hits, not a source-supplied full drummer performance.
- natural-manifest.json: hashes, source pins, per-file source paths, gain/resampling/trimming metadata.
- natural-sources/: original CC0 licenses and source README files, plus CREDITS.md.

The two string banks use exactly the existing v2 layer schema and lazy-root layout: notes[midi]=[{layer:1,data:'natural-violin/60-layer1.ogg',...},{layer:2,...}]. Velocity split[70], crossfadeWidth16, and preserved real layer levels. Each retained string sample lasts up to8 seconds. No guessed sustain loop is introduced. Enable dynamic true for routing, but keep loop false so the existing crude loopSample helper does not overwrite the natural bow motion. Notes longer than8 seconds fade out; this is an honest compact-library limit.

Filename pitch was verified against sounding audio. The solo violin source uses standard scientific names C4=MIDI60. VSCO cello section source uses an octave below sounding pitch: susvib_A2 is220Hz=A3=MIDI57; source C1 has65Hz fundamental/130Hz strong second harmonic=MIDI36. The cello manifest corrects by+12. Detailed check script: analyze-pitches.py.

Every source comes from pinned official CC0 repositories, no purchases or samples taken from songs. Some popular free sample sites only allow music-making and forbid sample redistribution; those were excluded. Official sources and their exact pinned licenses are retained in the output notices. No claims of commercial orchestral legato, round-robin strings or unlimited looping.

Run python validate-prepared.py with the scratch python-deps installed. Reproduction: node download-sources.mjs fetches the committed selection in download-jobs.json, checks Git blob hashes and stores untouched originals; python prepare-recordings.py converts only these recordings and mixes authored patterns. Dependencies are local scratch numpy, scipy and soundfile; none need shipping with the app.

Naturalness suggestions: prioritize Recorded sounds in the browser, clearly separate Legacy/Synth sounds; use Live Violin and Bowed Cellos instead of Fluid strings for new string tracks. Preserve saved legacy preset names for compatibility. Existing Expressive Nylon/Steel already contain real Meta Open Sound recordings; select them by default instead of the legacy synthesized Nylon Guitar. Reduce default reverb/echo for auditions so transients remain identifiable. Factory sample-loading must not fall back to oscillators or silently eat the first live note.

After rebuilding recordings, run python add-waveforms.py to add48-bin actual decoded peak waveforms to recorded-beats.json. Catalog definition objects are in prepared/natural-definitions.json.
