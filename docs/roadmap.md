# Delivery roadmap

Goal: an account-optional, local-first workstation for singer-songwriters that turns original ideas into editable songs. No new feature claims until tested.

| Milestone | Scope | Exit gate |
| --- | --- | --- |
| 1 — baseline | architecture, audit, CI, licensing inventory | all checks investigated; documented baseline; no app behavior change |
| 2 — reliable recording | pure recording policy, chunk storage, migration, long capture, latency calibration | recover committed frames; real interface testing; measured memory |
| 3 — audio core | explicit transport, shared graph, routing, effect chains, export streaming | realtime/offline parity and aligned exports |
| 4 — vocal MVP | monophonic pitch/key analysis, reversible correction, cleanup | signal fixtures, confidence, blind listening and no data loss |
| 5 — producer MVP | editable chord/bass/drum accompaniment from original melody, reversible mix assist | user can edit every generated part; complete song workflow |
| 6 — mastery | standards-based loudness/true peak, reference EQ, dynamics, A/B | metering conformance, level-matched listening, validated WAV |
| 7 — release | onboarding, licensing, domain migration, beta and willingness to pay | actual users complete songs and return; paid launch decision |

Do not prioritise collaboration, social network, VST bridge or generative song APIs until the core workflow proves demand. Retain free core recording, editing and portable project exports. Proposed commercial terms are hypotheses, not commitments.

Next implementation PR: extract the current recording cap policy (with no behavior change), add boundary tests and document the storage migration design. Never just remove caps while allocating a whole AudioBuffer.

Architecture increment: archive capture, bounded random-access section recovery, OPFS local WAV copies, quota/persistence dashboard and shared channel-strip lifecycle with editable EQ shape. Next: sustained physical capture stress test, archive-backed realtime playback, streaming portable project package, explicit routing graph and delay compensation. The 60-minute archive limit is a design target, not a verified hardware benchmark.
