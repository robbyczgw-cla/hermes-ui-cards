// Shared look: theme variables only (light and dark come from the Desktop theme),
// a visible focus ring, container queries for narrow split views.

const ACCENT_VARS = {
  app: 'var(--ui-accent)',
  blue: 'var(--ui-blue, var(--ui-accent))',
  green: 'var(--ui-green, var(--ui-accent))',
  orange: 'var(--ui-orange, var(--ui-accent))',
  purple: 'var(--ui-purple, var(--ui-accent))',
  red: 'var(--ui-red, var(--ui-accent))'
}

// Text on an accent fill only for engines without relative colours (see huicOnColor):
// checked against the real Desktop presets, dark and light, each at least 4.8:1.
const ON_ACCENT_FALLBACK = {
  app: 'var(--dt-primary-foreground, #fff)',
  blue: '#fff',
  green: '#000',
  orange: '#000',
  purple: '#000',
  red: 'var(--dt-primary-foreground, #fff)'
}

// Black or white text for a fill, whichever contrasts more. Y in xyz-d65 is the relative
// luminance WCAG uses; at Y = 0.17913 both give the same ratio (√(1.05 · 0.05) − 0.05),
// so the winner always clears 4.58:1. invert = the other one (hover fills move away from it).
function huicOnColor(fill, invert) {
  const k = invert ? `clamp(0, (y - 0.17913) * 100000, 1)` : `clamp(0, (0.17913 - y) * 100000, 1)`
  return `color(from ${fill} xyz-d65 calc(${k} * 0.95047) ${k} calc(${k} * 1.08883) / 1)`
}
const HUIC_RELATIVE = '@supports (color: color(from red xyz-d65 x y z))'

// Shared UI strings (fragments after 20-i18n.js may extend the tables).
Object.assign(STRINGS.en, { copyResult: 'Copy result', copiedResult: 'Copied' })
Object.assign(STRINGS.de, { copyResult: 'Ergebnis kopieren', copiedResult: 'Kopiert' })

// Design tokens: --huic-accent-ink is accent-tinted text that stays readable on the light
// presets (raw purple/orange text on white is under 3:1). 4/8 spacing, three radii, one easing, hairlines from the theme strokes.
// Uppercase "eyebrow" labels echo the Desktop sidebar headings; accent rails mark state.
const CARD_CSS = `
.huic{--huic-accent:var(--ui-accent);--huic-pad:16px;--huic-line:var(--ui-stroke-tertiary);--huic-line-strong:var(--ui-stroke-secondary);--huic-on-accent:var(--huic-on-fallback,var(--dt-primary-foreground,#fff));--huic-accent-hover:color-mix(in srgb,var(--huic-accent) 86%,var(--ui-text-primary));--huic-accent-ink:color-mix(in srgb,var(--huic-accent) 50%,var(--ui-text-primary));--huic-mono:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);--huic-ease:cubic-bezier(.2,.8,.2,1);--huic-r:12px;--huic-r-md:8px;--huic-r-sm:6px;container-type:inline-size;box-sizing:border-box;width:100%;max-width:680px;margin:8px 0;border:1px solid var(--huic-line);border-radius:var(--huic-r);background:var(--ui-chat-surface-background,transparent);color:var(--ui-text-primary);font-size:13px;line-height:1.5;text-align:left;transition:border-color .4s var(--huic-ease)}
${HUIC_RELATIVE}{.huic{--huic-on-accent:${huicOnColor('var(--huic-accent)')};--huic-accent-hover:color-mix(in srgb,var(--huic-accent) 86%,${huicOnColor('var(--huic-accent)', true)})}}
.huic>:first-child{border-top-left-radius:11px;border-top-right-radius:11px}
.huic>:last-child{border-bottom-left-radius:11px;border-bottom-right-radius:11px}
.huic *{box-sizing:border-box;overflow-wrap:anywhere}
.huic-body>*{min-width:0}
.huic.huic-compact{--huic-pad:12px;font-size:12.5px}
.huic :focus-visible{outline:2px solid var(--huic-accent);outline-offset:2px}
.huic-head{padding:var(--huic-pad) var(--huic-pad) 0;display:flex;flex-direction:column;gap:2px}
.huic-title{font-weight:600;font-size:14px;line-height:20px;letter-spacing:-.005em;margin:0;color:var(--ui-text-primary)}
.huic-sub{color:var(--ui-text-tertiary);font-size:12.5px;line-height:18px;margin:0}
.huic-eyebrow{margin:0;font-size:11px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary);font-variant-numeric:tabular-nums}
.huic-body{padding:12px var(--huic-pad) var(--huic-pad);display:flex;flex-direction:column;gap:12px}
.huic-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;padding:12px var(--huic-pad);border-top:1px solid var(--huic-line)}
.huic-foot-group{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-left:auto;max-width:100%}
.huic-hint{margin-right:auto;color:var(--ui-text-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.huic .huic-kbd{display:inline-block;min-width:18px;margin:0 1px;padding:0 4px;border:1px solid var(--huic-line-strong);border-bottom-width:2px;border-radius:4px;background:color-mix(in srgb,var(--ui-bg-quaternary) 55%,transparent);color:var(--ui-text-secondary);font:inherit;font-size:10.5px;font-weight:500;line-height:14px;text-align:center;vertical-align:1px;white-space:nowrap}
.huic-opt{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;padding:10px 12px;border-radius:var(--huic-r-md);border:1px solid var(--huic-line);background:transparent;color:inherit;cursor:pointer;font:inherit;transition:background .15s,border-color .15s,transform .08s}
.huic-opt:hover:not([disabled]){background:var(--ui-row-hover-background,var(--ui-control-hover-background));border-color:var(--huic-line-strong)}
.huic-opt:active:not([disabled]){transform:scale(.995)}
.huic-opt[aria-checked="true"],.huic-opt[aria-pressed="true"]{border-color:var(--huic-accent);background:color-mix(in srgb,var(--huic-accent) 10%,transparent)}
.huic-opt[disabled]{cursor:default}
.huic-opt-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.huic-opt-label{font-weight:500}
.huic-opt-desc{color:var(--ui-text-tertiary);font-size:12px;line-height:17px}
.huic-icon{font-size:18px;line-height:1.2;flex:none}
.huic-dot{flex:none;width:16px;height:16px;margin-top:1px;border-radius:50%;border:1.5px solid var(--ui-stroke-secondary);display:grid;place-items:center;transition:background .15s,border-color .15s}
.huic-dot.huic-square{border-radius:4px}
[aria-checked="true"]>.huic-dot{border-color:var(--huic-accent);background:var(--huic-accent)}
[aria-checked="true"]>.huic-dot::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--huic-on-accent)}
[aria-checked="true"]>.huic-dot.huic-square::after{width:8px;height:4px;border-radius:0;background:none;border-left:2px solid var(--huic-on-accent);border-bottom:2px solid var(--huic-on-accent);transform:translateY(-1px) rotate(-45deg)}
.huic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.huic-img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:var(--huic-r-md);background:var(--ui-bg-quaternary)}
.huic-compact .huic-img{aspect-ratio:3/1}
.huic-input{width:100%;min-height:34px;padding:6px 10px;border-radius:var(--huic-r-md);border:1px solid var(--huic-line-strong);background:color-mix(in srgb,var(--ui-bg-quaternary) 70%,transparent);color:inherit;font:inherit;transition:border-color .15s,box-shadow .15s}
.huic-input::placeholder{color:var(--ui-text-quaternary,var(--ui-text-tertiary));opacity:1}
.huic-input:hover:not(:disabled){border-color:var(--ui-stroke-primary,var(--huic-line-strong))}
.huic .huic-input:focus-visible{outline:none;border-color:var(--huic-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--huic-accent) 22%,transparent)}
.huic-input[aria-invalid="true"]{border-color:var(--ui-red)}
.huic .huic-input[aria-invalid="true"]:focus-visible{border-color:var(--ui-red);box-shadow:0 0 0 3px color-mix(in srgb,var(--ui-red) 20%,transparent)}
.huic-input:disabled{cursor:default;opacity:.75}
textarea.huic-input{min-height:72px;resize:vertical;line-height:1.5}
.huic-field{display:flex;flex-direction:column;gap:4px}
.huic-label{font-weight:500;font-size:13px}
.huic-req{color:var(--ui-text-tertiary);font-weight:400}
.huic-help{color:var(--ui-text-tertiary);font-size:12px;line-height:17px}
.huic-err{color:var(--ui-red);font-size:12px;line-height:17px}
.huic-row{display:flex;gap:8px;align-items:center}
.huic-badge{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-size:11px;line-height:16px;font-weight:500;padding:1px 8px;border-radius:999px;background:var(--ui-bg-tertiary,var(--ui-bg-quaternary));color:var(--ui-text-secondary);white-space:nowrap}
.huic-best{background:color-mix(in srgb,var(--huic-accent) 14%,transparent);color:var(--huic-accent-ink)}
.huic-progress{height:4px;border-radius:999px;background:var(--ui-bg-tertiary,var(--ui-bg-quaternary));overflow:hidden}
.huic-progress>span{display:block;height:100%;border-radius:inherit;background:var(--huic-accent);transition:width .35s var(--huic-ease)}
.huic-code{margin:0;font-family:var(--huic-mono);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;padding:8px 10px;border-radius:var(--huic-r-md);background:var(--ui-inline-code-background,var(--ui-bg-quaternary));color:var(--ui-inline-code-foreground,inherit)}
.huic-answer{display:flex;gap:10px;align-items:center;padding:12px var(--huic-pad);border-top:1px solid var(--huic-line);background:color-mix(in srgb,var(--huic-accent) 6%,transparent);box-shadow:inset 3px 0 0 var(--huic-accent);color:var(--ui-text-primary);font-size:13px;outline:none}
.huic .huic-answer:focus-visible{outline:2px solid var(--huic-accent);outline-offset:-2px}
.huic-answer-mark{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--huic-accent);color:var(--huic-on-accent);font-size:11px;font-weight:700;line-height:1}
.huic-answer-mark svg{width:12px;height:12px;display:block}
.huic-answer-mark .huic-ico{stroke-width:2}
.huic-answer-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.huic-answer-summary{color:var(--ui-text-primary);line-height:18px}
.huic-answer>.huic-copy{flex:none}
.huic-answer.is-fresh{animation:huic-rise .32s var(--huic-ease) both}
.huic-answer.is-fresh .huic-answer-mark{animation:huic-pop .36s var(--huic-ease) both}
.huic-answer.is-fresh .huic-answer-mark path{animation:huic-draw .32s .14s var(--huic-ease) both}
.huic:has(>.huic-answer){border-color:color-mix(in srgb,var(--huic-accent) 30%,var(--huic-line))}
@keyframes huic-rise{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
@keyframes huic-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
@keyframes huic-draw{from{stroke-dasharray:16;stroke-dashoffset:16}to{stroke-dasharray:16;stroke-dashoffset:0}}
@keyframes huic-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.huic-notice{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px var(--huic-pad);border-top:1px solid var(--huic-line);background:var(--ui-bg-quinary,transparent);color:var(--ui-text-secondary);font-size:12.5px}
.huic-notice>svg{flex:none;width:16px;height:16px;color:var(--ui-text-tertiary)}
.huic-notice>span{flex:1;min-width:12em}
.huic-risk{display:inline-flex;gap:6px;align-items:baseline;font-size:12.5px}
.huic-risk-low{color:var(--ui-green,var(--ui-text-secondary))}
.huic-risk-medium{color:var(--ui-orange,var(--ui-yellow,var(--ui-text-secondary)))}
.huic-risk-high{color:var(--ui-red,var(--ui-text-primary))}
.huic-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.huic-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;border:0;border-radius:var(--huic-r-md);padding:6px 14px;font:inherit;font-size:13px;font-weight:500;line-height:18px;cursor:pointer;color:var(--ui-text-primary);background:var(--ui-bg-tertiary,var(--ui-bg-quaternary));box-shadow:inset 0 0 0 1px var(--huic-line);transition:background .15s,box-shadow .15s,color .15s,transform .08s}
.huic-btn:hover:not([disabled]){background:var(--ui-bg-secondary,var(--ui-control-hover-background))}
.huic-btn:active:not([disabled]){transform:translateY(1px)}
.huic-btn-primary{background:var(--huic-accent);color:var(--huic-on-accent);box-shadow:none}
.huic-btn-primary:hover:not([disabled]){background:var(--huic-accent-hover)}
.huic-btn-ghost{background:transparent;box-shadow:none;color:var(--ui-text-secondary)}
.huic-btn-ghost:hover:not([disabled]){background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.huic-btn-danger{background:color-mix(in srgb,var(--ui-red) 16%,transparent);color:var(--ui-red);box-shadow:none}
.huic-btn[disabled]{opacity:.5;cursor:default}
.huic-btn-primary[disabled]{opacity:1;background:var(--ui-bg-quaternary);color:var(--ui-text-quaternary,var(--ui-text-tertiary))}
@container (max-width: 440px){
  .huic-grid{grid-template-columns:1fr}
  .huic-hint{flex:1 1 9em;min-width:0}
  .huic .huic-copy-text{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .huic .huic-keys,.huic .huic-keys-sep{display:none}
}
/* keyboard hints help only with a keyboard: gone on touch screens and in narrow views */
@media (hover: none) and (pointer: coarse){.huic .huic-keys,.huic .huic-keys-sep{display:none}}
/* one line-icon style for chrome (check, cross, pencil, question, picture) */
.huic-ico{display:block;flex:none;width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
/* code + key-values */
.huic .huic-code-block{position:relative;min-width:0;border-radius:var(--huic-r-md);background:var(--ui-inline-code-background,var(--ui-bg-quaternary));box-shadow:inset 0 0 0 1px var(--ui-stroke-quaternary,transparent)}
.huic .huic-code-block .huic-code{position:relative;padding:10px 44px 10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:transparent;line-height:1.6}
.huic .huic-code-block[data-prompt] .huic-code{padding-left:28px}
.huic .huic-code-block[data-prompt] .huic-code::before{content:"$";position:absolute;left:12px;top:10px;color:var(--ui-text-quaternary,var(--ui-text-tertiary));user-select:none;pointer-events:none}
.huic .huic-copy{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:28px;min-height:28px;padding:4px 6px;border:1px solid transparent;border-radius:var(--huic-r-sm);background:transparent;color:var(--ui-text-tertiary);cursor:pointer;font:inherit;font-size:12px;line-height:1;transition:color .15s,background .15s,border-color .15s}
.huic .huic-copy:hover{color:var(--ui-text-primary);background:var(--ui-control-hover-background);border-color:var(--huic-line)}
.huic .huic-copy svg{width:14px;height:14px;flex:none}
.huic .huic-code-block>.huic-copy{position:absolute;right:6px;top:6px}
.huic .huic-copy[data-copied="true"]{color:var(--ui-green,var(--ui-text-primary))}
.huic .huic-copy[data-copied="true"] svg{animation:huic-pop .25s var(--huic-ease) both}
.huic .huic-kv dd{font-variant-numeric:tabular-nums}
.huic .huic-kv-value{display:flex;align-items:center;gap:6px;min-width:0}
.huic .huic-kv-value>span{min-width:0;flex:1}
.huic .huic-kv-value>.huic-copy{flex:none}
.huic .huic-kv-path{font-family:var(--huic-mono);font-size:12px;line-height:1.55;word-break:break-all;overflow-wrap:anywhere}
.huic .huic-kv-value:has(.huic-kv-path){align-items:flex-start}
@media (prefers-reduced-motion: reduce){.huic,.huic *,.huic *::before,.huic *::after{transition:none !important;animation:none !important}}
`

function Style() {
  return jsx('style', { children: CARD_CSS })
}

function limitText(value, max) { return [...value].slice(0, max).join('') }

function cx(...names) {
  return names.filter(Boolean).join(' ')
}

// Buttons use our own styles so the accent setting applies and nothing depends on
// app class names (Tailwind classes only exist for what the app itself uses).
function Btn({ variant = 'secondary', onClick, disabled, children, label, type = 'button', autoFocus, ref, className }) {
  return jsx('button', {
    type,
    className: cx('huic-btn', variant !== 'secondary' && `huic-btn-${variant}`, className),
    onClick,
    disabled,
    autoFocus,
    ref,
    'aria-label': label,
    children
  })
}

function CardImage({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return jsx('img', {
    className: 'huic-img',
    src,
    alt: '',
    loading: 'lazy',
    referrerPolicy: 'no-referrer',
    onError: () => setFailed(true)
  })
}

function Shell({ card, display, title, subtitle, children, footer, after, labelId }) {
  const preset = display && Object.hasOwn(ACCENT_VARS, display.accent) ? display.accent : 'app'
  return jsxs('section', {
    className: cx('huic', display && display.compact && 'huic-compact'),
    style: { '--huic-accent': ACCENT_VARS[preset], '--huic-on-fallback': ON_ACCENT_FALLBACK[preset] },
    'aria-labelledby': title ? labelId : undefined,
    'aria-label': title ? undefined : card.type,
    'data-card-type': card.type,
    // The card's own language (when the model gave one) lets narrow columns hyphenate long words
    // (German compounds) instead of breaking them anywhere.
    lang: typeof card.lang === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(card.lang) ? card.lang : undefined,
    children: [
      jsx(Style, {}),
      title || subtitle
        ? jsxs('header', {
            className: 'huic-head',
            children: [
              title ? jsx('h3', { className: 'huic-title', id: labelId, style: { margin: 0 }, children: title }) : null,
              subtitle ? jsx('p', { className: 'huic-sub', style: { margin: '2px 0 0' }, children: subtitle }) : null
            ]
          })
        : null,
      // Static child lists (no keys needed): cards pass a fixed array of parts.
      Array.isArray(children) ? jsxs('div', { className: 'huic-body', children }) : jsx('div', { className: 'huic-body', children }),
      footer || null,
      after || null
    ]
  })
}

// Keyboard hints: "[Enter] to send" draws Enter as a key cap. CSS hides them where no keyboard
// is likely (touch screens, narrow views); a hint for everyone goes in Footer's `hint` instead.
function KeyHint({ text, as = 'span', className, id }) {
  const parts = String(text).split(/\[([^\]]+)\]/)
  return jsxs(as, {
    className: cx('huic-keys', className), id,
    children: parts.map((part, i) => (i % 2 ? jsx('kbd', { className: 'huic-kbd', children: part }, i) : part))
  })
}

// hint: for everyone (counts, what's missing); keys: keyboard shortcuts, see KeyHint.
function Footer({ hint, keys, children }) {
  const keyHint = keys ? jsx(KeyHint, { text: keys }) : null
  return jsxs('div', {
    className: 'huic-foot',
    children: [
      hint || keyHint
        ? jsxs('span', { className: 'huic-hint', children: [
            hint || null,
            hint && keyHint ? jsx('span', { className: 'huic-keys-sep', 'aria-hidden': true, children: ' · ' }) : null,
            keyHint
          ] })
        : null,
      children
    ]
  })
}

const CHECK_PATH = 'm3.5 8.5 3 3 6-7'

// Line icons on a 16 px grid, drawn with currentColor (the same stroke as the copy and notice icons).
const ICON_PATHS = {
  check: [CHECK_PATH],
  cross: ['m4.5 4.5 7 7M11.5 4.5l-7 7'],
  pencil: ['M10.5 3.2 12.8 5.5 6 12.3l-3 .7.7-3z', 'M9.2 4.5l2.3 2.3'],
  question: ['M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3v.4', 'M8 11.6v.1'],
  help: ['M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5z', 'M6.5 6.4a1.55 1.55 0 1 1 2.2 1.4c-.45.22-.7.55-.7 1v.3', 'M8 11.1v.1'],
  alert: ['M8 2.5 14 13H2z', 'M8 6.5v3', 'M8 11.2v.1'],
  picture: ['M2.75 3.75h10.5v8.5H2.75z', 'm2.75 10.5 3-3 2.5 2.5 1.75-1.75 3.25 3', 'M10.25 6.25v.01'],
  undo: ['M5.5 4.5 3 7l2.5 2.5', 'M3 7h6.5a3 3 0 0 1 0 6H7']
}
function Icon({ name, className }) {
  return jsx('svg', {
    className: cx('huic-ico', className), viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false',
    children: ICON_PATHS[name].map((d, i) => jsx('path', { d }, i))
  })
}

// Reply marks drawn in the same line style as the check (no emoji next to line icons).
const MARK_ICONS = { '✗': 'cross', '✎': 'pencil', '⚠': 'alert' }

// The answered state reads like a receipt: accent rail, the mark, what was sent, and a copy action.
function AnsweredBar({ lang, record, focus }) {
  const ref = useRef(null)
  useEffect(() => { if (focus) ref.current?.focus() }, [focus])
  const mark = record.mark || '✓'
  return jsxs('div', {
    className: cx('huic-answer', focus && 'is-fresh'),
    role: 'status', ref, tabIndex: -1,
    children: [
      jsx('span', {
        className: 'huic-answer-mark', 'aria-hidden': true,
        children: mark === '✓'
          ? jsx('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, children: jsx('path', { d: CHECK_PATH, strokeLinecap: 'round', strokeLinejoin: 'round' }) })
          : MARK_ICONS[mark] ? jsx(Icon, { name: MARK_ICONS[mark] }) : mark
      }),
      jsxs('span', {
        className: 'huic-answer-text',
        children: [
          jsxs('span', { className: 'huic-eyebrow', children: [t(lang, 'answered'), jsx('span', { className: 'huic-sr', children: ': ' })] }),
          jsx('span', { className: 'huic-answer-summary', children: record.summary })
        ]
      }),
      record.summary ? jsx(CopyButton, { text: record.summary, lang, label: t(lang, 'copyResult'), doneLabel: t(lang, 'copiedResult'), showLabel: true }) : null
    ]
  })
}

// The undo window counts down where people can see it. Screen readers hear the start value once
// (the bar is a polite live region; a per-second update would interrupt them every second).
function Countdown({ ms, say }) {
  const total = Math.max(1, Math.round(ms / 1000))
  // Mounted when the undo window opens, so this deadline matches the send timer. The shown value is
  // worked out from the clock on every render: a busy main thread or a throttled tab can delay the
  // timeouts, and the bar must never promise more time than is left.
  const deadline = useRef(0)
  if (!deadline.current) deadline.current = Date.now() + ms
  const [, setTick] = useState(0)
  const rest = deadline.current - Date.now()
  const left = Math.min(total, Math.max(1, Math.ceil(rest / 1000)))
  useEffect(() => {
    if (left <= 1) return
    const id = setTimeout(() => setTick(n => n + 1), rest % 1000 || 1000)
    return () => clearTimeout(id)
  })
  return jsxs(Fragment, { children: [
    jsx('span', { className: 'huic-sr', children: say(total) }),
    jsx('span', { className: 'huic-countdown', 'aria-hidden': true, children: say(left) })
  ] })
}

function NoticeBar({ text, action }) {
  return jsxs('div', {
    className: 'huic-notice',
    role: 'status',
    children: [
      jsxs('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true, children: [
        jsx('circle', { cx: 8, cy: 8, r: 6.25 }),
        jsx('path', { d: 'M8 7.25v3.5M8 5.1v.1', strokeLinecap: 'round' })
      ] }),
      jsx('span', { children: text }),
      action || null
    ]
  })
}

function CopyButton({ text, lang, label: idleLabel, doneLabel, showLabel }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => {
    setCopied(false)
    return () => clearTimeout(timer.current)
  }, [text])
  const copy = async () => {
    let ok = false
    try {
      if (pluginCtx && pluginCtx.os && typeof pluginCtx.os.writeClipboard === 'function') {
        ok = await pluginCtx.os.writeClipboard(text)
      }
    } catch {
      ok = false
    }
    if (ok) {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    }
  }
  const label = copied ? doneLabel || t(lang, 'copied') : idleLabel || t(lang, 'copy')
  return jsxs('button', {
    type: 'button', className: 'huic-copy', onClick: copy,
    'aria-label': label, title: label, 'data-copied': copied,
    children: [
      jsx('svg', {
        viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
        'aria-hidden': true,
        children: copied
          ? jsx('path', { d: CHECK_PATH, strokeLinecap: 'round', strokeLinejoin: 'round' })
          : jsxs(Fragment, { children: [
              jsx('rect', { x: 5, y: 5, width: 8, height: 9, rx: 1.5 }),
              jsx('path', { d: 'M10 3V2H2v9h1', strokeLinecap: 'round', strokeLinejoin: 'round' })
            ] })
      }),
      jsx('span', { className: showLabel ? 'huic-copy-text' : copied ? undefined : 'huic-sr', children: label })
    ]
  })
}

// Absolute paths are shown in full (wrapped, monospace): the exact target of a destructive
// action must never be hidden behind an ellipsis.
// Label/value pairs. The app's Markdown styles reach dl/dt/dd inside messages, so the
// layout-critical properties are inline; each pair is one flex row (dl > div > dt + dd).
const KV_ROW = { display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderTop: '1px solid var(--ui-stroke-tertiary)' }
const KV_DT = { margin: 0, padding: 0, float: 'none', fontWeight: 400, color: 'var(--ui-text-tertiary)', flex: 'none', maxWidth: '50%' }
const KV_DD = { margin: 0, padding: 0, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }

function KeyValues({ rows, lang }) {
  return jsx('dl', {
    className: 'huic-kv',
    style: { margin: 0, padding: 0, display: 'block', alignSelf: 'stretch', width: '100%' },
    children: rows.map((row, i) => {
      const value = String(row.value ?? '')
      const stacked = [...value].length > 40
      const path = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(value)
      return jsxs('div', {
        className: stacked ? 'huic-kv-stacked' : undefined,
        style: { ...KV_ROW, ...(stacked ? { flexDirection: 'column', alignItems: 'stretch', gap: 2, padding: '8px 0' } : {}) },
        children: [
          jsx('dt', { style: { ...KV_DT, ...(stacked ? { maxWidth: '100%' } : {}) }, children: row.label }),
          jsx('dd', {
            style: { ...KV_DD, ...(stacked ? { textAlign: 'left' } : {}) },
            children: path ? jsxs('span', {
              className: 'huic-kv-value',
              children: [
                jsx('span', { className: 'huic-kv-path', children: value }),
                jsx(CopyButton, { text: value, lang })
              ]
            }) : value
          })
        ]
      }, i)
    })
  })
}

// prompt: shell commands get a "$" gutter (CSS only, so copy and selection stay exact).
function CodeBlock({ code, lang, prompt }) {
  return jsxs('div', {
    className: 'huic-code-block',
    'data-prompt': prompt ? '' : undefined,
    children: [
      jsx('pre', { className: 'huic-code', children: jsx('code', { children: code }) }),
      jsx(CopyButton, { text: code, lang })
    ]
  })
}
