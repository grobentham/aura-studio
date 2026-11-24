# Frequency mix assist and recording export

The new Tools → Frequency mix assist uses short-time FFT energy (low/mid/high), stereo correlation, RMS, crest and peak analysis on up to eight audible tracks from the playhead. Only simultaneous active windows count toward overlap. It suggests conservative cuts on existing broad EQ bands for tracks competing with the chosen priority track, not automatic artistic decisions or a precise psychoacoustic masking model. User selects changes, auditions both versions with RMS matching and peak safety, and applies as a single undoable operation. Analysis workers transfer PCM locally; no remote requests. It uses existing project EQ fields and live/offline graph.

Recovery WAV direct-to-disk output uses File System Access API where available; it writes validated journal blocks sequentially and closes only after completion. Fallback existing Blob download remains. Journal retained on success or failure. Capture shows remaining time based on its actual frame budget. Does not remove the 64 MiB normal capture limit, because decoded playback and backups still need architectural work. No claim of unlimited recording.

New mathematical and browser integration tests plus direct-writer equivalence check. Real mix listening and browser support tests remain required.
