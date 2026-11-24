# Aura Vocal Pro

Dedicated local monophonic workspace: 20-second clip bound, note segmentation and draggable pitch targets, keyboard/numeric editing, per-note enable, waveform-synchronous overlap-add correction, diatonic upper/lower harmony tracks, bounded de-essing/gain riding/quiet-noise attenuation, source/processed audition. Derived tracks are persisted and muted by default; original source remains unchanged. PSOLA-style grain duration follows the source period, a formant-conscious approximation, not certified or guaranteed formant preservation; unstable pitch, speech, consonants and polyphony can produce artifacts.

Experimental mono live headphone monitoring: analyser snapshots are pitch-detected in a worker, with a dual-delay-head AudioWorklet, bounded ±2 semitone shift and adjustable response. Requires normal monitoring Off and explicit consent. Raw microphone capture is unchanged. Stops on hidden tab, closing panel, input disconnection or monitor-mode change. This is not low-latency professional Auto-Tune, not an insert plugin, and does not automatically print tuned audio to recordings. Physical microphone, latency and real vocal listening evaluation remain outstanding.

Unit and Chromium diagnostics cover synthetic pitch, harmony, non-destructive persistence, note editing and worklet startup. No remote AI services.
