# Classical collection

Seven public-domain classical pieces are bundled as ordinary Aura JSON projects in `songs/classical/`:
Für Elise, Moonlight Sonata (1st mvt), Ode to Joy, Canon in D, Clair de Lune, Gymnopédie No. 1 and In the Hall of the Mountain King.

- On first load in a browser, `studio-classical.js` adds them to the local Projects library once (flag `aura-classical-seeded-v1` in localStorage). Removing one later does not bring it back.
- Projects → **Add classical pieces** re-adds any that are missing (matched by title); existing projects are never changed.
- Nothing is uploaded; the files are fetched from this site and written to the same IndexedDB `projects` store that imports use. No schema change.
- The arrangements were written note by note, not transcribed from a specific edition. Für Elise, Canon in D, Ode to Joy, Mountain King and the Gymnopédie opening follow the originals closely. Moonlight Sonata and Clair de Lune cover their openings, and some later notes and both endings are approximations. They use the existing recorded instruments (credits as listed in Sound credits).
