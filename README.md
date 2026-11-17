# Aura Studio

A browser music studio for composing, recording, arranging, mixing, and exporting. The public GitHub Pages studio runs locally in the browser. A separate private Sites workspace adds authenticated cloud saving.

## Creation workspace

- A dedicated project header and transport keep playback, tempo, key, save status and export in consistent positions.
- Arrange, Edit, Play and Mix are available at every screen size. Double-click a clip (or press Enter on a focused clip) to edit. Expand the editor for focused work; rename clips in its header.
- The navigation rail opens instruments, loops, recording and projects. On phones, Sounds opens a dismissible browser with keyboard focus contained in the drawer.
- Instrument cards include family icons, previews and saved favorites. Adding a sound opens its playing surface. Fit song frames the arrangement on desktop.
- Play keyboards, guitar chord pads, synths, and drums with touch, mouse, computer keyboard, or an opt-in MIDI controller.
- Record notes or microphone/audio-interface takes with an optional one- or two-bar count-in.
- Generate chords, beats, basslines, arpeggios, and melodies. Quantize, humanize, transpose, and use scale lock.
- Arrange MIDI/audio clips with precise start and length, split at playhead, duplicate, resize, and undo. Right-click opens clip actions.
- Trim, split, normalize, and fade audio. Project tempo changes preserve recorded playback speed. Pitch / stretch explicitly renders a new audio asset with independent pitch and speed.
- Mix volume, pan, tone, reverb, and echo. Select a mixer channel for three-band EQ and compression. The master includes compression and limiting.
- Collapse or resize the editor. On narrow screens use Arrange, Edit, Play, and Mix.

## Projects and recovery

Projects opens the local session library. Create, reopen, duplicate, remove, and restore sessions. Removal is reversible through Recently removed. Save as copy preserves current edits as a separate project.

Edits autosave to IndexedDB after a short debounce. The status beside the title reports success or storage failure. Save (Ctrl/Cmd+S) creates a checkpoint. Recovery history retains the 12 most recent saved versions. Restoring creates another version. Conflicting edits from another tab are rejected; use Save as copy to keep both sessions.

Projects > Download project creates portable JSON with embedded audio. Import project restores it. The previous single-session localStorage format is retained as a recovery fallback and migrated into the project library on first use. The audio asset store remains compatible with existing projects.

Storage belongs to this browser, profile, device, and site origin. Clearing site data removes local projects. Changing origins does not transfer projects. Keep downloaded backups. Cloud saving is available in the separate private Cloud workspace. Download a project here and import it there to transfer it; the two origins have separate browser storage.

## Exports

- Stereo WAV: offline rendering at 44.1/48 kHz, 16/24-bit PCM, with instruments, channel effects, and master processing.
- Stems ZIP: one aligned WAV per audible track, with matching start and duration. Choose dry pre-fader audio or processed channels. Master compression/limiting is optional; summing individually compressed stems differs from the compressed full mix.
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

This release adds production editing and a separate private cloud workspace; it does not claim full BandLab parity. Current limits include no real-time co-editing, community publishing, automatic vocal pitch correction, VST/AU hosting, simultaneous multichannel recording, punch/loop takes, or automatic round-trip latency calibration. Imported MIDI stores controller data but playback currently uses notes, velocities and the initial instrument assignment; tempo maps and non-4/4 arrangements are not fully supported.


## Production upgrade

Tools opens MIDI import, track automation, a custom sampler, studio settings, portable backup, and the private Cloud workspace. Editing headers expose note velocities, quantize with strength/swing, reverse audio, and independent pitch/time stretch. Desktop and mobile workspaces retain Arrange, Edit, Play and Mix. Tools dismisses after selection and dialogs support Escape, focus return and Tab containment. Workspace zoom, count-in and editor height persist locally. Backup reminders appear every 20 minutes unless disabled.

Track automation supports volume, pan, tone, reverb and echo. Add or drag curve points, edit exact values, or create fades. Automation runs during playback and is scheduled into offline exports. Dry exports bypass mixer automation, channel effects, pan, faders and master dynamics while retaining the clip's edits and instrument sound.

MIDI import accepts Standard MIDI format 0/1 with PPQ timing. It separates tracks/channels, maps General MIDI programs and eight drum voices, preserves note velocity and sustain lengths, and retains controller metadata. Import uses the initial tempo when the project is empty, and warns about tempo changes or meter limitations. SMPTE timing is rejected. Import is capped at 20 MB, 128 file tracks and 100,000 notes.

The custom sampler has eight independent pads mapped to A S D F G H J K or chromatic playback of the first loaded recording. Each upload is limited to 20 MB / 60 seconds. Trim start/end, tune, gain and play-to-end are editable. Sampler recordings travel with portable projects and cloud projects.

Pitch / stretch uses the vendored SoundTouch AudioWorklet 2.1.1 (MPL-2.0) to render a new audio asset. Pitch is limited to ±12 semitones and speed to 50–200%. The original is retained through Undo. Offline tone tests verify pitch and duration independently; transient alignment, polyphonic quality and extreme settings still need listening tests. Manual recording offset is available in settings; the displayed output-latency estimate is not a measured round-trip calibration.

Dynamic Upright uses 23 recorded roots / four layers across the 88-key range. Expressive Nylon and Expressive Steel use 12 recorded roots / three layers each. Their 164 unchanged OGG recordings total about 16.6 MB. Downloads are lazy, with only needed roots decoded. Pinned CC0 provenance and hashes are in samples/dynamic-manifest.json and samples/meta-open-sound/. SoundTouch source, licenses and provenance are preserved in vendor/soundtouch/.

Run node --test tests/core.test.cjs tests/instruments.test.cjs tests/production.test.cjs. Browser suites: tests/browser.html, tests/instruments.html, tests/interface.html, tests/production.html. The production suite tests Record focus, mixer Undo, starter isolation, automation/dry exports, sampler persistence, actual AudioWorklet transforms and genuine velocity-layer dynamics.

To reproduce new sample preparation, run node scripts/prepare-assets.mjs. It writes scripts/prepared; copy its samples output into samples and retain the sources/notices. The existing sample-generation script reproduces the legacy banks.


## Playing and sample-library feedback

The note editor now has Draw/Select modes, Select all, Duplicate notes (Ctrl/Cmd+D), and a selected-note count. In Select mode drag a box; Shift-click adds/removes notes. Duplicate keeps their rhythm and intervals. Arrow Up/Down audition the new pitch, with a Hear moves toggle. Group moves preserve spacing at pitch and timeline boundaries. Piano keys, drum rows and playing buttons light for computer-keyboard, MIDI, touch and audition input; the playing view names sounding notes.

The cycle dropdown and Tools → Loop range accept bar.beat positions such as 4.2 → 5.1, plus hundredth-beat ticks such as 4.2.50. Ruler snapping offers bars, beats, subdivisions or free placement. Loop dragging supports Undo and re-anchors playback. Recording must finish before changing a loop.

AudioContext requests interactive latency. Ready voices start immediately; holding a key while a recording loads starts it as soon as ready, without a second press. Releasing before loading completes cancels it. The original press time is retained for recording. Browser/output/hardware delay still varies and has not been measured by a physical loopback test.

Recorded is the default instrument-browser view. Natural Violin and Bowed Cellos add two genuine recorded dynamics per selected root from VSCO 2 CE; Live Room Kit adds real acoustic performances from Virtuosity Drums with VCSL claps. Bowed Cellos is a cello section. Compact string samples preserve natural attacks and sustain for up to eight seconds, without a guessed looping section. Existing saved synth/legacy assignments retain their sound.

Sounds → Loops now separates Recorded beats, Drum hits and editable Patterns. Twelve two-bar ready audio beats are Aura arrangements of real acoustic drum recordings, not source-supplied full drummer performances. Sixteen one-shots cover kick, snare, clap, hats, tom, rim and crash. Preview/add as audio, optionally fit to project tempo with pitch-preserving time stretching (50–200%). Native BPM, actual waveform peaks and credits are shown. Added audio is included in recovery, portable projects, cloud sync and exports.

All 84 new OGG assets total about 8 MB. Source pins, transformations, output hashes and original CC0 notices are in samples/natural-manifest.json and samples/natural-sources/. Reproduction scripts and a checked asset selection are archived in scripts/recorded-audio/.

Run node --test tests/core.test.cjs tests/instruments.test.cjs tests/production.test.cjs tests/feedback.test.cjs. Browser tests/feedback.html verifies audible landed pitches, grouped duplication, lights/release, exact loop positions, real sample decoding, beat tempo-fit/export/recovery and held/released key behavior during loading. It uses an isolated project and restores the original session.

The current factory collection has 40 sounds: 23 recorded melodic instruments, two recorded acoustic kits, 11 original synth sounds and four synthesized kits. The extra audio library provides 12 ready beats and 16 individual drum recordings.
