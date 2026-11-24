# Quality gates

Run from repository root with Node 22:

    node --test tests/*.test.cjs

The existing suites cover core export/splitting, instrument assets, production/MIDI/automation, feedback and recording/worklet math. Preserve all of them. No npm dependencies are needed for these suites.

For browser diagnostics:

    npm install --no-save --package-lock=false --ignore-scripts playwright@1.56.1
    npx playwright install chromium
    node scripts/run-browser-diagnostics.cjs

The runner starts serve.mjs on localhost:4173, creates a clean browser context for each of the seven diagnostic pages, clicks Run, and checks its exact terminal success marker and absence of FAIL. The runner reports browser errors to aid investigation. It does not use your personal browser storage. Stop any other local server on port 4173 first. Set AURA_DIAGNOSTIC_TIMEOUT_MS to override the default 180000 ms per suite. To run one suite, pass its name (browser, interface, instruments, production, feedback, recording or producer).

The GitHub workflow runs unit tests and browser diagnostics independently. Browser diagnostics are generated-signal/browser integration tests, not a substitute for manual hardware or listening tests. Before merging, review all check results; if the baseline fails, record the cause and fix it rather than silently skipping a suite. Branch protection must be configured separately by the owner.

## Manual release checklist

- Verify microphone permissions, mono/stereo channels, clipping, latency and device disconnection.
- Test wired audio interfaces and MIDI controllers.
- Export real songs, audition dry/wet stems and verify sample rate, duration and alignment.
- Verify existing portable project backups restore on a clean origin and after upgrades.
- Test Chrome/Edge, Firefox, Safari, mobile touch and representative low-memory hardware.
- Evaluate subjective sample, pitch/time, vocal and mastering quality with musicians.

## Performance baseline protocol (not yet measured)

Use a fresh browser profile, report browser/OS/CPU/RAM, sample rate, buffer settings and exact revision. Test 16/32/64 mixed tracks for 10 minutes, then 5/15/60-minute mono and stereo recording as limits are removed. Record startup time, peak memory, underruns, render duration, output size and recovered frames after simulated interruption. Mark unsupported cases explicitly. Do not advertise target numbers as measured results. Use fixed project fixtures and compare against the same hardware between changes.

Production Suite adds an eighth Chromium diagnostic page (`node scripts/run-browser-diagnostics.cjs suite`) covering transcription, pitch editing, arrangement and adaptive export. Synthetic sources only; listening and hardware evaluation remain required.
