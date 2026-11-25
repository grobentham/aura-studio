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
      const v = [.88, .48, .71, .53, .81, .47, .67, .58][i] * (bar >= 12 ? 1.06 : 1);
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
    if (bar < 2 || bar === 19) return [];
    const hit = (p, t, v) => ({ p, t, d: .17, v });
    if (bar === 18) return [hit(0, 0, .88), hit(7, 0, .55)];
    if (bar < 4) return [hit(0, 0, .86), hit(1, 1, .78), hit(0, 2.5, .82), hit(1, 3, .84),
      ...Array.from({ length: 8 }, (_, i) => hit(3, i / 2 + i % 2 * .014, [.62,.38,.54,.43,.66,.39,.55,.45][i])),
      ...(bar === 3 ? [hit(5, 3.5, .68), hit(1, 3.75, .58)] : [])];
    const full = bar >= 12;
    const notes = [
      hit(0, 0, .98), hit(0, 2, .94), hit(1, 1.018, .94), hit(1, 3.012, .98),
      ...Array.from({ length: 8 }, (_, i) => hit(i === 7 && full && bar % 2 === 0 ? 4 : 3, i / 2 + i % 2 * .014, [.76,.43,.64,.49,.8,.45,.67,.52][i])),
    ];
    if (bar % 2 === 1) notes.push(hit(0, 2.75, .8), hit(1, 2.5, .31));
    else notes.push(hit(0, 1.5, .74));
    if (bar === 4 || bar === 12) notes.push(hit(7, 0, .76));
    if (bar % 4 === 3) notes.push(hit(5, 3.5, .74), hit(1, 3.75, .65));
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
    const piano = addT('synth', { name: 'Piano pulse', preset: 'Dynamic Upright', vol: .64, rev: .09 });
    const bass = addT('synth', { name: 'Bass roots', preset: 'Finger Bass', vol: .70, rev: 0 });
    const drums = addT('drums', { name: 'Live drums', kit: 'Live Room Kit', vol: .93, rev: .035 });
    const guitar = addT('synth', { name: 'Guitar answers', preset: 'Clean Electric', vol: .56, pan: .32, rev: .15 });
    addSections(piano, pianoBar, true);
    addSections(bass, bassBar);
    addSections(drums, drumBar);
    addSections(guitar, guitarBar);
  };


  // Two full-length studies, with an original melodic line (not a transcription).
  const backingTitle = 'My Moon My Man · Full backing';
  const melodicTitle = 'My Moon My Man · Full melodic study';
  const fullForm = [
    ['Intro',4,'intro'], ['Verse A',16,'verse'], ['Lift A',16,'lift'],
    ['Verse B',16,'verse2'], ['Instrumental break',8,'break'],
    ['Lift B',16,'lift2'], ['Final groove',16,'final'], ['Outro groove',8,'outro'],
    ['Ending',4,'ending'],
  ];
  const fullBars = fullForm.reduce((sum, section) => sum + section[1], 0);
  function originalLead(chord, bar, mode) {
    if (['intro','break','ending'].includes(mode)) return [];
    if (mode === 'outro' && bar >= 4) return [];
    const p = chord.piano.map(n => n + 12);
    const lift = ['lift','lift2','final'].includes(mode);
    const phrases = [
      [[0,.5,.65,.78],[1,1.5,.42,.67],[2,2.25,1.25,.83]],
      [[2,0,.8,.79],[1,1.25,.65,.69],[0,2.5,.95,.74]],
      [[1,.25,.65,.71],[2,1.25,.9,.83],[1,2.75,.65,.67]],
      [[0,0,1.4,.77],[2,2,.55,.72],[1,3,.55,.62]],
    ];
    const phrase = phrases[(bar + (mode === 'verse2' ? 1 : 0)) % 4];
    if (!lift && bar % 8 === 7) return [];
    return phrase.map(([degree,t,d,v],i) => ({
      p: p[degree] + (lift && bar % 8 >= 4 && i === 2 ? 12 : 0),
      t, d, v: Math.min(.96,v * (lift ? 1.12 : .87)),
    }));
  }
  function fullPart(track, kind) {
    let offset = 0;
    for (const [name,count,mode] of fullForm) {
      // Eight/four-bar editable clips keep the arrangement easy to navigate.
      for (let first = 0; first < count; first += 4) {
        const length = Math.min(4,count-first);
        const notes = [];
        for (let i=0;i<length;i++) {
          const bar = first+i;
          const chord = mode === 'ending' ? sections[4].bars[bar] : harmony[bar%4];
          const virtual = mode === 'ending' ? 16+bar : mode === 'intro' ? bar :
            mode === 'verse' || mode === 'verse2' ? 4+bar%4 :
            mode === 'break' ? 8+bar%4 : mode === 'outro' ? 8+bar%4 : 12+bar%4;
          let part = [];
          if (kind === 'piano') part = pianoBar(chord,virtual);
          if (kind === 'bass') part = bassBar(chord,virtual);
          if (kind === 'drums') part = drumBar(chord,virtual);
          if (kind === 'guitar') part = guitarBar(chord,virtual);
          if (kind === 'lead') part = originalLead(chord,bar,mode);
          if (mode === 'break' && kind === 'drums' && bar < 4) part = part.filter(n=>n.p===0||n.p===3).map(n=>({...n,v:n.v*.65}));
          if (mode === 'verse2' && kind === 'guitar') part = guitarBar(chord,8+bar%4).filter(n=>n.t<2);
          if (mode === 'outro' && bar >= 4 && kind !== 'piano') part = part.map(n=>({...n,v:n.v*.72}));
          for (const n of part) notes.push({...n,t:i*beatsPerBar+n.t});
        }
        if (notes.length) track.regions.push(mkRegion((offset+first)*4,length*4,notes,{name:first ? name+' · '+(first/4+1) : name}));
      }
      offset += count;
    }
  }
  function loadFullStudy(withLead) {
    Object.assign(state,{title:withLead?melodicTitle:backingTitle,bpm:125,root:4,scale:'Minor',bars:fullBars,loop:{on:false,start:16,end:32}});
    fullPart(addT('synth',{name:'Piano pulse',preset:'Dynamic Upright',vol:.64,rev:.09}),'piano');
    fullPart(addT('synth',{name:'Bass roots',preset:'Finger Bass',vol:.70,rev:0}),'bass');
    fullPart(addT('drums',{name:'Live drums',kit:'Live Room Kit',vol:.93,rev:.035}),'drums');
    fullPart(addT('synth',{name:'Guitar answers',preset:'Clean Electric',vol:.43,pan:.32,rev:.12}),'guitar');
    if (withLead) fullPart(addT('synth',{name:'Melodic lead',preset:'Warm Keys',vol:.83,pan:0,rev:.14,dly:.08}),'lead');
  }
  STARTERS[backingTitle] = () => loadFullStudy(false);
  STARTERS[melodicTitle] = () => loadFullStudy(true);

  const steps = [
    ['Listen to the layers', 'Press Play from bar 1. Piano opens the arrangement, bass and a drum pickup enter at bar 3, the full drum groove starts at bar 5. Guitar enters in the lifts of the full arrangement (bar 9 in the short study). Listen for the stronger kick, snare accents and section changes.'],
    ['Look inside the piano clip', 'Double-click the first piano clip or select it and choose Edit. Each bar uses one chord, in order Am, C, Em and G. Try changing the length of one of the short notes.'],
    ['Loop and mix the groove', 'In Arrange, start playback at bar 5 with Cycle on. The Live drums track is the recorded acoustic kit; solo it to hear the kick, snare, hats and fills. Open Mix and use S to solo the bass or drums. Clear the solos and lower the guitar fader. Turn Cycle off, return to Arrange and listen from bar 9.'],
    ['Keep your version', 'Use Save to make a checkpoint. In Export song, choose Entire song to include the C–D–Em ending. Projects > Download project keeps your edited clips.'],
  ];
  const start = h('button', { id: 'openSongPractice', class: 'primary', onclick: () => openPractice(melodicTitle) }, 'Open melodic version');
  const backing = h('button', { id: 'openSongBacking', onclick: () => openPractice(backingTitle) }, 'Open backing version');
  const short = h('button', { id: 'openSongShort', onclick: () => openPractice(title) }, 'Open short study');
  const guide = productionDialog('songGuideModal', 'My Moon My Man', [
    h('p', { class: 'muted' }, 'Instrumental groove study based on the song by Feist and Chilly Gonzales. Choose a 104-bar (about 3:20) arrangement at 125 BPM in E minor. The melodic version includes an original lead line in place of a vocal; it is not the original song melody. The backing version leaves space for singing.'),
    h('div', { class: 'production-actions' }, start, backing, short),
    h('ol', { class: 'welcome-steps' }, steps.map(([label, instruction]) =>
      h('li', {}, h('b', {}, label), h('p', {}, instruction)))),
    h('p', { class: 'muted' }, 'The practice project opens as a separate session. Return to this guide from Quick guide or Projects.'),
    h('a', { href: 'https://www.youtube.com/watch?v=ltYq-jalYm0', target: '_blank', rel: 'noopener' }, 'Listen to Feist’s original'),
  ]);

  async function openPractice(projectTitle) {
    for (const button of [start, backing, short]) button.disabled = true;
    const previousId = activeProjectId;
    try {
      await newProject(projectTitle);
      if (activeProjectId === previousId || state.title !== projectTitle) return;
      guide.hidden = true;
      const fit = $('#fitArrangement');
      if (fit?.getClientRects().length) fit.click();
    } finally {
      for (const button of [start, backing, short]) button.disabled = false;
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
      h('b', {}, 'My Moon My Man'), h('small', {}, 'Full versions · With or without melodic lead')));
  studioActions.push(['My Moon My Man song guide', 'Learn the groove and open an editable instrumental project', openGuide]);
})();
