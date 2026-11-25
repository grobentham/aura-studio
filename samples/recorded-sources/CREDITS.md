# Recorded instruments (2026 upgrade)

All recordings below are released under **CC0 1.0 Universal** (public domain dedication). The full license texts are kept in this folder. Exact source paths, Git blob ids and SHA-256 hashes for every file are listed in `../recorded-manifest.json`.

## Versilian Community Sample Library (VCSL)
Versilian Studios LLC and contributors. Pinned source: https://github.com/sgossner/VCSL/tree/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e

Concert Grand (Steinway B, close mics, no sustain pedal) · Bright Grand (Kawai grand) · FM Electric Piano (Yamaha TX81Z "FM Piano") · Vibraphone (hard mallets) · Tenor Sax (non-vibrato) · Harmonica (Hohner Special 20 in C) · Pipe Organ · Harpsichord (Flemish) · Concert Harp · Marimba · Xylophone · Glockenspiel · Tubular Bells · Kalimba (Tanzania) · Đàn Tranh (Vietnamese 16-string zither) · Latin Percussion kit (cajón, conga, claps, small shaker, tambourine, bongo, claves, cowbell).

## VSCO 2 Community Edition
Versilian Studios LLC, Sam Gossner and contributors. Pinned source: https://github.com/sgossner/VSCO-2-CE/tree/440300901dfe9275fd84e0b7763af1f8443ae62e

String Ensemble (violin, viola and cello sections, sustained vibrato) · Viola Section · Pizzicato Strings (violin and cello sections) · Staccato Strings (violin section spiccato) · Contrabass (bowed) · Upright Bass (contrabass pizzicato) · Concert Flute · Clarinet · Oboe · Bassoon · Studio Trumpet · French Horn · Trombone (tenor) · Tuba · Orchestral Percussion kit (concert bass drum, snare, claves, triangle, sleigh bells, log drum, tambourine, crash cymbal).

## Known gaps
VSCO 2 CE has no sustained French horn recordings between D4 and D5, so horn notes in that range are pitch-shifted from the nearest recording (up to 7 semitones). The top notes of the xylophone and glockenspiel are above what Aura's automatic pitch check can measure; their names were checked against the spectrum instead.

## What Aura does to the recordings
`scripts/build-recorded-instruments.py` rebuilds every bank from the pinned sources. For each instrument it:

- picks recorded notes (usually every 2–4 semitones) and up to three recorded dynamics from the file names;
- checks the pitch of every recording against its file name. Some source folders name notes an octave below the sounding pitch; that offset is detected per folder and corrected, and recordings that don't match their name are skipped;
- trims leading silence (keeping 8 ms), keeps the first few seconds of the recording with an 80 ms fade, resamples to 44.1 kHz and encodes OGG Vorbis;
- applies one common gain per instrument, so the recorded differences between soft and loud takes are preserved.

Sustained instruments (strings, winds, brass, organ, harmonica) use Aura's existing crossfaded sustain loop at playback so long notes can be held. No retuning, synthetic layers or AI processing is applied.

## Still using the older Fluid (R3) sounds
Stage EP, Clean Electric, Jazz Hollowbody, Finger Bass and Picked Bass have no CC0 replacement yet and still use the Fluid (R3) SoundFont rendering (CC BY 3.0; see `../CREDITS.md`).
