# Architecture baseline and migration contracts

Baseline: main commit 01dee877782658067fc1ef02a8b0c00c80928840 (2026-11-24 review). This is a static, no-build application, not yet a modular TypeScript DAW.

| Current boundary | Files | Responsibility |
| --- | --- | --- |
| App shell and core integration | index.html | HTML/CSS, global project state, transport, playback/render graph, persistence, MIDI, editor |
| Pure helpers | studio-core.js | WAV/MIDI/ZIP encoding and clip splitting |
| Production | production-core.js, studio-production.js | automation, quantisation, MIDI import, clip transforms, sampler and backup settings |
| Project/advanced UI | studio-pro.js, studio-ui.js, studio-feedback.js, studio-workspace.js | project library and studio workflows, controls, feedback and inspector |
| Instruments | instrument-catalog.js, instruments.js, recorded-library.js, samples/ | sound definitions, sample loading and playback |
| Recording | recording-core.js, studio-recording.js, pcm-recorder-worklet.js, recording-store.js | PCM capture, journal, loop/punch takes and comping |
| Cloud adapter | cloud-client.js | authenticated private workspace client; server is outside this repo |
| DSP dependency | vendor/soundtouch/ | pitch/time transformation; preserve MPL notices and source |

Existing browser scripts share global variables and in some cases override functions defined by earlier scripts. The current loading order is a compatibility contract, not the desired final architecture.

## Target contracts (design, not implemented)

- ProjectCore: versioned serializable project metadata, pure command application and undo/redo; no DOM or AudioNode references.
- Transport: beat/time mapping, start/stop, loop and tempo map; one explicit audio clock.
- AudioGraph: construct/dispose tracks and processing chains; route signals; shared graph definition for realtime and offline rendering.
- AssetStore: immutable IDs, chunk write/read, committed metadata, quota/error reporting and portable export; retain original source samples. Metadata updates must not reference uncommitted assets.
- Recorder: start/stop with absolute sample-frame boundaries; channel configuration, bounded queues and recoverable journal. DSP callbacks do not await storage.
- Render: explicit sample rate, range, channels and processing policy; preserve dry/wet semantics and export alignment.
- Analysis: deterministic, confidence-bearing results with units and algorithm version; never mutate a project.
- Producer: reversible commands with preview, explanation and user acceptance. Composition emits editable MIDI; mix/master preserve original audio.

These are interfaces to establish incrementally. Initially keep JS and browser compatibility adapters. Add JSDoc types and pure tests at extraction points; introduce TypeScript/build tooling only in a dedicated migration PR. Preserve deployment under /aura-studio/ and test origin migration before moving domains.

## Migration sequence

1. Freeze baseline and CI, inventory global dependencies and script load order.
2. Extract recording policy and frame/byte limits to a pure module with boundary tests.
3. Design chunk-backed recording asset storage with versioned migration and failure recovery; do not simply increase the allocation cap.
4. Extract shared graph construction and explicit transport/renderer contracts; compare realtime/offline audio.
5. Build analysis and assisted production on tested interfaces.

Each slice has a rollback path; no destructive migrations and no simultaneous rewrite of audio, storage and UI.

## Audio architecture increment (2026-11-24)

`AuraChannel` is the shared channel processor contract for realtime/offline EQ and compression, with bounded optional parametric EQ shape and explicit disposal. Defaults preserve previous projects. Long capture is an opt-in linear journal archive, limited to 60 minutes or quota budget; normal editable takes retain the 64 MiB limit. `RecordingJournal.readSection` uses block-frame lookup and bounded decoding. `writeWav` streams committed PCM to direct files or OPFS archive copies through Storage centre. No large-project streaming playback, full portable backup migration or general bus topology is claimed yet. OPFS exports are additional local copies, not a substitute for external backup.

Archive browser diagnostic captures a short synthetic performance with the actual worklet, verifies that stopping seals the journal without installing a whole track, checks audible bounded extraction and OPFS file size. Frequency mix assist displays the actual configurable EQ frequencies.

Routing/backup increment: four fixed shared dry submix buses with group fader/mute and scaled per-track reverb/delay sends; same gain law offline and realtime, dry exports bypass. Optional group fields preserve old projects. Binary AURAPAK1 packages preserve stored WAV assets, with streaming writer up to 1 GiB and 192 MiB source-audio restore bound; archive WAV copies support media-element playback outside arrangement. Full streaming timeline playback and unbounded project import remain outstanding. Stereo regression uses power across one second rather than a phase-sensitive single sample.

Shared insert rack supports up to eight native gain, saturation, low-pass and high-pass effects with ordering and bypass. Dry stem export removes inserts. Audio diagnostics has an opt-in quiet wired loopback probe and normalized correlation estimate with an explicit apply step, plus 16/32/64-channel two-second offline synthetic render benchmark. Physical calibration, realtime underrun testing, plugin latency compensation, general graph routing and full streaming timeline playback still require separate validation/implementation.

Streamed timeline increment: canonical local 24-bit PCM WAV sources persist as Blob assets with explicit rate/channel/frame metadata; half-second range reads schedule against the transport clock with longer lookahead and explicit stop on a late/failed read. No full source decode during save, restore or binary package import. Streamed mix renders are limited to short bounded ranges, detailed waveform editing needs section recovery, and cloud/legacy JSON export cannot carry streaming assets. Browser diagnostic checks audible playback, seeking, bounded render and package round trip. Sustained multitrack/hardware tests and general plugin delay compensation remain pending.

Continuous export increment: explicit realtime master-output capture through the existing PCM worklet, sequential 24-bit stereo file writing with exact frame checks, bounded write queue, user cancellation, interruption/visibility checks and abort on stream failure. Up to one hour plus tail, runs at playback speed. Stream clip editor displays bounded real waveforms, trims non-destructively and extracts muted editable tracks. Manual measured path latency alignment adds relative delays to native channel graphs in realtime/offline; no automatic plugin latency reporting or external plugin support. One-hour recording/playback and realtime load stress still need physical testing.

Continuous capture also monitors scheduler callback gaps and aborts on a gap exceeding its conservative lookahead threshold. This detects scheduling stalls, not hardware buffer underruns. Tests cover cancellation and writer failure/backpressure. Live note input is blocked during capture.

Realtime diagnostic: silent synthetic oscillator/channel-strip workloads at 16, 32 and 64 channels, three seconds each, captured through the PCM worklet. Reports contiguous frames, delivered blocks and maximum main-thread delivery gap. Browser test runs a short 16-channel fixture. This checks internal software processing, not audio interface/OS hardware underruns or sustained 64-track musical projects.

Master Pro adds an independent pure offline processing module and worker, with bounded 30-second preview, reference-tone assistance, linked dynamics, width, interpolated peak lookahead limiter and dithered export. Current master processing remains unchanged. See docs/master-pro.md.

Vocal Pro introduces a bounded worker-based waveform-synchronous note renderer, independent derived vocal/harmony assets, and an experimental separate dry-recording-preserving mono monitor worklet. See docs/vocal-pro.md.

Analyse Pro introduces reusable local musical feature extraction and ranked key/tempo hypotheses, coarse chords, transient and quality diagnostics with explicit key and tempo changes. See docs/analyse-pro.md.

Compose Pro adds deterministic section-based MIDI generation, optional motif-conditioned progression, bounded voicing and six independent procedural roles. See docs/compose-pro.md.

MIDI Pro: pure bounded note transformations with selection-aware preview/commit, seeded humanization, groove quantize, velocity, accents, duration, legato, scale snap, strum, arpeggio and repeat. Optional time-aligned ghost-note overlay (noninteractive, capped at 4,000) on existing piano roll. All edits use existing notes schema and one undo. External MIDI routing, CC/pitch-bend editing, probability playback and MPE remain outstanding.

Instruments Pro adds bounded project-embedded native synth patches, local preset library, five synthesis modes and shared realtime/offline voice graph. See docs/instruments-pro.md.

Effects Pro extends the shared native insert rack to 19 effect types, explicit modulation-node lifecycle, bounded echo feedback and portable/local effect-chain presets. See docs/effects-pro.md.
