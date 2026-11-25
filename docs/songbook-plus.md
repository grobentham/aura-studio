# Start screen, Songbook + Remix, Aura Plus

## What users see
- **Hum a song** (start screen card, **🎤 Hum** in the session bar, or Actions → "Hum a song"): pick a tempo and style, get a one-bar count-in with an optional click, then hum or sing for up to 20 s. `AuraSuite.transcribe` turns the audio into notes, `toMidi` quantises them to 16ths, and the key is estimated (pitch-set fit plus Krumhansl profile, with an ending-note tie-break). Out-of-key notes are nudged one semitone into the key, chords are inferred, and the result opens as a new project. The microphone audio is never saved or uploaded; only the notes are kept.
- **Start screen** (first visit, or **⌂ Start** in the header, or Actions → "Start screen"): Learn & remix a song · Make a beat · Record a song · Remix your own melody · Open a project.
- **Songbook** (**♫ Songbook** in the session bar, or Actions → "Songbook"): 10 public-domain songs. Pick a style and Aura builds a full, editable arrangement as a new project, so the current project is never changed.
- **Remix your own melody** (Plus): select a melody clip, then pick a style. Chords are inferred per bar from the melody (diatonic I/IV/V preferred), and the result opens as a new project.
- **Aura Plus** (**✦ Get Plus** in the header): Free vs Plus comparison and Stripe checkout.

## Song structure
Every remix (Songbook, hummed or own clip) is laid out as Intro → Verse → Build → Chorus → Breakdown → Build → Final chorus → Outro. Builds hold the last chord under a rising snare (or tom) roll. The breakdown drops drums and bass. The final chorus adds crashes every 4 bars. Each track is split into one clip per section, so the structure shows on the timeline. Hums shorter than 8 bars are repeated to fill a verse.

## After generating
A "Your song is ready" panel offers Play, Sing over it (opens the Record panel), Keep editing, and Try another style (every style becomes its own project, so versions can be compared).

## Hum review and tempo
After humming, a review screen shows the notes on a mini piano roll with the key and tempo. It has Play my notes, Hum again, and a style switcher before building. With the click track off, the tempo (70–140 BPM) is estimated from note onsets (`estimateTempo`) and the grid is aligned to the first beat.

## Tutorial
`studio-tour.js` runs a 2-minute guided tour that spotlights the real controls: Songbook → Play → sections on the timeline → track headers → Mixer → Hum → Export → Start. Each step can be done by the user, or with the orange button that does it for them ("Make it for me" creates an Ode to Joy lo-fi demo as a new project). It's offered as a banner on the Start screen, in Quick guide, and in Actions → "Tutorial". It works with the keyboard (←/→, Esc), and its layout was checked at 1440×900 and 390×844.

## Feedback
Start screen, the ready panel and Actions → "Send feedback" open a form. It opens a prefilled GitHub issue (label `feedback`) or copies the text. Only the typed text, project name and browser are included, never audio or files.

## Beta mode
`PLAN.beta` in `plus-core.js` is `true`: every feature is free, the header shows **✦ Free beta**, and checkout is hidden. Set it to `false` when you're ready to charge.

## Free vs Plus (when beta is off)
Free: everything that existed before (recording, editing, mixing, every export), the whole Songbook, Lo-fi and Piano styles.
Plus: Trap, House, Synthwave, Cinematic, Rock and Reggaeton styles, plus remixing your own melodies.

## Turning on payments (Stripe Payment Link)
1. In Stripe → Product catalogue, create a product "Aura Plus" with a recurring price (default copy says US$4.99/month; change `priceLabel` in `plus-core.js` if you pick something else).
2. Create a **Payment Link** for it. Under **After payment**, choose "Don't show confirmation page" and redirect to
   `https://grobentham.github.io/aura-studio/?plus=success&session_id={CHECKOUT_SESSION_ID}`
3. Paste the link (`https://buy.stripe.com/...`) into `paymentLink` in `plus-core.js` and bump the `?v=` on `plus-core.js` in `index.html` and `sw.js`.
Until `paymentLink` is set, the button reads "Checkout opening soon" and is disabled.

## Known limitations (be honest about these)
- There is no server, so the unlock is stored in the buyer's browser (`aura-plus-v1`). It does not move to other browsers or devices, and someone who reads the code can unlock it without paying. A small verification endpoint (Stripe webhook plus license check, e.g. a Cloudflare Worker) is the next step before scaling.
- A subscription cancelled in Stripe is not detected by the app for the same reason.
- Remix arrangements are rule-based (patterns, voicings, inferred chords), not AI generation. Listening quality has not been evaluated with users.
