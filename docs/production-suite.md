# Production Suite — next increment

New Tools → Production Suite workspace with:
- Worker-based monophonic pitch segmentation (20-second clip limit, clean single-note input), graphical editable targets and confidence, original or corrected editable MIDI export into the project.
- Offline note-by-note pitch alignment with bounded segment context, boundary fades, persisted derived asset before editing metadata and a single Undo. No real-time pitch correction, formant preservation, or polyphonic transcription claims.
- 32-bar six-section arrangement appended to the timeline as four editable MIDI tracks. Existing content remains unchanged. Uses project key, motif and three style choices.
- Gain-only loudness-targeted WAV export with BS.1770-style gated loudness and 4x interpolated peak estimate; no certified true-peak limiter or professional mastering claim. Maximum 120-second render including tail.
- Pure and Chromium integration tests. All algorithms local, no new API costs.

Next engineering work: chunk-backed long-duration audio asset playback and portable backups; modular routing and effects; real audio listening tests, latency calibration, real microphone/MIDI and browser coverage. Do not advertise these as completed.

The existing Producer and project format remain intact. The new workspace has no new schema and all changes use ordinary audio/MIDI regions.
