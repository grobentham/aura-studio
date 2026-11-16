# Aura Studio

A standalone browser music studio built with Web Audio. No installation, build step, or JavaScript dependencies.

## Create music

- Play and record virtual keyboards, guitar chord pads, synths, and drum pads.
- Record microphones or connected audio interfaces onto new tracks.
- Browse and preview loops that follow the project tempo and key.
- Arrange MIDI and audio clips; trim, split, normalize, duplicate, and undo edits.
- Mix volume, pan, tone, reverb, and echo, with master compression and limiting.
- Download projects with embedded audio and export the mixed output as WebM/Opus or MP4.

## Use

Open the published GitHub Pages site or open `index.html` locally in a current browser. Microphone recording requires permission and a secure browser context such as HTTPS or localhost.

Choose **Instruments** to play. Press **R** to record notes, **Space** to play/stop, and **Z/X** to change octave. For live audio, choose **Record → Connect input → Record audio**. Finish the take to create an audio clip. Use headphones for input monitoring and disconnect input when finished.

Click an audio clip for trimming, splitting, and normalization. Click the timeline ruler to place the playhead. **Save** downloads a portable JSON project; **Open** restores it. Local sessions use browser storage; keep a downloaded backup.

## GitHub Pages

This repository is a static site. In **Settings → Pages**, use **Deploy from a branch**, the `main` branch, and the `/(root)` folder. `.nojekyll` lets GitHub serve the files directly.

## Limits

Instrument sounds are synthesized. There are no VST/AU plugins, external MIDI devices, time stretching, pitch correction, latency calibration, or full mastering tools. Export runs in real time. Embedded PCM audio can make project files large.

Browser workflows for note recording, loop insertion, audio import/editing, project save/reopen, undo/redo, and audio export were checked. Physical microphone/audio-interface capture and multi-finger mobile touch still need hardware testing.

Audio stays on your device or in project files you download. The application has no upload server. Fonts may load from Google Fonts; system-font fallbacks work offline.
