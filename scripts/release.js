#!/usr/bin/env node

import fs from 'node:fs'

fs.mkdirSync('pkg', { recursive: true })

const packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf-8'))

for (const runtime of ['bun', 'node']) {
  const demo = `pkg/${runtime}-demo`

  if (fs.existsSync(demo)) fs.rmSync(demo, { recursive: true })
  fs.mkdirSync(demo, { recursive: true })

  for (const file of packageInfo.files) {
    if (runtime === 'bun' && file === 'README.md') {
      const contents = fs.readFileSync(file, 'utf-8')
        .replace('vanilla-candy-sprinkles', 'ciabatta')
        .replace('`--esm` - use imports (es6) instead of require (cjs)',
                 '`--cjs` - use require (cjs) instead of imports (es6)')
        .replace(/node-demo/g, 'bun-demo')
        .replace(/Node(\.js)?/g, 'Bun')
        .replace(/npx/g, 'bunx')
        .replace(/npm install/g, 'bun add')
        .replace('--yes ', '')
        .replace('--save-dev', '--dev')
        .replace(/^## Packaging alternatives:\s+.*?\n\s*\n/ms, '')
        .replace(/^\* Switching packaging managers.*?\n\s*\n/ms, '')
      fs.writeFileSync(`${demo}/${file}`, contents)
    } else if (runtime === 'bun' && file === 'package.json') {
      const contents = fs.readFileSync(file, 'utf-8')
        .replace(/"node": ">=[\d.]+"/, '"bun": ">=1.0.0"')
        .replace(/node/g, 'bun')
        .replace(/Node(\.js)?/g, 'Bun')
        .replace('/fly-apps/bun-demo', '/fly-apps/node-demo')
      fs.writeFileSync(`${demo}/${file}`, contents)
    } else if (runtime === 'bun' && file === 'index.js') {
      const contents = fs.readFileSync(file, 'utf-8')
        .replace('node', 'bun')
      fs.writeFileSync(`${demo}/${file}`, contents)
    } else {
      fs.cpSync(file, `${demo}/${file}`, { recursive: true })
    }
  }
}
