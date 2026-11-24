'use strict';

(() => {
  const title = 'My Moon My Man · Instrumental study';
  const beatsPerBar = 4;
  const harmony = [
    { name: 'Am', piano: [57, 60, 64], bass: 33 },
    { name: 'C', piano: [55, 60, 64], bass: 36 },
    { name: 'Em', piano: [55, 59, 64], bass: 40 },
    { name: 'G', piano: [55, 59, 62], bass: 31 },
  ];
  const sections = [
    { name: 'Piano intro', bars: harmony },
    { name: 'First groove', bars: harmony },
    { name: 'Guitar enters', bars: harmony },
    { name: 'Full groove', bars: harmony },
    {
      name: 'Ending',
      bars: [harmony[1], { name: 'D', piano: [57, 62, 66], bass: 38 }, harmony[2], harmony[2]],
    },
  ];

  function pianoBar(chord, bar) {
    if (bar >= 18) {
      return chord.piano.map((p, i) => ({ p, t: i * .055, d: 3.65 - i * .055, v: .72 - i * .06 }));
    }
    const notes = [];
    for (let i = 0; i < 8; i++) {
      const v = [.84, .55, .68, .58, .79, .54, .65, .6][i];
      notes.push({ p: chord.piano[0], t: i / 2, d: .25, v });
      if (i % 2 === 0 || i === 7) {
        for (const p of chord.piano.slice(1)) notes.push({ p, t: i / 2 + .02, d: .27, v: v * .79 });
      }
    }
    return notes;
  }

  function bassBar(chord, bar) {
    if (bar < 2) return [];
    if (bar >= 18) return [{ p: chord.bass, t: 0, d: bar === 19 ? 3.65 : 2.85, v: .73 }];
    return [
      { p: chord.bass, t: 0, d: .65, v: .86 },
      { p: chord.bass, t: 1, d: .4, v: .67 },
      { p: chord.bass, t: 2, d: .64, v: .81 },
      { p: chord.bass + (bar % 4 === 3 ? 12 : 0), t: 3, d: .38, v: .71 },
      ...(bar % 4 === 3 ? [{ p: chord.bass + 7, t: 3.5, d: .28, v: .59 }] : []),
    ];
  }

  function drumBar(_chord, bar) {
    if (bar < 4 || bar === 19) return [];
    const hit = (p, t, v) => ({ p, t, d: .17, v });
    if (bar === 18) return [hit(0, 0, .88), hit(7, 0, .55)];
    const notes = [
      hit(0, 0, .9), hit(0, 2, .82), hit(1, 1, .82), hit(1, 3, .88),
      ...Array.from({ length: 8 }, (_, i) => hit(3, i / 2 + i % 2 * .015, i % 2 ? .37 : .54)),
    ];
    if (bar % 2 === 1) notes.push(hit(0, 2.75, .64));
    if (bar % 4 === 3) notes.push(hit(5, 3.5, .62), hit(1, 3.75, .54));
    return notes;
  }

  function guitarBar(chord, bar) {
    if (bar < 8) return [];
    if (bar >= 18) return [{ p: chord.piano[2] + 12, t: .25, d: 1.5, v: .62 }];
    return [
      { p: chord.piano[1] + 12, t: .75, d: .3, v: .58 },
      { p: chord.piano[2] + 12, t: 1.5, d: .31, v: .67 },
      { p: chord.piano[0] + 12, t: 2.5, d: .29, v: .57 },
      { p: chord.piano[1] + 12, t: 3.25, d: .5, v: .62 },
    ];
  }

  function addSections(track, playBar, chordLabels = false) {
    let firstBar = 0;
    for (const section of sections) {
      const notes = section.bars.flatMap((chord, i) =>
        playBar(chord, firstBar + i).map(note => ({ ...note, t: i * beatsPerBar + note.t })));
      const name = chordLabels ? section.bars.map(chord => chord.name).join(' · ') : section.name;
      if (notes.length) track.regions.push(mkRegion(firstBar * beatsPerBar, section.bars.length * beatsPerBar, notes, { name }));
      firstBar += section.bars.length;
    }
  }

  STARTERS[title] = () => {
    Object.assign(state, { title, bpm: 125, root: 4, scale: 'Minor', bars: 20, loop: { on: false, start: 16, end: 32 } });
    const piano = addT('synth', { name: 'Piano pulse', preset: 'Dynamic Upright', vol: .72, rev: .13 });
    const bass = addT('synth', { name: 'Bass roots', preset: 'Finger Bass', vol: .76, rev: 0 });
    const drums = addT('drums', { name: 'Live drums', kit: 'Live Room Kit', vol: .69, rev: .08 });
    const guitar = addT('synth', { name: 'Guitar answers', preset: 'Clean Electric', vol: .51, pan: .22, rev: .23 });
    addSections(piano, pianoBar, true);
    addSections(bass, bassBar);
    addSections(drums, drumBar);
    addSections(guitar, guitarBar);
  };

  const steps = [
    ['Listen to the layers', 'Press Play from bar 1. Piano opens the arrangement, bass enters at bar 3, drums at bar 5 and guitar at bar 9.'],
    ['Look inside the piano clip', 'Double-click the first piano clip or select it and choose Edit. Each bar uses one chord, in order Am, C, Em and G. Try changing the length of one of the short notes.'],
    ['Loop and mix the groove', 'In Arrange, start playback at bar 5 with Cycle on. Open Mix and use S to solo the bass or drums. Clear the solos and lower the guitar fader. Turn Cycle off, return to Arrange and listen from bar 9.'],
    ['Keep your version', 'Use Save to make a checkpoint. In Export song, choose Entire song to include the C–D–Em ending. Projects > Download project keeps your edited clips.'],
  ];
  const start = h('button', { id: 'openSongPractice', class: 'primary', onclick: openPractice }, 'Open practice project');
  const guide = productionDialog('songGuideModal', 'My Moon My Man', [
    h('p', { class: 'muted' }, 'Instrumental groove study based on the song by Feist and Chilly Gonzales. Play and edit a short arrangement at 125 BPM in E minor.'),
    h('div', { class: 'production-actions' }, start),
    h('ol', { class: 'welcome-steps' }, steps.map(([label, instruction]) =>
      h('li', {}, h('b', {}, label), h('p', {}, instruction)))),
    h('p', { class: 'muted' }, 'The practice project opens as a separate session. Return to this guide from Quick guide or Projects.'),
    h('a', { href: 'https://www.youtube.com/watch?v=ltYq-jalYm0', target: '_blank', rel: 'noopener' }, 'Listen to Feist’s original'),
  ]);

  async function openPractice() {
    start.disabled = true;
    const previousId = activeProjectId;
    try {
      await newProject(title);
      if (activeProjectId === previousId || state.title !== title) return;
      guide.hidden = true;
      const fit = $('#fitArrangement');
      if (fit?.getClientRects().length) fit.click();
    } finally {
      start.disabled = false;
    }
  }

  function openGuide(event) {
    if (!canLeaveProject()) return;
    const previous = event?.currentTarget?.closest('.overlay');
    if (previous) {
      previous.hidden = true;
      if (previous.id === 'welcomeModal') {
        productionPrefs.welcomed = true;
        storeProductionPrefs();
      }
      const returnTo = $(previous.id === 'projectsModal' ? '#projectsButton' : '#railHelp');
      returnTo?.focus();
    }
    guide.hidden = false;
  }

  guide.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      guide.hidden = true;
      event.stopPropagation();
    }
  });

  const welcomeStart = $('#welcomeModal .primary');
  const welcomeActions = h('div', { class: 'production-actions' });
  welcomeStart.before(welcomeActions);
  welcomeActions.append(welcomeStart, h('button', { id: 'welcomeSongGuide', onclick: openGuide }, 'Try a song guide'));
  $('#helpModal .card').append(h('div', { class: 'production-actions' },
    h('button', { id: 'quickSongGuide', onclick: openGuide }, 'Song guide · My Moon My Man')));
  $('#projectsModal .starter-grid').append(
    h('button', { id: 'projectSongGuide', class: 'starter-card', onclick: openGuide },
      h('b', {}, 'My Moon My Man'), h('small', {}, 'Song guide · Piano, bass, drums and guitar')));
  studioActions.push(['My Moon My Man song guide', 'Learn the groove and open an editable instrumental project', openGuide]);
})();
