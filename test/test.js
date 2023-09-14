import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

import { expect } from 'chai'

const tests = JSON.parse(fs.readFileSync('test/test.json'), 'utf-8')

const rootdir = process.cwd()
const democmd = path.join(rootdir, 'index.js')

process.env.NODE_ENV = 'test'

for (const group of ['node', 'bun']) {
  for (const [test, options] of Object.entries(tests)) {
    describe(`${group}: ${test}`, function() {
      const workdir = path.join(os.tmpdir(), group, test)
      const testdir = path.join('test/results', group, test)

      if (fs.existsSync(workdir)) fs.rmSync(workdir, { recursive: true })
      fs.mkdirSync(testdir, { recursive: true })
      fs.mkdirSync(workdir, { recursive: true })

      const cmd = [
        process.execPath,
        democmd,
        options + (group === 'bun' ? ' --bun' : '')
      ]

      console.log(`node-demo ${cmd[2]}`)
      execSync(cmd.join(' '), { cwd: workdir, stdio: 'inherit' })

      const outputs = fs.readdirSync(workdir, { recursive: true })
      for (const file of fs.readdirSync(testdir, { recursive: true })) {
        if (!outputs.includes(file) && !fs.lstatSync(path.join(testdir, file)).isDirectory()) {
          outputs.push(file)
        }
      }

      for (const output of outputs) {
        if (fs.lstatSync(path.join(workdir, output)).isDirectory()) {
          fs.mkdirSync(path.join(testdir, output), { recursive: true })
          continue
        }

        it(`should produce ${output}`, async function() {
          if (fs.existsSync(path.join(workdir, output))) {
            const actualResults = fs.readFileSync(path.join(workdir, output), 'utf-8')

            if (process.env.TEST_CAPTURE) {
              fs.writeFileSync(path.join(testdir, output), actualResults)
            }

            const expectedResults = fs.readFileSync(path.join(testdir, output), 'utf-8')

            expect(expectedResults).to.equal(actualResults)
          } else {
            if (process.env.TEST_CAPTURE) {
              fs.rmSync(path.join(testdir, output))
            } else {
              const expectedResults = fs.readFileSync(path.join(testdir, output), 'utf-8')
              expect(expectedResults).to.equal('')
            }
          }
        })
      }
    })
  }
}
