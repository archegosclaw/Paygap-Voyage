// deck-builder.js — Odysseus Deck Builder panel
// Vanilla ES6, no external deps. Reuses Odysseus CSS tokens throughout.
import * as Modals from './modalManager.js';
import { makeWindowDraggable } from './windowDrag.js';

// ─────────────────────────────────────────────────────────────────────────────
// §0  HTML EXPORT ASSET CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const _VIEWPORT_CSS = `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111;}
*,*::before,*::after{box-sizing:border-box;}
.deck-viewport{position:fixed;inset:0;overflow:hidden;background:#111;}
.deck-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;transform-origin:0 0;}
.slide{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden;opacity:0;pointer-events:none;}
.slide.active,.slide.visible{visibility:visible;opacity:1;pointer-events:auto;z-index:1;}
@media print{html,body{width:1920px;height:auto;overflow:visible;background:white;}.deck-viewport{position:static;}.deck-stage{position:static;width:auto;height:auto;transform:none!important;}.slide{position:relative;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;width:1920px;height:1080px;break-after:page;}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}`;

const _EDITOR_CSS = `#mpgToolbar{position:fixed;bottom:0;left:0;right:0;height:52px;background:#fff;border-top:2px solid #E8E6FF;display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:9000;font-family:'Poppins',sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,0.06);}
#mpgToolbar .tb-group{display:flex;align-items:center;gap:8px;}
#mpgToolbar button{font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;border:none;cursor:pointer;border-radius:8px;padding:7px 14px;transition:background 0.15s;}
#tbPrev,#tbNext{background:#F2F2F2;color:#1A1A2E;font-size:17px;padding:5px 13px;}
#tbPrev:hover,#tbNext:hover{background:#E8E6FF;}
#tbCounter{font-size:13px;font-weight:500;color:#5A5A7A;min-width:56px;text-align:center;}
#tbEdit{background:#E8E6FF;color:#7B75E8;}
#tbEdit:hover,#tbEdit.active{background:#7B75E8;color:#fff;}
#tbUndo{background:#F2F2F2;color:#5A5A7A;}
#tbUndo:not([disabled]):hover{background:#E8E6FF;color:#7B75E8;}
#tbUndo[disabled]{opacity:0.3;cursor:not-allowed;}
#tbPdf{background:#F2F2F2;color:#1A1A2E;}
#tbPdf:hover{background:#E8E6FF;color:#7B75E8;}
#tbSave{background:#B8B4FF;color:#fff;}
#tbSave:hover{background:#7B75E8;}
#mpgMini{position:fixed;z-index:9500;display:none;background:#fff;border:1.5px solid #E8E6FF;border-radius:10px;padding:5px 8px;gap:5px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,0.12);}
#mpgMini button{font-size:12px;font-weight:600;border:none;background:#F2F2F2;color:#1A1A2E;border-radius:6px;padding:4px 9px;cursor:pointer;}
#mpgMini button:hover{background:#E8E6FF;color:#7B75E8;}
#miniDelete{background:#fff0f0!important;color:#e55!important;}
#miniColor{width:24px;height:24px;border:none;border-radius:5px;cursor:pointer;padding:0;}
.mini-sep{width:1px;height:20px;background:#E8E6FF;margin:0 1px;}
.mini-lbl{font-size:10px;color:#5A5A7A;padding:0 2px;}
.mpg-sel-ring{position:fixed;pointer-events:none;z-index:9380;border:2px solid #7B75E8;border-radius:2px;}
body.edit-mode .slide.active img{cursor:pointer;}
body.edit-mode .slide.active img:hover{outline:2px dashed #F5B8A0!important;}
.mpg-typing{outline:2px solid #7B75E8!important;}
@media print{#mpgToolbar,#mpgMini{display:none!important;}}`;

const _EDITOR_TOOLBAR_HTML = `<div id="mpgToolbar">
  <div class="tb-group"><button id="tbPrev">&#8249;</button><span id="tbCounter">1 / 1</span><button id="tbNext">&#8250;</button></div>
  <div class="tb-group"><button id="tbEdit">&#9998; Edit</button><button id="tbUndo" title="Undo Ctrl+Z">&#8617;</button></div>
  <div class="tb-group"><button id="tbPdf">&#8659; Export PDF</button><button id="tbSave">&#8595; Save</button></div>
</div>
<div id="mpgMini">
  <span class="mini-lbl">Text</span>
  <button id="miniFU">A+</button><button id="miniFD">A-</button>
  <button id="miniBold"><b>B</b></button>
  <input type="color" id="miniColor" value="#1A1A2E">
  <div class="mini-sep" id="miniCS"></div>
  <button id="miniReplace" style="display:none">&#128247; Replace photo</button>
  <button id="miniDelete">&#128465;</button>
</div>`;

// Verbatim from SKILL.md — no script tags, just the JS body
const _EDITOR_JS_CODE = `/* MPG INLINE EDITOR — text + photo-replace only. No drag/resize: position locked so layouts never break. */
var EM=false,SEL=null,TYPING=false,ring=null,_sl=null,undoStack=[];
var mini=document.getElementById('mpgMini'),tbE=document.getElementById('tbEdit'),tbU=document.getElementById('tbUndo');
document.getElementById('tbPrev').onclick=function(){deck.show(deck.current-1);};
document.getElementById('tbNext').onclick=function(){deck.show(deck.current+1);};
(function(){var o=deck.show.bind(deck);deck.show=function(i){if(EM)detach();o(i);document.getElementById('tbCounter').textContent=(deck.current+1)+' / '+deck.total;desel();if(EM)attach();};document.getElementById('tbCounter').textContent='1 / '+deck.total;})();
document.getElementById('tbPdf').onclick=function(){if(EM)tog();window.print();};
document.getElementById('tbSave').onclick=function(){var b=new Blob([document.documentElement.outerHTML],{type:'text/html'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(document.title||'deck').replace(/\\s+/g,'-').toLowerCase()+'.html';a.click();URL.revokeObjectURL(a.href);};
function pushU(a){undoStack.push(a);if(undoStack.length>40)undoStack.shift();tbU.disabled=false;}
function undo(){if(!undoStack.length)return;var a=undoStack.pop();if(a.type==='html'){a.el.innerHTML=a.v;}else if(a.type==='css'){a.el.style[a.p]=a.v;}else if(a.type==='del'){a.parent.insertBefore(a.el,a.next);}else if(a.type==='src'){a.el.src=a.v;}if(SEL)updR();if(!undoStack.length)tbU.disabled=true;}
tbU.onclick=undo;tbU.disabled=true;
function tog(){EM=!EM;document.body.classList.toggle('edit-mode',EM);tbE.classList.toggle('active',EM);tbE.textContent=EM?'\\u2713 Done':'\\u270F Edit';if(EM)attach();else{detach();desel();undoStack=[];tbU.disabled=true;}}
tbE.onclick=tog;
function mkR(){clrR();ring=document.createElement('div');ring.className='mpg-sel-ring';document.body.appendChild(ring);}
function clrR(){if(ring){ring.remove();ring=null;}}
function updR(){if(!SEL||!ring)return;var r=SEL.getBoundingClientRect();Object.assign(ring.style,{left:(r.left-1)+'px',top:(r.top-1)+'px',width:(r.width+2)+'px',height:(r.height+2)+'px'});}
window.addEventListener('resize',function(){if(SEL)updR();});
function sel(el){if(SEL===el){if(!TYPING&&el.tagName!=='IMG'&&isT(el)){TYPING=true;el.contentEditable='true';el.classList.add('mpg-typing');el.focus();el._hb=el.innerHTML;}return;}desel();SEL=el;mkR();updR();showM(el);}
function desel(){stopT();if(SEL){SEL=null;}clrR();mini.style.display='none';}
function stopT(){if(!TYPING||!SEL)return;if(SEL.contentEditable==='true'){if(SEL._hb!==undefined&&SEL._hb!==SEL.innerHTML)pushU({type:'html',el:SEL,v:SEL._hb});SEL.contentEditable='false';delete SEL._hb;}SEL.classList.remove('mpg-typing');TYPING=false;}
function isT(el){return['H1','H2','H3','H4','P','TD','TH','SPAN','LI','DIV'].indexOf(el.tagName)>-1;}
function showM(el){var r=el.getBoundingClientRect(),t=r.top-52,l=r.left;if(t<4)t=r.bottom+6;if(l+280>window.innerWidth)l=window.innerWidth-288;mini.style.top=t+'px';mini.style.left=l+'px';mini.style.display='flex';var im=el.tagName==='IMG';document.getElementById('miniReplace').style.display=im?'inline-block':'none';['miniFU','miniFD','miniBold','miniColor','miniCS'].forEach(function(id){var n=document.getElementById(id);if(n)n.style.display=im?'none':'';});var lb=mini.querySelector('.mini-lbl');if(lb)lb.style.display=im?'none':'';}
function attach(){_sl=document.querySelector('.slide.active');if(!_sl)return;_sl.addEventListener('click',oSC);document.addEventListener('click',oDC);}
function detach(){if(_sl){_sl.removeEventListener('click',oSC);_sl=null;}document.removeEventListener('click',oDC);}
function oSC(e){if(!EM)return;if(mini.contains(e.target))return;var t=pick(e.target);if(!t){desel();return;}e.stopPropagation();sel(t);}
function oDC(e){if(!EM)return;if(mini.contains(e.target))return;if(_sl&&_sl.contains(e.target))return;desel();}
function pick(el){if(!_sl||!_sl.contains(el))return null;if(el.tagName==='IMG')return el;var c=el;while(c&&c!==_sl){if(isT(c))return c;c=c.parentElement;}return null;}
function gfs(el){return parseFloat(window.getComputedStyle(el).fontSize)||16;}
document.getElementById('miniFU').onclick=function(){if(!SEL)return;pushU({type:'css',el:SEL,p:'fontSize',v:SEL.style.fontSize});SEL.style.fontSize=(gfs(SEL)+2)+'px';updR();};
document.getElementById('miniFD').onclick=function(){if(!SEL)return;var s=gfs(SEL)-2;if(s<8)return;pushU({type:'css',el:SEL,p:'fontSize',v:SEL.style.fontSize});SEL.style.fontSize=s+'px';updR();};
document.getElementById('miniBold').onclick=function(){if(!SEL)return;var w=parseInt(window.getComputedStyle(SEL).fontWeight)||400;pushU({type:'css',el:SEL,p:'fontWeight',v:SEL.style.fontWeight});SEL.style.fontWeight=w>=700?'400':'700';};
document.getElementById('miniColor').oninput=function(e){if(!SEL)return;pushU({type:'css',el:SEL,p:'color',v:SEL.style.color});SEL.style.color=e.target.value;};
document.getElementById('miniDelete').onclick=function(){if(!SEL)return;if(confirm('Delete this element?')){pushU({type:'del',el:SEL,parent:SEL.parentNode,next:SEL.nextSibling});var t=SEL;desel();t.remove();}};
document.getElementById('miniReplace').onclick=function(){if(!SEL||SEL.tagName!=='IMG')return;var el=SEL;var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=function(ev){if(!ev.target.files[0])return;var r=new FileReader();r.onload=function(e){pushU({type:'src',el:el,v:el.src});el.src=e.target.result;updR();};r.readAsDataURL(ev.target.files[0]);};inp.click();};
document.addEventListener('keydown',function(e){var iT=TYPING;if((e.key==='e'||e.key==='E')&&!iT){tog();return;}if((e.key==='z'||e.key==='Z')&&(e.ctrlKey||e.metaKey)&&!iT){e.preventDefault();undo();return;}if((e.key==='s'||e.key==='S')&&(e.ctrlKey||e.metaKey)){e.preventDefault();document.getElementById('tbSave').click();return;}if(e.key==='Escape'){if(iT)stopT();else if(SEL)desel();return;}if((e.key==='Delete'||e.key==='Backspace')&&SEL&&!iT){document.getElementById('miniDelete').click();return;}if(!iT&&!EM){if(['ArrowRight','ArrowDown',' ','PageDown'].indexOf(e.key)>-1){e.preventDefault();deck.show(deck.current+1);}if(['ArrowLeft','ArrowUp','PageUp'].indexOf(e.key)>-1){e.preventDefault();deck.show(deck.current-1);}}});`;

// ─────────────────────────────────────────────────────────────────────────────
// §1  STATE
// ─────────────────────────────────────────────────────────────────────────────

const _MODAL_ID   = 'deck-builder-modal';
const _RAIL_ID    = 'rail-deck-builder';
const _SIDEBAR_ID = 'tool-deck-builder-btn';

const _state = {
  deck: _emptyDeck(),
  currentSlide: 0,
  editMode: false,
  undoStack: [],          // array of deck snapshots
  chatMessages: [],       // { role: 'user'|'ai', text: string }
  brandKit: null,         // loaded from /api/brand/kit
  activeTab: 'chat',      // 'chat' | 'brand'
  thinking: false,
};

function _emptyDeck() {
  return {
    title: 'Untitled Deck',
    brand: 'mpg',
    slides: [{
      id: 'slide-1',
      layout: 'title',
      background: null,
      blocks: [
        { id: 'b1', type: 'heading',    text: 'Presentation Title',   position: { x: 0.05, y: 0.28, w: 0.55, h: 0.18 } },
        { id: 'b2', type: 'subheading', text: 'Subtitle or tagline',  position: { x: 0.05, y: 0.48, w: 0.55, h: 0.10 } },
      ],
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  OPERATIONS & UNDO
// ─────────────────────────────────────────────────────────────────────────────

function _pushUndo() {
  _state.undoStack.push(JSON.stringify(_state.deck));
  if (_state.undoStack.length > 30) _state.undoStack.shift();
}

function _undo() {
  if (!_state.undoStack.length) return;
  _state.deck = JSON.parse(_state.undoStack.pop());
  _state.currentSlide = Math.min(_state.currentSlide, _state.deck.slides.length - 1);
  _renderAll();
}

function _applyOp(op) {
  const slides = _state.deck.slides;

  if (op.op === 'REPLACE_DECK') {
    if (!Array.isArray(op.slides) || !op.slides.length) return;
    _pushUndo();
    _state.deck.slides = op.slides;
    if (op.title) _state.deck.title = op.title;
    _state.currentSlide = 0;

  } else if (op.op === 'ADD_SLIDE') {
    _pushUndo();
    const newSlide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      layout: op.layout || 'content',
      background: null,
      blocks: Array.isArray(op.blocks) ? op.blocks : [],
    };
    const after = typeof op.after === 'number' ? op.after : slides.length - 1;
    slides.splice(after + 1, 0, newSlide);
    _state.currentSlide = after + 1;

  } else if (op.op === 'DELETE_SLIDE') {
    if (slides.length <= 1) return;
    const idx = slides.findIndex(s => s.id === op.slideId);
    if (idx === -1) return;
    _pushUndo();
    slides.splice(idx, 1);
    _state.currentSlide = Math.min(_state.currentSlide, slides.length - 1);

  } else if (op.op === 'UPDATE_BLOCK') {
    const slide = slides.find(s => s.id === op.slideId);
    if (!slide) return;
    const block = (slide.blocks || []).find(b => b.id === op.blockId);
    if (!block) return;
    _pushUndo();
    Object.assign(block, op.updates || {});

  } else if (op.op === 'ADD_BLOCK') {
    const slide = slides.find(s => s.id === op.slideId);
    if (!slide || !op.block) return;
    _pushUndo();
    if (!Array.isArray(slide.blocks)) slide.blocks = [];
    slide.blocks.push(op.block);

  } else if (op.op === 'DELETE_BLOCK') {
    const slide = slides.find(s => s.id === op.slideId);
    if (!slide) return;
    const idx = (slide.blocks || []).findIndex(b => b.id === op.blockId);
    if (idx === -1) return;
    _pushUndo();
    slide.blocks.splice(idx, 1);

  } else if (op.op === 'SET_BRAND') {
    _pushUndo();
    _state.deck.brand = op.brand || 'mpg';
  }
}

function _applyOps(ops) {
  if (!Array.isArray(ops)) return;
  ops.forEach(op => { try { _applyOp(op); } catch (e) { console.warn('[deck-builder] op failed', op, e); } });
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  SLIDE RENDERER  (1920×1080 fixed stage, scaled via CSS transform)
// ─────────────────────────────────────────────────────────────────────────────

const _MPG = {
  bg:     '#F2F2F2',
  text:   '#1A1A2E',
  accent: '#B8B4FF',
  muted:  '#5A5A7A',
  card:   '#E8E6FF',
  font:   "'Poppins', system-ui, sans-serif",
};

function _resolveTheme() {
  const kit = _state.brandKit;
  if (!kit) return _MPG;
  const sd = (kit.brand || {}).slide_defaults || {};
  return {
    bg:     sd.bg     || _MPG.bg,
    text:   sd.text   || _MPG.text,
    accent: sd.accent || _MPG.accent,
    muted:  _MPG.muted,
    card:   sd.card   || _MPG.card,
    font:   _MPG.font,
  };
}

function _esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// **bold** → bold accent, *accent* → accent-coloured span.
// Edit mode: return plain escaped text so user edits raw markers.
function _md(s, accent) {
  if (_state.editMode) return _esc(s);
  const a = accent || _resolveTheme().accent;
  return _esc(s)
    .replace(/\*\*([^*\n<]+)\*\*/g, `<strong style="color:${a}">$1</strong>`)
    .replace(/\*([^*\n<]+)\*/g, `<span style="color:${a}">$1</span>`);
}

function _ce() { return _state.editMode ? 'true' : 'false'; }

function _getBlock(blocks, type) {
  return (blocks || []).find(b => (b.type || '').toLowerCase() === type) || null;
}

// 1920×1080 slide renderer — all sizes in absolute pixels
function _renderSlide(slide, opts = {}) {
  const theme  = _resolveTheme();
  const blocks = slide.blocks || [];
  const layout = (slide.layout || 'content').toLowerCase();
  const bg     = (slide.background || {}).color || theme.bg;

  const label      = _getBlock(blocks, 'label');
  const heading    = _getBlock(blocks, 'heading');
  const subheading = _getBlock(blocks, 'subheading');
  const body       = _getBlock(blocks, 'body');
  const bulletsBlk = _getBlock(blocks, 'bullets');
  const statsBlk   = _getBlock(blocks, 'stats');
  const illus      = _getBlock(blocks, 'illustration');
  const logo       = _getBlock(blocks, 'logo');

  const editH    = heading    ? ` class="db-editable" data-block-id="${heading.id}"    contenteditable="${_ce()}"` : '';
  const editSub  = subheading ? ` class="db-editable" data-block-id="${subheading.id}" contenteditable="${_ce()}"` : '';
  const editBody = body       ? ` class="db-editable" data-block-id="${body.id}"       contenteditable="${_ce()}"` : '';

  // Illustration (svg with png fallback)
  const illustAsset = illus?.asset || 'event-management';
  const iSvg = `/api/brand/asset/mpg/illustrations/${_esc(illustAsset)}.svg`;
  const iPng = `/api/brand/asset/mpg/illustrations/${_esc(illustAsset)}.png`;
  const illustImg = `<img src="${iSvg}" onerror="this.src='${iPng}';this.onerror=null" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${_esc(illustAsset)}" />`;

  // Logo watermark (content slides)
  const logoAsset = logo?.asset || 'mpg_purple_logo';
  const lUrl = `/api/brand/asset/mpg/logos/${_esc(logoAsset)}.png`;
  const watermark = `<img src="${lUrl}" onerror="this.onerror=null;this.style.display='none'" style="position:absolute;top:40px;right:60px;width:150px;height:auto;z-index:10;pointer-events:none;" alt="MPG" />`;

  const labelHtml = label
    ? `<div style="font-size:22px;font-weight:600;color:${theme.accent};letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;">${_esc(label.text||'')}</div>`
    : '';

  const base = `position:relative;width:1920px;height:1080px;background:${bg};font-family:${theme.font};overflow:hidden;`;

  // ── title ────────────────────────────────────────────────────────────────────
  if (layout === 'title') {
    const logoLeft = logo
      ? `<img src="${lUrl}" onerror="this.onerror=null;this.style.display='none'" style="position:absolute;top:60px;left:80px;width:200px;height:auto;" alt="MPG" />`
      : '';
    return `<div style="${base}">
      ${logoLeft}
      <div style="position:absolute;left:0;top:0;width:1200px;height:1080px;display:flex;flex-direction:column;justify-content:center;padding:120px 140px;">
        ${labelHtml}
        <div${editH} style="font-size:96px;font-weight:800;color:${theme.text};line-height:1.05;margin-bottom:36px;">${_md(heading?.text||'Title', theme.accent)}</div>
        <div${editSub} style="font-size:30px;font-weight:300;color:${theme.muted};line-height:1.5;">${_md(subheading?.text||'', theme.accent)}</div>
      </div>
      <div style="position:absolute;right:0;top:0;width:720px;height:1080px;background:${theme.card};clip-path:ellipse(100% 100% at 100% 50%);display:flex;align-items:center;justify-content:center;">
        <div style="width:500px;height:500px;display:flex;align-items:center;justify-content:center;">${illustImg}</div>
      </div>
    </div>`;
  }

  // ── stats ─────────────────────────────────────────────────────────────────────
  if (layout === 'stats') {
    const statCount = (statsBlk?.stats || []).length;
    const numSize = statCount >= 4 ? '100px' : statCount === 3 ? '120px' : '140px';
    const statCards = (statsBlk?.stats || []).map(s =>
      `<div style="flex:1;background:white;border-radius:24px;padding:48px 32px;text-align:center;min-width:0;">
        <div style="font-size:${numSize};font-weight:800;color:${theme.accent};line-height:1;">${_md(String(s.num||''), theme.accent)}</div>
        <div style="font-size:26px;font-weight:600;color:${theme.text};margin-top:16px;line-height:1.3;">${_md(s.label||'', theme.accent)}</div>
      </div>`
    ).join('');
    const bodyBelowStats = body
      ? `<div${editBody} style="margin-top:36px;background:${theme.card};border-radius:20px;padding:36px 48px;font-size:28px;color:${theme.text};line-height:1.6;">${_md(body.text||'', theme.accent)}</div>`
      : '';
    if (illus) {
      return `<div style="${base}">
        ${watermark}
        <div style="position:absolute;left:0;top:0;width:1280px;height:1080px;padding:90px 100px;display:flex;flex-direction:column;">
          ${labelHtml}
          <div${editH} style="font-size:60px;font-weight:700;color:${theme.text};line-height:1.15;margin-bottom:48px;">${_md(heading?.text||'', theme.accent)}</div>
          <div style="display:flex;gap:36px;">${statCards}</div>
          ${bodyBelowStats}
        </div>
        <div style="position:absolute;right:0;top:0;width:640px;height:1080px;display:flex;align-items:center;justify-content:center;padding:80px 60px;">${illustImg}</div>
      </div>`;
    }
    return `<div style="${base}">
      ${watermark}
      <div style="padding:90px 120px;display:flex;flex-direction:column;height:100%;">
        ${labelHtml}
        <div${editH} style="font-size:60px;font-weight:700;color:${theme.text};line-height:1.15;margin-bottom:48px;">${_md(heading?.text||'', theme.accent)}</div>
        <div style="display:flex;gap:40px;">${statCards}</div>
        ${bodyBelowStats}
      </div>
    </div>`;
  }

  // ── two-col / bullets-card ────────────────────────────────────────────────────
  if (layout === 'two-col' || layout === 'two_col' || layout === 'bullets-card' || layout === 'bullets_card') {
    const items = bulletsBlk?.items || [];
    const cols = Math.min(Math.max(items.length, 2), 4);
    const cards = items.map(item => {
      const rawTitle = typeof item === 'string' ? item : (item.text || '');
      const body2    = typeof item === 'object' ? (item.body || '') : '';
      const featured = typeof item === 'object' && item.featured;

      // Extract **RM X,XXX** or **RM XK** price markers for large display
      const priceMatch = rawTitle.match(/\*\*(RM[\s\d,.KkMmBb]+)\*\*/i);
      const price = priceMatch ? priceMatch[1].trim() : null;
      const titleText = price
        ? rawTitle.replace(priceMatch[0], '').replace(/^\s*[-–—\s]+/, '').trim()
        : rawTitle;

      // Split body into bullet items if it contains → or newline or +
      const bodyItems = body2
        ? body2.split(/\n|→|•|\+(?= )/).map(s => s.replace(/^[→•\s]+/, '').trim()).filter(Boolean)
        : [];
      const bodyHtml = bodyItems.length > 1
        ? bodyItems.map(l => `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:${cols>=3?'10px':'12px'};">
            <span style="color:${theme.accent};flex-shrink:0;font-weight:700;font-size:${cols>=3?'18px':'20px'};">→</span>
            <span style="font-size:${cols>=3?'18px':'20px'};color:${theme.muted};line-height:1.45;">${_md(l, theme.accent)}</span>
          </div>`).join('')
        : (body2 ? `<div style="font-size:${cols>=3?'20px':'22px'};color:${theme.muted};line-height:1.5;">${_md(body2, theme.accent)}</div>` : '');

      const cardBg = featured ? theme.card : 'white';
      const cardBorder = featured
        ? `outline:2px solid ${theme.accent};`
        : `border-left:4px solid ${theme.accent};`;
      const priceFontSize = cols >= 3 ? '68px' : '84px';
      const nameFontSize  = cols >= 3 ? '22px' : '26px';

      return `<div style="background:${cardBg};border-radius:20px;padding:32px 36px;${cardBorder}position:relative;display:flex;flex-direction:column;">
        ${featured ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:${theme.accent};color:white;font-size:15px;font-weight:700;padding:4px 18px;border-radius:20px;letter-spacing:1px;white-space:nowrap;">BEST VALUE</div>` : ''}
        ${price ? `<div style="font-size:${priceFontSize};font-weight:800;color:${theme.accent};line-height:1;margin-bottom:6px;">${price}</div>` : ''}
        <div style="font-size:${nameFontSize};font-weight:600;color:${theme.text};line-height:1.25;margin-bottom:${price?'4px':'10px'};">${_md(titleText, theme.accent)}</div>
        ${price ? `<div style="font-size:16px;color:${theme.muted};margin-bottom:20px;font-weight:400;">per edition</div>` : ''}
        <div style="flex:1;margin-top:${price?'0':'8px'};">${bodyHtml}</div>
      </div>`;
    }).join('');
    return `<div style="${base}">
      ${watermark}
      <div style="padding:80px 120px;display:flex;flex-direction:column;height:100%;">
        ${labelHtml}
        <div${editH} style="font-size:56px;font-weight:600;color:${theme.text};line-height:1.15;margin-bottom:44px;">${_md(heading?.text||'', theme.accent)}</div>
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:28px;flex:1;align-items:stretch;">${cards}</div>
      </div>
    </div>`;
  }

  // ── table (key-value rows) ────────────────────────────────────────────────────
  if (layout === 'table') {
    const rows = (bulletsBlk?.items || []).map((item, i) => {
      const key = typeof item === 'string' ? item : (item.text || '');
      const val = typeof item === 'object' ? (item.body || '') : '';
      const rowBg = i % 2 === 0 ? 'white' : theme.bg;
      return `<div style="display:flex;background:${rowBg};border-radius:12px;padding:28px 40px;gap:40px;align-items:center;">
        <div style="width:300px;flex-shrink:0;font-size:26px;font-weight:600;color:${theme.accent};line-height:1.3;">${_esc(key)}</div>
        <div style="flex:1;font-size:26px;color:${theme.text};line-height:1.5;">${_md(val, theme.accent)}</div>
      </div>`;
    }).join('');
    const tableW = illus ? '1200px' : '1760px';
    return `<div style="${base}">
      ${watermark}
      <div style="position:absolute;left:0;top:0;width:${tableW};height:1080px;padding:90px 120px;display:flex;flex-direction:column;">
        ${labelHtml}
        <div${editH} style="font-size:60px;font-weight:700;color:${theme.text};line-height:1.15;margin-bottom:48px;">${_md(heading?.text||'', theme.accent)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
      </div>
      ${illus ? `<div style="position:absolute;right:0;top:0;width:720px;height:1080px;display:flex;align-items:center;justify-content:center;padding:80px 60px;">${illustImg}</div>` : ''}
    </div>`;
  }

  // ── content (default) ─────────────────────────────────────────────────────────
  const bodyCard = body
    ? `<div${editBody} style="background:white;border-radius:24px;padding:44px 48px;border-left:4px solid ${theme.accent};font-size:30px;color:${theme.text};line-height:1.65;margin-bottom:28px;">${_md(body.text||'', theme.accent)}</div>`
    : '';

  const bulletItems = (bulletsBlk?.items || []).map(item => {
    const txt   = typeof item === 'string' ? item : (item.text || '');
    const body2 = typeof item === 'object' ? (item.body || '') : '';
    return `<div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:20px;">
      <span style="color:${theme.accent};font-size:28px;line-height:1.5;flex-shrink:0;font-weight:700;margin-top:2px;">→</span>
      <span style="font-size:28px;color:${theme.text};line-height:1.5;">${_md(txt, theme.accent)}${body2 ? `<br><span style="color:${theme.muted};font-size:24px;">${_md(body2, theme.accent)}</span>` : ''}</span>
    </div>`;
  }).join('');

  const hasIllus = !!illus;
  const contentW = hasIllus ? '1100px' : '1760px';

  return `<div style="${base}">
    ${watermark}
    <div style="position:absolute;left:0;top:0;width:${contentW};height:1080px;padding:100px 120px;display:flex;flex-direction:column;">
      ${labelHtml}
      <div${editH} style="font-size:56px;font-weight:600;color:${theme.text};line-height:1.15;margin-bottom:36px;">${_md(heading?.text||'', theme.accent)}</div>
      ${subheading && !body ? `<div${editSub} style="font-size:30px;font-weight:300;color:${theme.muted};line-height:1.5;margin-bottom:32px;">${_md(subheading.text||'', theme.accent)}</div>` : ''}
      ${bodyCard}
      <div>${bulletItems}</div>
    </div>
    ${hasIllus ? `<div style="position:absolute;right:0;top:0;width:820px;height:1080px;display:flex;align-items:center;justify-content:center;padding:100px 80px;">${illustImg}</div>` : ''}
  </div>`;
}

function _renderThumb(slide, idx) {
  const W = 82, H = 46;
  const scale = (W / 1920).toFixed(6);
  const active = idx === _state.currentSlide;
  const border = active ? 'var(--accent-primary)' : 'var(--border)';
  return `<div class="db-thumb${active?' db-thumb-active':''}" data-thumb-idx="${idx}"
    style="width:${W}px;height:${H}px;border-radius:3px;cursor:pointer;border:2px solid ${border};flex-shrink:0;overflow:hidden;position:relative;">
    <div style="width:1920px;height:1080px;transform:scale(${scale});transform-origin:0 0;pointer-events:none;">
      ${_renderSlide(slide)}
    </div>
    <span style="position:absolute;bottom:1px;right:2px;font-size:5.5px;opacity:0.5;font-family:system-ui;color:#1A1A2E;">${idx+1}</span>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  RENDER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _renderAll() {
  _renderThumbs();
  _renderCurrentSlide();
  _updateNavBar();
}

function _renderThumbs() {
  const strip = document.getElementById('db-thumb-strip');
  if (!strip) return;
  strip.innerHTML = _state.deck.slides.map((s, i) => _renderThumb(s, i)).join('');
  // Add slide button
  strip.insertAdjacentHTML('beforeend', `<button id="db-add-slide" title="Add slide" style="min-width:36px;height:46px;background:var(--bg);border:2px dashed var(--border);border-radius:4px;cursor:pointer;color:var(--fg);opacity:0.5;font-size:18px;flex-shrink:0;">+</button>`);
}

function _renderCurrentSlide() {
  const canvas = document.getElementById('db-canvas');
  if (!canvas) return;
  const slide = _state.deck.slides[_state.currentSlide];
  if (!slide) { canvas.innerHTML = ''; return; }

  const parent = canvas.parentElement;
  const availW = Math.max((parent?.offsetWidth || 800) - 40, 320);
  const scale  = availW / 1920;
  const scaledH = Math.round(1080 * scale);

  canvas.style.cssText = `width:${availW}px;height:${scaledH}px;overflow:hidden;flex-shrink:0;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,0.15);`;
  canvas.innerHTML = `<div style="width:1920px;height:1080px;transform:scale(${scale.toFixed(6)});transform-origin:0 0;">${_renderSlide(slide)}</div>`;
  _bindBlockEdits(canvas);
}

function _updateNavBar() {
  const counter = document.getElementById('db-slide-counter');
  if (counter) counter.textContent = `${_state.currentSlide + 1} / ${_state.deck.slides.length}`;
  const undoBtn = document.getElementById('db-undo-btn');
  if (undoBtn) undoBtn.disabled = !_state.undoStack.length;
  const editBtn = document.getElementById('db-edit-btn');
  if (editBtn) {
    editBtn.classList.toggle('db-btn-active', _state.editMode);
    editBtn.textContent = _state.editMode ? 'Done' : 'Edit';
  }
}

function _bindBlockEdits(canvas) {
  canvas.querySelectorAll('.db-editable').forEach(el => {
    el.addEventListener('blur', () => {
      if (!_state.editMode) return;
      const blockId = el.dataset.blockId;
      if (!blockId) return;
      const slide = _state.deck.slides[_state.currentSlide];
      if (!slide) return;
      const block = (slide.blocks || []).find(b => b.id === blockId);
      if (!block) return;
      const newText = el.textContent || '';
      if (block.text !== newText) {
        _pushUndo();
        block.text = newText;
        _updateNavBar();
      }
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  CHAT RENDERING
// ─────────────────────────────────────────────────────────────────────────────

function _renderChat() {
  const log = document.getElementById('db-chat-log');
  if (!log) return;
  log.innerHTML = _state.chatMessages.map(m => {
    const isUser = m.role === 'user';
    const text = (m.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    return `<div class="db-chat-msg ${isUser ? 'db-msg-user' : 'db-msg-ai'}">${text}</div>`;
  }).join('');
  if (_state.thinking) {
    log.insertAdjacentHTML('beforeend', `<div class="db-chat-msg db-msg-ai db-thinking"><span></span><span></span><span></span></div>`);
  }
  log.scrollTop = log.scrollHeight;
}

function _addChatMsg(role, text) {
  _state.chatMessages.push({ role, text });
  _renderChat();
}

// ─────────────────────────────────────────────────────────────────────────────
// §6  BRAND TAB
// ─────────────────────────────────────────────────────────────────────────────

async function _loadBrandKit() {
  try {
    const res = await fetch('/api/brand/kit?brand=mpg');
    if (!res.ok) return;
    _state.brandKit = await res.json();
  } catch (e) {
    console.warn('[deck-builder] brand kit load failed', e);
  }
}

function _renderBrandTab() {
  const container = document.getElementById('db-brand-tab');
  if (!container) return;
  const kit = _state.brandKit;
  if (!kit) {
    container.innerHTML = `<div style="padding:16px;color:var(--text-secondary);font-size:13px;">Loading brand kit…</div>`;
    return;
  }
  const palette = (kit.brand?.palette || []).map(c => `
    <div title="${c.name}: ${c.hex}" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;" class="db-color-swatch" data-hex="${c.hex}">
      <div style="width:28px;height:28px;border-radius:6px;background:${c.hex};border:1px solid var(--border-color);flex-shrink:0;"></div>
      <span style="font-size:12px;color:var(--text-primary);">${c.name}</span>
      <span style="font-size:11px;color:var(--text-secondary);margin-left:auto;">${c.hex}</span>
    </div>`).join('');

  const illustrations = (kit.assets?.illustrations || []).map(a => `
    <div class="db-asset-thumb db-asset-wrap" data-asset-name="${a.name}" data-asset-url="${a.url}" data-asset-cat="illustrations" title="Click to insert"
      style="position:relative;width:70px;height:50px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);padding:4px;">
      <img src="${a.url}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${a.name}" />
      <button class="db-asset-del" data-name="${a.name}" data-cat="illustrations" title="Delete" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.55);border:none;border-radius:50%;width:15px;height:15px;color:#fff;cursor:pointer;font-size:9px;line-height:15px;text-align:center;display:none;padding:0;">×</button>
    </div>`).join('');

  const logos = (kit.assets?.logos || []).map(a => `
    <div class="db-asset-thumb db-logo-thumb db-asset-wrap" data-asset-name="${a.name}" data-asset-url="${a.url}" data-asset-cat="logos" title="Click to insert"
      style="position:relative;width:90px;height:40px;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);padding:4px;">
      <img src="${a.url}" style="max-height:100%;max-width:100%;object-fit:contain;" alt="${a.name}" />
      <button class="db-asset-del" data-name="${a.name}" data-cat="logos" title="Delete" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.55);border:none;border-radius:50%;width:15px;height:15px;color:#fff;cursor:pointer;font-size:9px;line-height:15px;text-align:center;display:none;padding:0;">×</button>
    </div>`).join('');

  container.innerHTML = `
    <div style="padding:12px;overflow-y:auto;height:100%;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin-bottom:10px;">Palette</div>
      ${palette || '<div style="font-size:12px;color:var(--text-secondary);">No palette defined</div>'}

      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin:16px 0 10px;">Illustrations</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${illustrations || '<div style="font-size:12px;color:var(--text-secondary);">No illustrations uploaded</div>'}</div>
      <label style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 10px;border:1px dashed var(--border-color);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Upload illustration
        <input type="file" id="db-upload-illustration" accept="image/png,image/svg+xml,image/jpeg" multiple style="display:none;" />
      </label>

      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin:16px 0 10px;">Logos</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${logos || '<div style="font-size:12px;color:var(--text-secondary);">No logos uploaded</div>'}</div>
      <label style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 10px;border:1px dashed var(--border-color);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Upload logo
        <input type="file" id="db-upload-logo" accept="image/png,image/svg+xml,image/jpeg" multiple style="display:none;" />
      </label>
    </div>`;

  // Upload handlers
  container.querySelector('#db-upload-illustration')?.addEventListener('change', e => _uploadAsset(e, 'illustrations'));
  container.querySelector('#db-upload-logo')?.addEventListener('change', e => _uploadAsset(e, 'logos'));

  // Delete asset buttons
  container.querySelectorAll('.db-asset-del').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const name = btn.dataset.name;
      const cat = btn.dataset.cat;
      if (!confirm(`Remove "${name}" from ${cat}?`)) return;
      try {
        await fetch(`/api/brand/asset/mpg/${cat}/${encodeURIComponent(name)}`, { method: 'DELETE' });
      } catch (err) {
        console.error('[deck-builder] delete asset error', err);
      }
      await _loadBrandKit();
      _renderBrandTab();
    });
  });

  // Insert illustration on click (delegate to wrapper, skip del button)
  container.querySelectorAll('.db-asset-thumb[data-asset-name]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('db-asset-del')) return;
      const assetName = el.dataset.assetName;
      const cat = el.dataset.assetCat || 'illustrations';
      const slide = _state.deck.slides[_state.currentSlide];
      if (!slide) return;
      _applyOp({
        op: 'ADD_BLOCK',
        slideId: slide.id,
        block: {
          id: `b_${Date.now()}`,
          type: cat === 'logos' ? 'logo' : 'illustration',
          asset: assetName,
          position: cat === 'logos'
            ? { x: 0.03, y: 0.03, w: 0.12, h: 0.10 }
            : { x: 0.55, y: 0.10, w: 0.40, h: 0.80 },
        },
      });
      _renderAll();
    });
  });
}

async function _uploadAsset(e, category) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    form.append('brand', 'mpg');
    form.append('category', category);
    try {
      const res = await fetch('/api/brand/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[deck-builder] upload failed:', err.detail || res.status);
      }
    } catch (err) {
      console.error('[deck-builder] upload error', err);
    }
  }
  await _loadBrandKit();
  _renderBrandTab();
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  AI BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

function _selectedModel() {
  const val = document.getElementById('db-model-select')?.value || '';
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

async function _sendToAI(userMessage, opts = {}) {
  if (_state.thinking) return;
  if (!opts.silent) _addChatMsg('user', userMessage);
  _state.thinking = true;
  _renderChat();

  try {
    const body = { message: userMessage, deck: _state.deck };
    const modelSel = _selectedModel();
    if (modelSel?.model_id)   body.model_id   = modelSel.model_id;
    if (modelSel?.endpoint_id) body.endpoint_id = modelSel.endpoint_id;

    const res = await fetch('/api/deck/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = typeof err.detail === 'string' ? err.detail : (err.error || `HTTP ${res.status}`);
      _addChatMsg('ai', `Generation failed: ${detail}`);
      return;
    }

    const data = await res.json();
    const ops = data.operations || [];
    if (!ops.length) {
      _addChatMsg('ai', 'The AI returned no changes. Try rephrasing your request.');
      return;
    }

    // CHAT op — conversational reply, no deck changes
    if (ops.length === 1 && ops[0].op === 'CHAT') {
      _addChatMsg('ai', ops[0].message || 'Done.');
      return;
    }

    _applyOps(ops);
    _renderAll();

    const slideCount = _state.deck.slides.length;
    const summary = ops[0]?.op === 'REPLACE_DECK'
      ? `Generated a ${slideCount}-slide deck: "${_state.deck.title}".`
      : `Applied ${ops.length} change${ops.length > 1 ? 's' : ''} to your deck.`;
    _addChatMsg('ai', summary);
  } catch (err) {
    _addChatMsg('ai', 'Could not reach the AI. Check your connection and try again.');
    console.error('[deck-builder] generate error', err);
  } finally {
    _state.thinking = false;
    _renderChat();
  }
}

function _describeOp(op) {
  switch (op.op) {
    case 'REPLACE_DECK': return `Generated a ${(op.slides || []).length}-slide deck: "${op.title || _state.deck.title}".`;
    case 'ADD_SLIDE':    return `Added a new ${op.layout || 'content'} slide.`;
    case 'DELETE_SLIDE': return `Deleted slide.`;
    case 'UPDATE_BLOCK': return `Updated slide content.`;
    case 'ADD_BLOCK':    return `Added ${op.block?.type || 'block'} to slide.`;
    case 'SET_BRAND':    return `Switched to ${op.brand} brand.`;
    default:             return `Applied ${op.op}.`;
  }
}

function _cleanPDFText(text) {
  let t = text;
  // CJK characters often get space-separated by PDF extractors — rejoin them
  for (let i = 0; i < 5; i++) {
    t = t.replace(/([一-鿿　-〿＀-￯])\s+([一-鿿　-〿＀-￯])/g, '$1$2');
  }
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

async function _extractPDF(file) {
  _addChatMsg('user', `Uploaded: ${file.name}`);
  _state.thinking = true;
  _renderChat();

  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/deck/extract-pdf', { method: 'POST', body: form });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      _addChatMsg('ai', `Could not read PDF: ${err.detail || res.status}.`);
      return;
    }

    const { text } = await res.json();
    const cleaned = _cleanPDFText(text);
    _state.thinking = false;
    _addChatMsg('ai', `Read ${text.length.toLocaleString()} characters from "${file.name}". Building your deck…`);
    await _sendToAI(
      `Generate a full presentation deck from this document content. Use the MPG brand system. Follow the deck type templates from your instructions and produce rich, complete slides.\n\n---\n${cleaned.slice(0, 12000)}`,
      { silent: true }
    );
  } catch (err) {
    _addChatMsg('ai', 'Failed to read the PDF. Please try again.');
    console.error('[deck-builder] pdf error', err);
  } finally {
    _state.thinking = false;
    _renderChat();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  EXPORT
// ─────────────────────────────────────────────────────────────────────────────

async function _exportHTML() {
  const exportBtn = document.getElementById('db-export-html');
  if (exportBtn) { exportBtn.disabled = true; exportBtn.textContent = 'Exporting…'; }

  try {
    // Fetch base64-embedded Poppins from the font-css API
    let fontCSS = '';
    try {
      const fr = await fetch('/api/brand/font-css/mpg');
      if (fr.ok) fontCSS = await fr.text();
    } catch { /* fall through */ }
    if (!fontCSS) {
      fontCSS = "@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');";
    }

    const wasEdit = _state.editMode;
    _state.editMode = false;
    const slidesHTML = _state.deck.slides.map((s, i) =>
      `<section class="slide${i === 0 ? ' active visible' : ''}">${_renderSlide(s)}</section>`
    ).join('\n');
    _state.editMode = wasEdit;

    const title = _esc(_state.deck.title || 'Presentation');
    // Use string concat to keep </script> out of this template literal
    const CTAG = '<' + '/script>';

    const slideController = `class SlidePresentation{constructor(){this.slides=document.querySelectorAll('.slide');this.total=this.slides.length;this.current=0;this.stage=document.getElementById('deckStage');this._scale();window.addEventListener('resize',()=>this._scale());this._keys();this._touch();this.showSlide(0);}_scale(){var f=Math.min(window.innerWidth/1920,window.innerHeight/1080);var x=(window.innerWidth-1920*f)/2,y=(window.innerHeight-1080*f)/2;this.stage.style.transform='translate('+x+'px,'+y+'px) scale('+f+')';}_keys(){var self=this;document.addEventListener('keydown',function(e){if(['ArrowRight','ArrowDown',' ','PageDown'].indexOf(e.key)>-1&&!e.target.isContentEditable){e.preventDefault();self.next();}else if(['ArrowLeft','ArrowUp','PageUp'].indexOf(e.key)>-1&&!e.target.isContentEditable){e.preventDefault();self.prev();}else if(e.key==='Home'){e.preventDefault();self.showSlide(0);}else if(e.key==='End'){e.preventDefault();self.showSlide(self.slides.length-1);}});}_touch(){var sx=0,self=this;document.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});document.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>50)dx<0?self.next():self.prev();});}next(){this.showSlide(this.current+1);}prev(){this.showSlide(this.current-1);}show(i){this.showSlide(i);}showSlide(i){this.current=Math.max(0,Math.min(i,this.slides.length-1));this.slides.forEach(function(s,j){s.classList.toggle('active',j===this.current);s.classList.toggle('visible',j===this.current);},this);}}
const deck=new SlidePresentation();`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
/* === FONTS === */
${fontCSS}
/* === VIEWPORT BASE === */
${_VIEWPORT_CSS}
/* === MPG EDITOR === */
${_EDITOR_CSS}
</style>
</head>
<body>
<div class="deck-viewport">
<main class="deck-stage" id="deckStage">
${slidesHTML}
</main>
</div>
${_EDITOR_TOOLBAR_HTML}
<script>
${slideController}
${CTAG}
<script>
${_EDITOR_JS_CODE}
${CTAG}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(_state.deck.title || 'presentation').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } finally {
    if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export HTML'; }
  }
}

async function _exportPPTX() {
  const exportBtn = document.getElementById('db-export-pptx');
  if (exportBtn) { exportBtn.disabled = true; exportBtn.textContent = 'Exporting…'; }

  // Convert SVG illustration blocks to PNG via canvas before sending
  const deckCopy = JSON.parse(JSON.stringify(_state.deck));
  for (const slide of deckCopy.slides) {
    for (const block of (slide.blocks || [])) {
      if (block.type === 'illustration' && block.asset && !block.png) {
        const url = `/api/brand/asset/mpg/illustrations/${block.asset}.svg`;
        block.png = await _svgUrlToPng(url, 400, 300).catch(() => null);
      }
    }
  }

  try {
    const res = await fetch('/api/deck/export-pptx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck: deckCopy, brand: _state.deck.brand || 'mpg' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Export failed: ${res.status}`);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(_state.deck.title || 'deck').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}.pptx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (err) {
    alert(`PPTX export failed: ${err.message}`);
    console.error('[deck-builder] pptx export', err);
  } finally {
    if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export PPTX'; }
  }
}

async function _svgUrlToPng(url, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * 2; canvas.height = h * 2;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// §9  PANEL LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

async function _loadModels() {
  const select = document.getElementById('db-model-select');
  if (!select) return;
  try {
    const res = await fetch('/api/models');
    if (!res.ok) return;
    const data = await res.json();
    const opts = [];
    (data.items || []).forEach(ep => {
      const display = ep.models_display || ep.models || [];
      (ep.models || []).forEach((mid, i) => {
        opts.push({ mid, endpointId: ep.endpoint_id || null, label: display[i] || mid });
      });
    });
    if (!opts.length) return;
    select.innerHTML = '<option value="">Auto model</option>';
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ model_id: o.mid, endpoint_id: o.endpointId });
      opt.textContent = o.label;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn('[deck-builder] failed to load models', e);
  }
}

function _buildPanelHTML() {
  return `
<div class="modal" id="${_MODAL_ID}">
  <div class="modal-content" style="width:min(1100px,92vw);height:min(680px,88vh);min-width:700px;padding:0;overflow:hidden;display:flex;flex-direction:column;">

    <!-- Header -->
    <div class="modal-header" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-color);flex-shrink:0;cursor:move;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.6;flex-shrink:0;"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      <input id="db-title-input" value="${(_state.deck.title||'Untitled Deck').replace(/"/g,'&quot;')}"
        style="background:none;border:none;outline:none;font-size:14px;font-weight:600;color:var(--fg);flex:1;min-width:0;"
        placeholder="Deck title…" />
      <select id="db-model-select" title="AI model for generation"
        style="background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--fg);font-size:11px;padding:2px 5px;max-width:160px;flex-shrink:0;">
        <option value="">Auto model</option>
      </select>
      <button class="modal-close" id="db-close-btn" style="flex-shrink:0;">&times;</button>
    </div>

    <!-- Body: split panel -->
    <div style="display:flex;flex:1;min-height:0;">

      <!-- Left: Chat + Brand tabs -->
      <div style="width:320px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid var(--border-color);">

        <!-- Tab bar -->
        <div style="display:flex;border-bottom:1px solid var(--border-color);flex-shrink:0;">
          <button class="db-tab-btn db-tab-active" id="db-tab-chat" style="flex:1;padding:9px;font-size:12px;border:none;cursor:pointer;background:none;border-bottom:2px solid var(--accent-primary);color:var(--text-primary);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat
          </button>
          <button class="db-tab-btn" id="db-tab-brand" style="flex:1;padding:9px;font-size:12px;border:none;cursor:pointer;background:none;border-bottom:2px solid transparent;color:var(--text-secondary);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20 5 5 0 0 1-5-5 3 3 0 0 1 3-3h2a3 3 0 0 0 3-3 5 5 0 0 0-5-5"/></svg>Brand
          </button>
        </div>

        <!-- Chat tab content -->
        <div id="db-chat-tab" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div id="db-chat-log" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;"></div>

          <!-- PDF drop zone -->
          <div id="db-pdf-drop" style="margin:0 10px 6px;padding:8px;border:1.5px dashed var(--border-color);border-radius:7px;text-align:center;font-size:11px;color:var(--text-secondary);cursor:pointer;transition:border-color 0.15s;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Drop PDF to generate deck
            <input type="file" id="db-pdf-input" accept=".pdf" style="display:none;" />
          </div>

          <!-- Chat input -->
          <div style="padding:8px 10px 10px;border-top:1px solid var(--border-color);display:flex;gap:6px;flex-shrink:0;">
            <textarea id="db-chat-input" rows="2" placeholder="Ask AI to edit your deck…"
              style="flex:1;resize:none;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:7px;padding:7px 10px;font-size:13px;color:var(--text-primary);font-family:inherit;outline:none;line-height:1.4;"></textarea>
            <button id="db-chat-send" title="Send (Enter)"
              style="padding:0 12px;background:var(--accent-primary);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:16px;flex-shrink:0;">&#8593;</button>
          </div>
        </div>

        <!-- Brand tab content -->
        <div id="db-brand-tab" style="display:none;flex:1;overflow-y:auto;"></div>

      </div><!-- /left panel -->

      <!-- Right: Slide canvas -->
      <div style="flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg-primary);">

        <!-- Thumbnail strip -->
        <div id="db-thumb-strip" style="display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid var(--border-color);overflow-x:auto;flex-shrink:0;align-items:center;"></div>

        <!-- Slide canvas -->
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden;">
          <div id="db-canvas" style="overflow:hidden;border-radius:4px;flex-shrink:0;"></div>
        </div>

        <!-- Bottom bar -->
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--border-color);flex-shrink:0;background:var(--bg-secondary);">
          <button id="db-prev-btn" title="Previous slide" style="width:28px;height:28px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:5px;cursor:pointer;color:var(--text-primary);font-size:14px;">&#8592;</button>
          <span id="db-slide-counter" style="font-size:12px;color:var(--text-secondary);min-width:48px;text-align:center;">1 / 1</span>
          <button id="db-next-btn" title="Next slide" style="width:28px;height:28px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:5px;cursor:pointer;color:var(--text-primary);font-size:14px;">&#8594;</button>
          <button id="db-undo-btn" title="Undo" disabled style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:5px;cursor:pointer;font-size:12px;color:var(--text-secondary);">&#8630; Undo</button>
          <button id="db-edit-btn" title="Toggle inline editing" style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:5px;cursor:pointer;font-size:12px;color:var(--text-primary);">Edit</button>
          <div style="flex:1;"></div>
          <button id="db-export-html" style="padding:4px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:5px;cursor:pointer;font-size:12px;color:var(--text-primary);">Export HTML</button>
          <button id="db-export-pptx" style="padding:4px 12px;background:var(--accent-primary);border:none;border-radius:5px;cursor:pointer;font-size:12px;color:#fff;font-weight:600;">Export PPTX</button>
        </div>

      </div><!-- /right panel -->
    </div><!-- /body -->
  </div><!-- /modal-content -->
</div>`;
}

function _injectStyles() {
  if (document.getElementById('db-styles')) return;
  // Load embedded Poppins from brand API (falls back to Google Fonts if unavailable)
  if (!document.querySelector('link[href*="/api/brand/font-css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/api/brand/font-css/mpg';
    document.head.appendChild(link);
  }
  const style = document.createElement('style');
  style.id = 'db-styles';
  style.textContent = `
    /* Alias missing vars scoped to this modal so all inline style refs resolve */
    #${_MODAL_ID} {
      --text-primary:   var(--fg);
      --text-secondary: color-mix(in srgb, var(--fg) 55%, transparent);
      --bg-primary:     var(--bg);
      --bg-secondary:   var(--panel);
      --bg-tertiary:    var(--bg);
      --border-color:   var(--border);
    }
    /* Position within the chat area, matching gallery/calendar etc. */
    @media (min-width: 769px) {
      #${_MODAL_ID} {
        left: calc(var(--icon-rail-w, 48px) + var(--sidebar-w, 0px));
        width: calc(100% - (var(--icon-rail-w, 48px) + var(--sidebar-w, 0px)));
        box-sizing: border-box;
        transition: left 0.25s ease, width 0.25s ease;
      }
    }
    .db-tab-btn { transition: color 0.15s, border-color 0.15s; }
    .db-tab-btn:hover { color: var(--fg) !important; }
    .db-tab-active { color: var(--fg) !important; border-bottom-color: var(--accent-primary) !important; }
    .db-btn-active { background: var(--accent-primary) !important; color: #fff !important; }
    .db-chat-msg { padding: 8px 11px; border-radius: 8px; font-size: 13px; line-height: 1.5; max-width: 95%; word-break: break-word; }
    .db-msg-user { background: var(--accent-primary); color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; }
    .db-msg-ai   { background: var(--bg); color: var(--fg); align-self: flex-start; border-bottom-left-radius: 2px; }
    .db-thinking { display: flex; gap: 5px; align-items: center; padding: 10px 12px; }
    .db-thinking span { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-primary); animation: db-dot 1.2s infinite ease-in-out both; }
    .db-thinking span:nth-child(1) { animation-delay: -0.32s; }
    .db-thinking span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes db-dot { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
    .db-thumb { transition: border-color 0.12s; }
    .db-thumb:hover { border-color: var(--fg) !important; }
    .db-thumb-active { border-color: var(--accent-primary) !important; }
    #db-pdf-drop:hover, #db-pdf-drop.drag-over { border-color: var(--accent-primary); color: var(--fg); }
    .db-editable[contenteditable="true"]:hover { outline: 1px dashed rgba(184,180,255,0.45); outline-offset: 3px; border-radius: 3px; cursor: text; }
    .db-editable[contenteditable="true"]:focus { outline: 2px solid var(--accent-primary); outline-offset: 3px; background: rgba(184,180,255,0.07); border-radius: 3px; cursor: text; }
    .db-asset-thumb:hover { border-color: var(--accent-primary) !important; transform: scale(1.03); transition: transform 0.1s; }
    .db-asset-wrap:hover .db-asset-del { display: block !important; }
    .db-color-swatch:hover { opacity: 0.8; }
    .db-slide-canvas { user-select: none; }
    .db-slide-canvas [contenteditable="true"] { user-select: text; }
  `;
  document.head.appendChild(style);
}

function _bindEvents(modal) {
  // Close
  modal.querySelector('#db-close-btn')?.addEventListener('click', closeDeckBuilder);

  // Title input
  modal.querySelector('#db-title-input')?.addEventListener('input', e => {
    _state.deck.title = e.target.value;
  });

  // Tab switching
  modal.querySelector('#db-tab-chat')?.addEventListener('click', () => {
    _state.activeTab = 'chat';
    modal.querySelector('#db-chat-tab').style.display = 'flex';
    modal.querySelector('#db-brand-tab').style.display = 'none';
    modal.querySelector('#db-tab-chat').classList.add('db-tab-active');
    modal.querySelector('#db-tab-brand').classList.remove('db-tab-active');
    modal.querySelector('#db-tab-chat').style.borderBottomColor = 'var(--accent-primary)';
    modal.querySelector('#db-tab-brand').style.borderBottomColor = 'transparent';
    modal.querySelector('#db-tab-chat').style.color = 'var(--text-primary)';
    modal.querySelector('#db-tab-brand').style.color = 'var(--text-secondary)';
  });
  modal.querySelector('#db-tab-brand')?.addEventListener('click', () => {
    _state.activeTab = 'brand';
    modal.querySelector('#db-chat-tab').style.display = 'none';
    modal.querySelector('#db-brand-tab').style.display = 'block';
    modal.querySelector('#db-tab-brand').classList.add('db-tab-active');
    modal.querySelector('#db-tab-chat').classList.remove('db-tab-active');
    modal.querySelector('#db-tab-brand').style.borderBottomColor = 'var(--accent-primary)';
    modal.querySelector('#db-tab-chat').style.borderBottomColor = 'transparent';
    modal.querySelector('#db-tab-brand').style.color = 'var(--text-primary)';
    modal.querySelector('#db-tab-chat').style.color = 'var(--text-secondary)';
    _renderBrandTab();
  });

  // Chat send
  const chatInput = modal.querySelector('#db-chat-input');
  modal.querySelector('#db-chat-send')?.addEventListener('click', () => {
    const msg = chatInput?.value.trim();
    if (msg) { chatInput.value = ''; _sendToAI(msg); }
  });
  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); modal.querySelector('#db-chat-send')?.click(); }
  });

  // PDF drop zone
  const pdfDrop = modal.querySelector('#db-pdf-drop');
  const pdfInput = modal.querySelector('#db-pdf-input');
  pdfDrop?.addEventListener('click', () => pdfInput?.click());
  pdfInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) _extractPDF(file);
    pdfInput.value = '';
  });
  pdfDrop?.addEventListener('dragover', e => { e.preventDefault(); pdfDrop.classList.add('drag-over'); });
  pdfDrop?.addEventListener('dragleave', () => pdfDrop.classList.remove('drag-over'));
  pdfDrop?.addEventListener('drop', e => {
    e.preventDefault(); pdfDrop.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file?.type === 'application/pdf') _extractPDF(file);
  });

  // Thumbnail strip (event delegation)
  modal.querySelector('#db-thumb-strip')?.addEventListener('click', e => {
    const thumb = e.target.closest('[data-thumb-idx]');
    if (thumb) { _state.currentSlide = parseInt(thumb.dataset.thumbIdx, 10); _renderAll(); return; }
    if (e.target.id === 'db-add-slide' || e.target.closest('#db-add-slide')) {
      _applyOp({ op: 'ADD_SLIDE', layout: 'content', after: _state.currentSlide });
      _renderAll();
    }
  });

  // Navigation
  modal.querySelector('#db-prev-btn')?.addEventListener('click', () => {
    if (_state.currentSlide > 0) { _state.currentSlide--; _renderAll(); }
  });
  modal.querySelector('#db-next-btn')?.addEventListener('click', () => {
    if (_state.currentSlide < _state.deck.slides.length - 1) { _state.currentSlide++; _renderAll(); }
  });

  // Edit toggle
  modal.querySelector('#db-edit-btn')?.addEventListener('click', () => {
    _state.editMode = !_state.editMode;
    _renderAll();
  });

  // Undo
  modal.querySelector('#db-undo-btn')?.addEventListener('click', _undo);

  // Export
  modal.querySelector('#db-export-html')?.addEventListener('click', _exportHTML);
  modal.querySelector('#db-export-pptx')?.addEventListener('click', _exportPPTX);
}

export function openDeckBuilder() {
  if (Modals.isRegistered(_MODAL_ID) && Modals.isMinimized(_MODAL_ID)) {
    Modals.restore(_MODAL_ID);
    return;
  }
  // Only create one instance
  if (document.getElementById(_MODAL_ID)) {
    document.getElementById(_MODAL_ID).classList.remove('hidden');
    return;
  }

  _injectStyles();

  const modal = document.createElement('div');
  modal.innerHTML = _buildPanelHTML().trim();
  const modalEl = modal.firstElementChild;
  document.body.appendChild(modalEl);

  const content = modalEl.querySelector('.modal-content');
  makeWindowDraggable(modalEl, {
    content,
    header:     content.querySelector('.modal-header'),
    enableDock: false,
  });

  Modals.register(_MODAL_ID, {
    railBtnId:    _RAIL_ID,
    sidebarBtnId: _SIDEBAR_ID,
    restoreFn:    () => { modalEl.classList.remove('hidden'); },
    closeFn:      closeDeckBuilder,
    label:        'Deck Builder',
  });

  _bindEvents(modalEl);
  _renderAll();
  _renderChat();

  // Load brand kit and model list async
  _loadBrandKit().then(() => { if (_state.activeTab === 'brand') _renderBrandTab(); });
  _loadModels();

  // Welcome message
  if (!_state.chatMessages.length) {
    _addChatMsg('ai', 'Hi! Drop a PDF to generate a deck, or tell me what you want to build. Try: "Create a 6-slide pitch deck about pay equity in Malaysia."');
  }
}

export function closeDeckBuilder() {
  const modal = document.getElementById(_MODAL_ID);
  if (modal) modal.remove();
  Modals.unregister(_MODAL_ID);
}

export default { open: openDeckBuilder, close: closeDeckBuilder };
