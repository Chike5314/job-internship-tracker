#!/usr/bin/env node
/**
 * Generates src/styles/tokens.css from docs/brand/tokens.json.
 *
 * The token file already has the paper/ink split baked in as its organising
 * structure, so this script emits every token once: plain values and
 * cross-references in :root, and each side of a theme-split token under
 * [data-theme="paper"] / [data-theme="ink"].
 *
 * A reference like "{verm-500}" is never resolved to a literal here. It is
 * rewritten to a var() reference instead, so a token that aliases a
 * theme-split token (state-active-bg -> active-wash, which is itself
 * {paper, ink}) resolves correctly in both themes with no special casing.
 *
 * The output is committed. A clean checkout builds with no dependency on
 * script order, and a token change shows up as a reviewable diff.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tokensPath = resolve(here, '../../docs/brand/tokens.json')
const outPath = resolve(here, '../src/styles/tokens.css')

const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))

const ALIAS = /^\{([\w-]+)\}$/

/** "{verm-500}" -> "var(--color-verm-500)". Anything else passes through. */
function resolveValue(prefix, value) {
  const match = ALIAS.exec(value)
  return match ? `var(--${prefix}-${match[1]})` : value
}

/**
 * Emits one token that may be a plain string, an alias string, or a
 * {paper, ink} object, into the right one of three line buffers.
 */
function emitToken(prefix, name, value, root, paper, ink) {
  const varName = `--${prefix}-${name}`
  if (typeof value === 'string') {
    root.push(`  ${varName}: ${resolveValue(prefix, value)};`)
  } else {
    paper.push(`  ${varName}: ${resolveValue(prefix, value.paper)};`)
    ink.push(`  ${varName}: ${resolveValue(prefix, value.ink)};`)
  }
}

const root = []
const paper = []
const ink = []

// ---- Color -----------------------------------------------------------
root.push('  /* Color */')
for (const token of tokens.color.tokens) {
  emitToken('color', token.name, token.value, root, paper, ink)
}

// ---- Type --------------------------------------------------------------
root.push('', '  /* Type: families */')
for (const [key, stack] of Object.entries(tokens.type.families)) {
  root.push(`  --font-${key}: ${stack};`)
}

root.push('', '  /* Type: styles */')
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    const familyKey = style.family ?? group.family
    const base = `--type-${style.name}`
    root.push(
      `  ${base}-family: var(--font-${familyKey});`,
      `  ${base}-size: ${style.fontSize};`,
      `  ${base}-line: ${style.lineHeight};`,
      `  ${base}-weight: ${style.fontWeight};`,
      `  ${base}-spacing: ${style.letterSpacing ?? 'normal'};`,
      `  ${base}-style: ${style.fontStyle ?? 'normal'};`,
    )
  }
}

// ---- Spacing / radius / blur / opacity (always plain, never themed) ----
for (const [section, prefix] of [
  ['spacing', 'space'],
  ['radius', 'radius'],
  ['blur', 'blur'],
  ['opacity', 'opacity'],
]) {
  root.push('', `  /* ${section[0].toUpperCase()}${section.slice(1)} */`)
  for (const token of tokens[section].tokens) {
    emitToken(prefix, token.name.replace(`${prefix}-`, ''), token.value, root, paper, ink)
  }
}

// ---- Shadow (can be themed, e.g. shadow-soft-sm differs paper vs ink) ---
root.push('', '  /* Shadow */')
paper.push('  /* Shadow */')
ink.push('  /* Shadow */')
for (const token of tokens.shadow.tokens) {
  emitToken('shadow', token.name.replace('shadow-', ''), token.value, root, paper, ink)
}

const banner = `/* Generated from docs/brand/tokens.json v${tokens.version} by scripts/build-tokens.mjs. Do not edit by hand. */`

const css = `${banner}
:root {
${root.join('\n')}
}

[data-theme='paper'] {
${paper.join('\n')}
}

[data-theme='ink'] {
${ink.join('\n')}
}
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, css, 'utf-8')
console.log(`wrote ${outPath}`)
