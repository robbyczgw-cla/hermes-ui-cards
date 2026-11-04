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

const CARD_CSS = `
.huic{--huic-accent:var(--ui-accent);--huic-pad:14px;container-type:inline-size;box-sizing:border-box;width:100%;max-width:680px;margin:6px 0;border:1px solid var(--ui-stroke-tertiary);border-radius:12px;background:var(--ui-chat-surface-background,transparent);color:var(--ui-text-primary);font-size:13px;line-height:1.45;overflow:hidden;text-align:left}
.huic *{box-sizing:border-box}
.huic.huic-compact{--huic-pad:10px;font-size:12.5px}
.huic :focus-visible{outline:2px solid var(--huic-accent);outline-offset:2px}
.huic-head{padding:var(--huic-pad) var(--huic-pad) 2px}
.huic-title{font-weight:600;font-size:14px;margin:0}
.huic-sub{color:var(--ui-text-tertiary);font-size:12px;margin:2px 0 0}
.huic-body{padding:8px var(--huic-pad) var(--huic-pad);display:flex;flex-direction:column;gap:8px}
.huic-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;padding:10px var(--huic-pad);border-top:1px solid var(--ui-stroke-tertiary)}
.huic-hint{margin-right:auto;color:var(--ui-text-tertiary);font-size:12px}
.huic-opt{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;padding:9px 11px;border-radius:9px;border:1px solid var(--ui-stroke-tertiary);background:transparent;color:inherit;cursor:pointer;font:inherit;transition:background .12s,border-color .12s}
.huic-opt:hover:not([disabled]){background:var(--ui-control-hover-background)}
.huic-opt[aria-checked="true"],.huic-opt[aria-pressed="true"]{border-color:var(--huic-accent);background:color-mix(in srgb,var(--huic-accent) 10%,transparent)}
.huic-opt[disabled]{cursor:default}
.huic-opt-text{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.huic-opt-label{font-weight:500}
.huic-opt-desc{color:var(--ui-text-tertiary);font-size:12px}
.huic-icon{font-size:18px;line-height:1.2;flex:none}
.huic-dot{flex:none;width:16px;height:16px;margin-top:1px;border-radius:50%;border:1.5px solid var(--ui-stroke-secondary);display:grid;place-items:center}
.huic-dot.huic-square{border-radius:4px}
[aria-checked="true"]>.huic-dot{border-color:var(--huic-accent);background:var(--huic-accent)}
[aria-checked="true"]>.huic-dot::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--ui-chat-surface-background,var(--ui-base,currentColor))}
[aria-checked="true"]>.huic-dot.huic-square::after{width:8px;height:4px;border-radius:0;background:none;border-left:2px solid var(--ui-chat-surface-background,var(--ui-base,currentColor));border-bottom:2px solid var(--ui-chat-surface-background,var(--ui-base,currentColor));transform:translateY(-1px) rotate(-45deg)}
.huic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.huic-img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:7px;background:var(--ui-bg-quaternary)}
.huic-compact .huic-img{aspect-ratio:3/1}
.huic-input{width:100%;padding:6px 8px;border-radius:7px;border:1px solid var(--ui-stroke-secondary);background:transparent;color:inherit;font:inherit}
.huic-input:focus-visible{outline-offset:0}
.huic-input[aria-invalid="true"]{border-color:var(--ui-red)}
textarea.huic-input{min-height:64px;resize:vertical}
.huic-field{display:flex;flex-direction:column;gap:3px}
.huic-label{font-weight:500;font-size:12.5px}
.huic-req{color:var(--ui-text-tertiary);font-weight:400}
.huic-help{color:var(--ui-text-tertiary);font-size:12px}
.huic-err{color:var(--ui-red);font-size:12px}
.huic-row{display:flex;gap:8px;align-items:center}
.huic-badge{display:inline-block;font-size:11px;line-height:16px;padding:1px 7px;border-radius:999px;background:var(--ui-bg-quaternary);color:var(--ui-text-secondary);white-space:nowrap}
.huic-best{background:color-mix(in srgb,var(--huic-accent) 16%,transparent);color:var(--huic-accent)}
.huic-progress{height:4px;border-radius:2px;background:var(--ui-bg-quaternary);overflow:hidden}
.huic-progress>span{display:block;height:100%;background:var(--huic-accent);transition:width .2s}
.huic-code{margin:0;font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;white-space:pre-wrap;word-break:break-word;padding:8px 10px;border-radius:7px;background:var(--ui-inline-code-background,var(--ui-bg-quaternary));color:var(--ui-inline-code-foreground,inherit)}
.huic-answer{display:flex;gap:8px;align-items:flex-start;padding:10px var(--huic-pad);border-top:1px solid var(--ui-stroke-tertiary);background:color-mix(in srgb,var(--huic-accent) 6%,transparent);color:var(--ui-text-secondary);font-size:12.5px}
.huic-answer b{color:var(--ui-text-primary);font-weight:600}
.huic-notice{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px var(--huic-pad);border-top:1px solid var(--ui-stroke-tertiary);color:var(--ui-text-secondary);font-size:12.5px}
.huic-risk{display:inline-flex;gap:6px;align-items:baseline;font-size:12.5px}
.huic-risk-low{color:var(--ui-green,var(--ui-text-secondary))}
.huic-risk-medium{color:var(--ui-orange,var(--ui-yellow,var(--ui-text-secondary)))}
.huic-risk-high{color:var(--ui-red,var(--ui-text-primary))}
.huic-kv{display:grid;grid-template-columns:minmax(80px,max-content) 1fr;gap:3px 12px;margin:0}
.huic-kv dt{color:var(--ui-text-tertiary)}
.huic-kv dd{margin:0}
.huic-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.huic-btn{appearance:none;border:0;border-radius:7px;padding:5px 12px;font:inherit;font-weight:500;cursor:pointer;color:var(--ui-text-primary);background:var(--ui-bg-quaternary)}
.huic-btn:hover:not([disabled]){background:var(--ui-control-hover-background)}
.huic-btn-primary{background:var(--huic-accent);color:var(--ui-chat-surface-background,var(--ui-base))}
.huic-btn-primary:hover:not([disabled]){background:color-mix(in srgb,var(--huic-accent) 88%,var(--ui-text-primary))}
.huic-btn-ghost{background:transparent;color:var(--ui-text-secondary)}
.huic-btn-danger{background:color-mix(in srgb,var(--ui-red) 16%,transparent);color:var(--ui-red)}
.huic-btn[disabled]{opacity:.5;cursor:default}
@container (max-width: 440px){
  .huic-grid{grid-template-columns:1fr}
  .huic-foot{justify-content:stretch}
  .huic-foot>.huic-btn,.huic-foot>button{flex:1}
  .huic-hint{flex-basis:100%}
  .huic-kv{grid-template-columns:1fr}
}
@media (prefers-reduced-motion: reduce){.huic *{transition:none !important}}
`

function Style() {
  return jsx('style', { children: CARD_CSS })
}

function cx(...names) {
  return names.filter(Boolean).join(' ')
}

// Buttons use our own styles so the accent setting applies and nothing depends on
// app class names (Tailwind classes only exist for what the app itself uses).
function Btn({ variant = 'secondary', onClick, disabled, children, label, type = 'button', autoFocus }) {
  return jsx('button', {
    type,
    className: cx('huic-btn', variant !== 'secondary' && `huic-btn-${variant}`),
    onClick,
    disabled,
    autoFocus,
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
  const accent = ACCENT_VARS[(display && display.accent) || 'app'] || ACCENT_VARS.app
  return jsxs('section', {
    className: cx('huic', display && display.compact && 'huic-compact'),
    style: { '--huic-accent': accent },
    'aria-labelledby': title ? labelId : undefined,
    'aria-label': title ? undefined : card.type,
    'data-card-type': card.type,
    children: [
      jsx(Style, {}),
      title || subtitle
        ? jsxs('header', {
            className: 'huic-head',
            children: [
              title ? jsx('h3', { className: 'huic-title', id: labelId, children: title }) : null,
              subtitle ? jsx('p', { className: 'huic-sub', children: subtitle }) : null
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

function Footer({ hint, children }) {
  return jsxs('div', {
    className: 'huic-foot',
    children: [hint ? jsx('span', { className: 'huic-hint', children: hint }) : null, children]
  })
}

function AnsweredBar({ lang, record }) {
  return jsxs('div', {
    className: 'huic-answer',
    role: 'status',
    children: [
      jsx('span', { 'aria-hidden': true, children: record.mark || '✓' }),
      jsxs('span', {
        children: [jsx('b', { children: t(lang, 'answered') + ': ' }), record.summary]
      })
    ]
  })
}

function NoticeBar({ text, action }) {
  return jsxs('div', {
    className: 'huic-notice',
    role: 'status',
    children: [jsx('span', { children: text }), action || null]
  })
}

function CopyButton({ text, lang }) {
  const [copied, setCopied] = useState(false)
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
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return jsx(Btn, { variant: 'ghost', onClick: copy, children: copied ? t(lang, 'copied') : t(lang, 'copy') })
}

function CodeBlock({ code, lang }) {
  return jsxs('div', {
    className: 'huic-row',
    style: { alignItems: 'flex-start' },
    children: [
      jsx('pre', { className: 'huic-code', style: { flex: 1 }, children: code }),
      jsx(CopyButton, { text: code, lang })
    ]
  })
}
