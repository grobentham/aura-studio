/* Aura Plus: plan configuration and purchase-return parsing (pure). */
(function(root){
  'use strict';
  const PLAN={
    name:'Aura Plus',
    // Paste your Stripe Payment Link here (https://buy.stripe.com/...). Leave empty to show "checkout opening soon".
    paymentLink:'',
    priceLabel:'US$4.99 / month',
    storageKey:'aura-plus-v1',
    features:[
      'Every remix style: Trap, House, Synthwave, Cinematic, Rock, Reggaeton',
      'Remix your own melodies: turn any clip into a full arrangement',
      'Every new Songbook song and style as they are added',
      'Supports an independent, local-first studio'
    ],
    free:[
      'Recording, editing, mixing and all exports (WAV, stems, MIDI) stay free',
      'Full Songbook with Lo-fi and Piano remixes',
      'Projects stay on your device. No account needed'
    ]
  };
  // Stripe Payment Link "after payment" redirect should be:
  //   https://<your-site>/aura-studio/?plus=success&session_id={CHECKOUT_SESSION_ID}
  function parseReturn(search){
    const q=new URLSearchParams(search||'');
    if(q.get('plus')!=='success')return null;
    const session=q.get('session_id')||'';
    if(!/^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(session))return null;
    return{session,live:session.startsWith('cs_live_')};
  }
  function cleanSearch(search){const q=new URLSearchParams(search||'');q.delete('plus');q.delete('session_id');const s=q.toString();return s?'?'+s:'';}
  function readEntitlement(raw){try{const v=JSON.parse(raw||'null');return v&&typeof v.session==='string'&&v.session.startsWith('cs_')?v:null;}catch(e){return null;}}
  function needsPlus(genre){return!!(genre&&genre.plus);}
  const api={PLAN,parseReturn,cleanSearch,readEntitlement,needsPlus};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraPlus=api;
})(typeof globalThis!=='undefined'?globalThis:this);
