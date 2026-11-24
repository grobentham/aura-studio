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
