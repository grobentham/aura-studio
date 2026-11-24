# Initial repository audit — 2026-11-24

Scope: repository tree at 01dee877782658067fc1ef02a8b0c00c80928840, README, pure core helpers, recording and workspace integration, browser diagnostics, and licensing notices. Static review, not a complete line-by-line audit, security certification or hardware test.

## Findings

| Priority | Finding and evidence | Next acceptance criterion |
| --- | --- | --- |
| P0 | No GitHub Actions workflow at baseline; five Node suites and six manually launched diagnostic pages already exist. | Run all suites in CI and retain exact results; require successful checks before release. |
| P0 | studio-recording.js limits capture to 64 MiB float PCM, 600 seconds or 64 loop passes; recording-store.js assembles the whole AudioBuffer. At 48 kHz stereo, byte cap is ~174.76 seconds. | Long recording with bounded memory, recoverable committed chunks, quota failure handling and compatibility tests. |
| P0 | index.html is ~143 KB and embeds global project/transport/render/UI integration; studio-recording.js and studio-workspace.js override shared functions. | Incrementally extract typed/pure boundaries with regression parity. |
| P0 | README documents origin-specific IndexedDB, twelve revisions and portable JSON with embedded audio. Clearing site data or moving origin can lose access. | Explicit portable backup/restore, quota warnings, verified schema round-trip and migration. |
| P1 | README limits audio exports to ten minutes and estimated 350 MB; offline rendering/ZIP memory should be measured before changing bounds. | Bounded render pipeline; aligned stems and preserved DSP tails, cancellation, sample-rate/bit-depth validation. |
| P1 | Manual recording offset exists; no measured round-trip calibration. | Assisted loopback calibration with confidence/error reporting; test real interfaces separately. |
| P1 | MIDI import preserves controller metadata but not full playback/tempo-map/meter semantics. | Defined beat/time mapping and MIDI import/export regression fixtures. |
| P1 | Existing pitch/time processing uses SoundTouch; automatic vocal tuning is not implemented. | Monophonic pitch tracking and reversible correction evaluated with reference signals and listening. |
| P1 | Cloud backend is separate; client-only review cannot establish server security. | Review authenticated backend independently before paid cloud release. |
| P1 | main reported unprotected at review time. | Owner configures required PR checks after a clean CI baseline; no branch settings changed by this PR. |

## Asset and dependency review

Repository tree contains 248 audio files matching WAV/MP3/OGG/FLAC extensions, plus JSON banks. Existing credits identify FluidR3/MIDI.js (CC BY 3.0 and original MIT notice), VCSL, VSCO 2 CE, Virtuosity and Meta Open Sound (CC0 notices), and SoundTouchJS 2.1.1 (MPL-2.0 with provenance and retained sources). See samples/CREDITS.md, samples/meta-open-sound/CREDITS.md, samples/natural-sources/CREDITS.md and vendor/soundtouch/LICENSE. These are recorded repository claims, not an independent legal clearance. Before commercial distribution verify upstream grants, credits in distributed exports, modified-file notices, and first-party source licensing (no root LICENSE observed).

## Validation status

Existing tests were inspected but not executed during the static audit. CI introduced in this PR is the next executable validation; a configured workflow is not evidence of a passing run. Physical microphones, interfaces, MIDI, cross-browser/device performance, and subjective audio quality remain unverified.

## Release hardening follow-up
See docs/release-hardening.md for the current scoped findings, fixes, and remaining release gates. Earlier architecture baseline findings remain historical.

Data integrity follow-up: see docs/data-integrity.md. Legacy imports use independent asset identities and atomic add-only asset writes. Recurring archive test investigated; completion guards and frame-based diagnostic added, root cause not yet proven.
