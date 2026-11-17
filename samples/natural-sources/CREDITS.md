# Recorded strings, acoustic kit and audio beats

## VSCO 2 Community Edition

Original recorded violin and cello section: Versilian Studios LLC, Sam Gossner, Simon Dalzell / Ivy Audio; sample editing by Elan Hickler / Soundemote. CC0 1.0 Universal. Original source and license: https://github.com/sgossner/VSCO-2-CE/tree/440300901dfe9275fd84e0b7763af1f8443ae62e . The creator describes the library as suitable for making and redistributing sample libraries. Full license and README are retained here.

Live Violin uses original Solo Violin / Arco Vib recordings, with piano and forte takes over15 recorded roots. Bowed Cellos uses original Cello Section / susvib recordings, with two recorded dynamics over13 roots. Bowed Cellos is a recorded section, not a solo cello. The Solo Violin source uses normal scientific pitch names (C4=MIDI60); the source Cello Section filenames use an octave below sounding pitch (A2 sounds A3=MIDI57), verified from source audio. No retuning or synthetic oscillator is used in these assets.

Aura trims only leading silence (retaining30ms before the first detected signal), retains up to8 seconds of recorded attack/sustain, resamples with a polyphase filter to32 kHz stereo and encodes OGG Vorbis. A common gain is applied across all layers of each instrument; layer differences remain recorded. A short end fade avoids a cutoff when the retained8-second sample ends. No guessed sustain loop is added; long held notes eventually fade out.

## Virtuosity Drums

Original acoustic kit recordings: Versilian Studios and Karoryfer Samples, performed by Austin McMahon at Virtuosity Musical Instruments in Boston, MA. CC0 1.0 Universal. Pinned source: https://github.com/sfzinstruments/virtuosity_drums/tree/9f04cf9a734527edfbb0a4eee1f674e45bbf71bc .

The subset uses close-mic kick/snare and stereo overhead tom/cymbal recordings. Kick/hats/crash retain two source round robins; snare/tom/cross-stick use two adjacent source dynamic recordings. These should be described as alternate recorded hits, not universal source round-robin layers. Source filenames and SHA256/Git blob hashes are in ../natural-manifest.json.

## VCSL recorded hand claps

The two recorded hand-clap hits are from Versilian Community Sample Library (VCSL), Versilian Studios LLC. CC0 1.0 Universal. Pinned source: https://github.com/sgossner/VCSL/tree/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e . All source licenses and README files are retained.

## Beat arrangements

The twelve audio beats are new Aura arrangements rendered only from the above Virtuosity acoustic drum recordings. They were not provided as prearranged loops or a complete performance by the source drummer. They contain no synthesized drum oscillators and no third-party song or commercial beat excerpts. BPM, meter, event placement, duration, source identity and sourceProvidedLoop:false are explicit in ../recorded-beats.json. The loops are two bars of4/4 with room tails wrapped across the boundary for continuous looping.

The catalog's one-shot entries have no invented BPM, key or bar length: those fields are null, and oneShot=true.
