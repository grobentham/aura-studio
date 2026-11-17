# Aura Studio

A browser music studio for composing, recording, arranging, mixing, and exporting. No installation, build step, runtime dependencies, account, or upload server.

## Creation workspace

- A dedicated project header and transport keep playback, tempo, key, save status and export in consistent positions.
- Arrange, Edit, Play and Mix are available at every screen size. Double-click a clip (or press Enter on a focused clip) to edit. Expand the editor for focused work; rename clips in its header.
- The navigation rail opens instruments, loops, recording and projects. On phones, Sounds opens a dismissible browser with keyboard focus contained in the drawer.
- Instrument cards include family icons, previews and saved favorites. Adding a sound opens its playing surface. Fit song frames the arrangement on desktop.
- Play keyboards, guitar chord pads, synths, and drums with touch, mouse, computer keyboard, or an opt-in MIDI controller.
- Record notes or microphone/audio-interface takes with an optional one- or two-bar count-in.
- Generate chords, beats, basslines, arpeggios, and melodies. Quantize, humanize, transpose, and use scale lock.
- Arrange MIDI/audio clips with precise start and length, split at playhead, duplicate, resize, and undo. Right-click opens clip actions.
- Trim, split, normalize, and fade audio. Audio stays at its original playback speed when project tempo changes; it is not time-stretched.
- Mix volume, pan, tone, reverb, and echo. Select a mixer channel for three-band EQ and compression. The master includes compression and limiting.
- Collapse or resize the editor. On narrow screens use Arrange, Edit, Play, and Mix.

## Projects and recovery

Projects opens the local session library. Create, reopen, duplicate, remove, and restore sessions. Removal is reversible through Recently removed. Save as copy preserves current edits as a separate project.

Edits autosave to IndexedDB after a short debounce. The status beside the title reports success or storage failure. Save (Ctrl/Cmd+S) creates a checkpoint. Recovery history retains the 12 most recent saved versions. Restoring creates another version. Conflicting edits from another tab are rejected; use Save as copy to keep both sessions.

Projects > Download project creates portable JSON with embedded audio. Import project restores it. The previous single-session localStorage format is retained as a recovery fallback and migrated into the project library on first use. The audio asset store remains compatible with existing projects.

Storage belongs to this browser, profile, device, and site origin. Clearing site data removes local projects. Changing origins does not transfer projects. Keep downloaded backups. There is no cloud synchronization.

## Exports

- Stereo WAV: offline rendering at 44.1/48 kHz, 16/24-bit PCM, with instruments, channel effects, and master processing.
- Stems ZIP: one aligned WAV per audible track, with matching start and duration. Each stem includes channel effects and master processing. Summing stems differs from the compressed full mix.
- MIDI: Standard MIDI format 1, 480 ticks/quarter note, tempo, track names, notes, velocities, and General MIDI drum mapping. Audio clips, instruments, and effects are not embedded.

WAV and stems use the entire song or cycle range, with a three-second effect tail. Muted tracks and tracks excluded by solo are omitted. MIDI includes every instrument/drum track and the full arrangement so musical material remains editable. Audio exports are limited to ten minutes per range and an estimated 350 MB per download to bound browser memory use. Cancellation discards the output after the current offline render completes.

## Run and validate

Run `node serve.mjs`, then open http://127.0.0.1:4173. The development server binds only to loopback. Production includes index.html, the studio, instrument and studio-ui JavaScript/CSS files, the samples/ directory, and .nojekyll.

Run `node --test tests/core.test.cjs` for syntax, PCM sample/header values, MIDI events/channels, clip splitting, and ZIP integrity. Open http://127.0.0.1:4173/tests/browser.html and choose Run diagnostics for actual audio renders/decoding, channel processing, fades, persistence/recovery, split/undo, transport, export actions, and note recording with count-in. Diagnostics use a dedicated session and move it to Recently removed afterwards.

Microphones and Web MIDI require HTTPS or localhost. MIDI permission is requested only after Connect MIDI is clicked; no system-exclusive permission is requested. Web MIDI support varies; use a supported browser such as Chrome or Edge. Physical microphones/interfaces, driver latency, MIDI controllers, mobile multi-touch, and cross-browser performance require hardware/browser testing. Diagnostics do not assess acoustic or mastering quality.

Open /tests/interface.html and run interface diagnostics for workspace navigation, clip rename, editor expansion, instrument-to-editor navigation, and responsive layouts at 1440, 1024, 800, 600, 390 and 360 pixels. It uses a separate local project and restores the original session afterwards.

## GitHub Pages

This remains a static GitHub Pages site. In Settings > Pages, use Deploy from a branch, main, /(root). No paid services or backend configuration are required.

## Current scope

This release strengthens music creation; it does not claim full BandLab parity. There are no accounts, cloud projects, collaboration, community publishing, vocal pitch correction, time stretching, VST/AU hosting, track automation, simultaneous multichannel recording, or MIDI-file import. The expanded collection includes 18 recorded melodic instruments and one recorded acoustic kit, alongside the original synthesized sounds. Audio-interface latency is not automatically calibrated.

Audio stays on the device or in downloaded files. Fonts may load from Google Fonts; system fallbacks work offline after the application files are loaded.


## Recorded instruments

The collection now has 34 sounds: 18 new recorded melodic instruments, the Session Acoustic kit, 11 original synthesized instruments, and four original synthesized kits. The new sounds include Concert/Bright Grand, two electric pianos, four guitars, three basses, ensemble/solo strings, flute, sax, trumpet, and vibraphone.

Open Sound library > Instruments to search, filter by family, star favorites, preview, add tracks, or replace the selected compatible track. Acoustic Morning creates a separate arranged demo with recorded piano, steel guitar, upright bass, and acoustic percussion. Sampled instruments offer brightness/release controls. Guitar chord pads strum their notes over time. Percussion alternates two takes per voice and closes an open hat when the closed hat hits.

Banks are served from this same site, loaded on demand, and cached in Cache Storage when available. Playback and export wait for required banks; a failed download reports an error instead of silently substituting an oscillator. Existing preset names and projects retain their original sounds. Projects store built-in instrument assignments, not copies of factory sample banks. Reopening on another device requires downloading those built-in banks once. The sample cache is not a project backup.

The melodic samples have one recorded velocity layer, with velocity-dependent gain and filtering; they are not a large multi-layer commercial sample library. Recorded roots are 3–4 semitones apart; intervening pitches are shifted from the nearest sample. Strings/winds use crossfaded sustain sections. The kit combines acoustic percussion recordings, rather than claiming to reproduce a named drum set. The packaged banks total about 8.3 MB.

Sources, pinned commits, modifications, licenses, and hashes are in samples/CREDITS.md and samples/manifest.json. Credits are available in the interface and carried in WAV INFO metadata, stem ZIP text, and MIDI text. MIDI exports include General MIDI program changes for the recorded melodic instruments.

Run node --test tests/core.test.cjs tests/instruments.test.cjs for all Node checks. Open /tests/instruments.html for actual decode/render checks of every recorded instrument, velocity, sustained strings, drum exports, caching, error handling, persistence, search, demo rendering, and credited WAV decoding. Run /tests/browser.html for the existing creation-workflow regression checks.

To reproduce the banks, run node scripts/build-sample-banks.mjs. It downloads pinned licensed source data and does not execute downloaded JavaScript. After changing banks, bump the instrument Cache Storage version in instruments.js to avoid stale copies.
