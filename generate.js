#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import url from 'node:url'
import path from 'node:path'
import { execSync } from 'node:child_process'

import * as ejs from 'ejs'
import chalk from 'chalk'
import * as Diff from 'diff'
import * as readline from 'node:readline'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

// Generate Dockerfile class
export class DemoGenerator {
  static templates = path.join(__dirname, 'templates')

  // Where the app will be placed.
  #appdir

  // previous answer to conflict prompt
  #answer = ''

  get dependencies() {
    const list = []

    if (this.options.ejs) list.push('ejs')
    if (this.options.postgres) list.push('pg')
    if (this.options.mongodb) list.push('mongodb')
    if (this.options.redis) list.push('redis')
    if (this.options.prisma) list.push('@prisma/client', 'prisma')
    if (this.options.drizzle) list.push('drizzle-orm', 'drizzle-kit')
    if (this.options.knex) list.push('knex')

    if (this.options.sqlite3) {
      if (this.options.drizzle) {
        list.push('better-sqlite3')
      } else {
        list.push('sqlite3')
      }
    }

    if (this.options.express) {
      list.push('express')
      if (this.options.ws) list.push('express-ws')
      if (this.options.mustache) list.push('mustache-express')
    } else {
      if (this.options.ws) list.push('ws')
      if (this.options.mustache) list.push('mustache')
    }

    return list
  }

  get devDependencies() {
    const list = []

    if (this.options.typescript) {
      list.push('@types/node', 'typescript')

      if (this.options.postgres && (!this.orm || this.options.drizzle)) {
        list.push('@types/pg')
      }

      if (this.options.mustache) list.push('@types/mustache')

      if (this.options.sqlite3 && this.options.drizzle) {
        list.push('@types/better-sqlite3')
      }

      if (this.options.express) {
        list.push('@types/express')
        if (this.options.ws) list.push('@types/express-ws')
      } else {
        if (this.options.ejs) list.push('@types/ejs')
        if (this.options.ws) list.push('@types/ws')
      }
    }

    if (this.options.tailwindcss) list.push('tailwindcss')

    return list
  }

  get build() {
    const steps = []

    if (this.options.typescript) steps.push('tsc')

    if (this.options.tailwindcss) {
      steps.push('tailwindcss -i src/input.css -o public/index.css')
    }

    if (this.options.prisma) {
      steps.unshift('prisma generate')
    }

    if (this.options.drizzle) {
      steps.push(`drizzle-kit generate:${this.options.sqlite3 ? 'sqlite' : 'pg'} --out src/db/migrations --schema src/db/schema.ts`)
    }

    return steps.length ? steps.join(' && ') : undefined
  }

  get count() {
    if (this.options.mustache) {
      return '{{ count }}'
    } else if (this.options.ejs) {
      return '<%= count %>'
    } else {
      return '@@COUNT@@'
    }
  }

  get orm() {
    if (this.options.prisma || this.options.knex || this.options.drizzle) {
      return true
    } else {
      return false
    }
  }

  get templateExtension() {
    if (this.options.ejs) return 'ejs'
    if (this.options.mustache) return 'mustache'
    return 'tmpl'
  }

  get start() {
    if (this.options.typescript) {
      return 'node build/server.js'
    } else {
      return 'node server.js'
    }
  }

  get imports() {
    const list = {}

    if (this.options.prisma) {
      list['{ PrismaClient }'] = '@prisma/client'
      list['{ execSync }'] = 'node:child_process'
    } else if (this.options.drizzle) {
      list.schema = './db/schema'

      if (this.options.sqlite3) {
        list['{ drizzle }'] = 'drizzle-orm/better-sqlite3'
        list.Database = 'better-sqlite3'
        list['{ migrate }'] = 'drizzle-orm/better-sqlite3/migrator'
      } else {
        list['{ drizzle }'] = 'drizzle-orm/node-postgres'
        list['{ Pool }'] = 'pg'
        list['{ migrate }'] = 'drizzle-orm/node-postgres/migrator'
      }
    } else if (this.options.knex) {
      if (this.options.typescript) {
        list['{ knex }'] = 'knex'
      } else {
        list.knex = 'knex'
      }
    } else if (this.options.mongodb) {
      list.mongodb = 'mongodb'
    } else if (this.options.postgres) {
      list.pg = 'pg'
    } else if (this.options.sqlite3) {
      list.sqlite3 = 'sqlite3'
    } else {
      list.fs = 'node:fs'
    }

    if (this.options.redis) list.redis = 'redis'

    if (this.options.sqlite3) list.url = 'node:url'

    if (this.options.express) {
      list.express = 'express'
      if (this.options.ws) list.expressWs = 'express-ws'
      if (!this.options.ejs) list.fs = 'node:fs'
      if (this.options.mustache) list.mustacheExpress = 'mustache-express'
    } else {
      list.http = 'node:http'
      list.url = 'node:url'
      list.fs = 'node:fs'
      if (this.options.ejs) list.ejs = 'ejs'
      if (this.options.mustache) list.mustache = 'mustache'
      if (this.options.ws) list['{ WebSocketServer }'] = 'ws'
    }

    return Object.fromEntries(Object.entries(list).sort((a, b) => {
      return a[0].localeCompare(b[0])
    }))
  }

  // render each template and write to the destination dir
  async run(appdir, options = {}) {
    this.options = options
    this.#appdir = appdir

    if (options.force) this.#answer = 'a'

    if (options.redis) options.ws = true

    if (options.drizzle) options.typescript = options.ts = true

    if (options.postgres) options.sqlite = options.sqlite3 = false

    if (options.prisma && !options.postgres) options.sqlite = options.sqlite3 = true
    if (options.knex && !options.postgres) options.sqlite = options.sqlite3 = true

    if (typeof Bun !== 'undefined') options.bun = true

    let pj = {}

    try {
      pj = JSON.parse(fs.readFileSync(path.join(appdir, 'package.json'), 'utf-8'))
    } catch {
    }

    pj.dependencies ||= {}
    pj.devDependencies ||= {}

    // remove lock files from other package managers
    if (options.bun) {
      this.#rmFile('pnpm-lock.yaml')
      this.#rmFile('package-lock.json')
      this.#rmFile('yarn.lock')
    } if (options.pnpm) {
      this.#rmFile('bun.lockb')
      this.#rmFile('package-lock.json')
      this.#rmFile('yarn.lock')
    } else if (options.yarn) {
      this.#rmFile('bun.lockb')
      this.#rmFile('package-lock.json')
      this.#rmFile('pnpm-lock.yaml')
    } else {
      this.#rmFile('bun.lockb')
      this.#rmFile('pnpm-lock.yaml')
      this.#rmFile('yarn.lock')
    }

    let install = []
    for (const pkg of this.dependencies) {
      if (!pj.dependencies[pkg]) install.push(pkg)
    }

    if (install.length !== 0) {
      if (options.bun) {
        execSync(`bun add ${install.join(' ')}`, { stdio: 'inherit' })
      } else if (options.pnpm) {
        execSync(`pnpm add ${install.join(' ')}`, { stdio: 'inherit' })
      } else if (options.yarn) {
        execSync(`yarn add ${install.join(' ')}`, { stdio: 'inherit' })
      } else {
        execSync(`npm install ${install.join(' ')}`, { stdio: 'inherit' })
      }
    }

    install = []
    for (const pkg of this.devDependencies) {
      if (!pj.devDependencies[pkg]) install.push(pkg)
    }

    if (install.length !== 0) {
      if (options.bun) {
        execSync(`bun add -d ${install.join(' ')}`, { stdio: 'inherit' })
      } if (options.pnpm) {
        execSync(`pnpm add -D ${install.join(' ')}`, { stdio: 'inherit' })
      } else if (options.yarn) {
        execSync(`yarn add ${install.join(' ')} --dev`, { stdio: 'inherit' })
      } else {
        execSync(`npm install --save-dev ${install.join(' ')}`, { stdio: 'inherit' })
      }
    }

    const uninstall = []
    const dependencies = [...this.dependencies, ...this.devDependencies]
    for (const pkg in { ...pj.dependencies, ...pj.devDependencies }) {
      if (pkg.includes('@flydotio')) continue
      if (!dependencies.includes(pkg)) uninstall.push(pkg)
    }

    if (uninstall.length !== 0) {
      if (options.bun) {
        execSync(`bun remove ${install.join(' ')}`, { stdio: 'inherit' })
      } if (options.pnpm) {
        execSync(`pnpm remove ${install.join(' ')}`, { stdio: 'inherit' })
      } else if (options.yarn) {
        execSync(`yarn remove ${install.join(' ')}`, { stdio: 'inherit' })
      } else {
        execSync(`npm uninstall ${uninstall.join(' ')}`, { stdio: 'inherit' })
      }
    }

    // read package.json (creating if necessary)
    try {
      pj = JSON.parse(fs.readFileSync(path.join(appdir, 'package.json'), 'utf-8'))
    } catch (error) {
      if (error.code === 'ENOENT') {
        fs.writeFileSync('package.json', '{}');
      }

      pj = {}
    }
    pj.scripts ||= {}

    // install packages
    if (options.bun) {
      if (!fs.existsSync('bun.lockb')) {
        execSync('bun install', { stdio: 'inherit' })
      }
    } else if (options.pnpm) {
      if (!fs.existsSync('pnpm-lock.yaml')) {
        execSync('pnpm install', { stdio: 'inherit' })
      }
    } else if (options.yarn) {
      if (!fs.existsSync('yarn.lock')) {
        execSync('yarn install', { stdio: 'inherit' })
      }
    } else {
      if (!fs.existsSync('package-lock.json')) {
        execSync('npm install', { stdio: 'inherit' })
      }
    }

    let update = false
    if (pj.scripts.build !== this.build) update = true
    if (pj.scripts.start !== this.start) update = true
    if (options.esm && pj.type !== 'module') update = true
    if (!options.esm && pj.type) update = true

    if (update) {
      pj.scripts.build = this.build
      pj.scripts.start = this.start

      if (!this.build) delete pj.build
      if (!this.start) delete pj.start

      if (!options.esm) {
        delete pj.type
      } else if (pj.type !== 'module') {
        pj.type = 'module'
      }

      console.log(`${chalk.bold.green('update'.padStart(11, ' '))}  package.json`)
      fs.writeFileSync('package.json', JSON.stringify(pj, null, 2))
    }

    if (options.typescript) {
      await this.#outputTemplate('tsconfig.json.ejs')
      await this.#rmFile('server.js')
      await this.#outputTemplate('server.ejs', 'src/server.ts')
    } else {
      await this.#rmFile('tsconfig.json')
      await this.#outputTemplate('server.ejs', 'server.js')
      await this.#rmFile('src/server.ts')
    }

    if (options.drizzle) {
      await this.#outputTemplate('schema.drizzle', 'src/db/schema.ts')
    } else {
      await this.#rmFile('src/db/schema.ts')
    }

    if (options.prisma) {
      await this.#outputTemplate('schema.prisma', 'prisma/schema.prisma')

      if (!fs.existsSync('prisma/migrations')) {
        if (this.options.sqlite3) {
          process.env.DATABASE_URL ||= url.pathToFileURL('production.sqlite3').toString()
        }

        execSync('npx prisma migrate dev --name init', { stdio: 'inherit' })
      }
    } else {
      await this.#rmFile('prisma/schema.prisma')
    }

    if (options.ws && !options.htmx) {
      await this.#outputFile('client.js', 'public/client.js')
    } else {
      await this.#rmFile('public/client.js')
    }

    await this.#outputFile('favicon.ico', 'public/favicon.ico')
    await this.#outputFile('brandmark-light.svg', 'public/brandmark-light.svg')

    const extensions = ['tmpl', 'ejs', 'mustache']

    if (this.options.tailwindcss) {
      await this.#outputTemplate('tailwind.config.js')
      await this.#outputFile('input.css', 'src/input.css')

      for (const extension of extensions) {
        if (extension === this.templateExtension) {
          await this.#outputTemplate('index.html', `views/index.${extension}`)
        } else {
          await this.#rmFile(`views/index.${extension}`)
        }
      }
    } else {
      let proposed = await ejs.renderFile(path.join(DemoGenerator.templates, 'index.html'), this)
      const names = ['container', 'image', 'counter']
      let input = '@tailwind base;\n@layer base {\n'

      for (const match of proposed.matchAll(/class="(.*?)"/g)) {
        input = input + `.${names[0]} {@apply ${match[1]};}\n`
        proposed = proposed.replace(match[1], names.shift())
      }

      for (const extension of extensions) {
        if (extension === this.templateExtension) {
          await this.#writeFile(`views/index.${extension}`, proposed)
        } else {
          await this.#rmFile(`views/index.${extension}`)
        }
      }

      const tmpdir = os.tmpdir()
      fs.writeFileSync(`${tmpdir}/input.css`, input + '}')

      proposed = fs.readFileSync(path.join(DemoGenerator.templates, 'index.css'), 'utf-8')

      await this.#rmFile('tailwind.config.js')
      await this.#rmFile('src/input.css')

      await this.#writeFile('public/index.css', proposed)

      if (!fs.existsSync('.git')) {
        execSync('git init -b main', { stdio: 'inherit' })
      }
    }
  }

  async #outputFile(template, name = null) {
    const proposed = fs.readFileSync(path.join(DemoGenerator.templates, template), 'utf-8')

    await this.#writeFile(name || template, proposed)
  }

  async #outputTemplate(template, name = null) {
    name ||= template.replace(/\.ejs$/m, '')
    const proposed = await ejs.renderFile(path.join(DemoGenerator.templates, template), this)

    await this.#writeFile(name, proposed)
  }

  // write template file, prompting when there is a conflict
  async #writeFile(name, proposed) {
    if (name.includes('/')) {
      let path = name.split('/')
      path.pop('/')
      path = path.join('/')

      if (!fs.statSync(path, { throwIfNoEntry: false })) {
        console.log(`${chalk.bold.green('mkdir'.padStart(11, ' '))}  ${path}`)
        fs.mkdirSync(path, { recursive: true })
      }
    }

    const dest = path.join(this.#appdir, name)

    if (fs.statSync(dest, { throwIfNoEntry: false })) {
      const current = fs.readFileSync(dest, 'utf-8')

      if (current === proposed) {
        console.log(`${chalk.bold.blue('identical'.padStart(11))}  ${name}`)
        return dest
      }

      let prompt
      let question

      try {
        if (this.#answer !== 'a') {
          console.log(`${chalk.bold.red('conflict'.padStart(11))}  ${name}`)

          prompt = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          })

          // support node 16 which doesn't have a promisfied readline interface
          question = query => {
            return new Promise(resolve => {
              prompt.question(query, resolve)
            })
          }
        }

        while (true) {
          if (question) {
            this.#answer = await question(`Overwrite ${dest}? (enter "h" for help) [Ynaqdh] `)
          }

          switch (this.#answer.toLocaleLowerCase()) {
            case '':
            case 'y':
            case 'a':
              console.log(`${chalk.bold.yellow('force'.padStart(11, ' '))}  ${name}`)
              fs.writeFileSync(dest, proposed)
              return dest

            case 'n':
              console.log(`${chalk.bold.yellow('skip'.padStart(11, ' '))}  ${name}`)
              return dest

            case 'q':
              process.exit(0)
              break

            case 'd':
              console.log(proposed)
              console.log(Diff.createPatch(name, current, proposed, 'current', 'proposed').trimEnd() + '\n')
              break

            default:
              console.log('        Y - yes, overwrite')
              console.log('        n - no, do not overwrite')
              console.log('        a - all, overwrite this and all others')
              console.log('        q - quit, abort')
              console.log('        d - diff, show the differences between the old and the new')
              console.log('        h - help, show this help')
          }
        }
      } finally {
        if (prompt) prompt.close()
      }
    } else {
      console.log(`${chalk.bold.green('create'.padStart(11, ' '))}  ${name}`)
      fs.writeFileSync(dest, proposed)
    }

    return dest
  }

  // remove file, prompting before doing so
  async #rmFile(name) {
    const dest = path.join(this.#appdir, name)

    try {
      if (fs.statSync(dest, { throwIfNoEntry: false })) {
        let prompt
        let question

        try {
          if (this.#answer !== 'a') {
            console.log(`${chalk.bold.red('exist'.padStart(11))}  ${name}`)

            prompt = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            })

            // support node 16 which doesn't have a promisfied readline interface
            question = query => {
              return new Promise(resolve => {
                prompt.question(query, resolve)
              })
            }
          }

          while (true) {
            if (question) {
              this.#answer = await question(`Remove ${dest}? (enter "h" for help) [Ynaqh] `)
            }

            switch (this.#answer.toLocaleLowerCase()) {
              case '':
              case 'y':
              case 'a':
                console.log(`${chalk.bold.yellow('remove'.padStart(11, ' '))}  ${name}`)
                fs.unlinkSync(dest)
                return dest

              case 'n':
                console.log(`${chalk.bold.yellow('skip'.padStart(11, ' '))}  ${name}`)
                return dest

              case 'q':
                process.exit(0)
                break

              default:
                console.log('        Y - yes, remove')
                console.log('        n - no, do not remove')
                console.log('        a - all, remove this and all others')
                console.log('        q - quit, abort')
                console.log('        h - help, show this help')
            }
          }
        } finally {
          if (prompt) prompt.close()
        }
      }
    } catch (error) {
      console.log('caught')
      if (error.code !== 'ENOENT') throw err;
    }

    return dest
  }
}
