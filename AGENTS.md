# Aura Studio development instructions

Read docs/architecture.md, docs/roadmap.md, docs/testing.md and docs/audit.md before changing production code.

- Work on a feature branch and open a pull request. Do not deploy directly or force-push main.
- Preserve existing portable project formats, IndexedDB data, undo/redo and asset identifiers. Any schema change needs explicit migration, rollback/backup and fixture tests.
- Keep existing globals and script order compatible until their consumers are migrated. Extract pure functions first; do not perform wholesale rewrites.
- Separate audio-thread DSP, main-thread UI and storage. Avoid allocation, network calls and blocking work inside audio processing callbacks.
- Never represent analysis, presets or mock UI as a working production engine. Label hardware, listening and browser results separately.
- Add deterministic tests for changes and run all existing Node suites and browser diagnostics. Do not weaken existing assertions to obtain green checks.
- Do not upload user audio, telemetry or credentials without explicit consent. Keep the public studio local-first.
- Preserve third-party attribution and license files. Review new assets and dependencies before redistributing.
- Each PR states scope, compatibility, risks, tests actually executed, and remaining limitations. No automatic merge.
