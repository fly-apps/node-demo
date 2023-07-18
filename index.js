#!/usr/bin/env node

import process from 'node:process'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DemoGenerator } from './generate.js'

// parse command line for options
const options = yargs((hideBin(process.argv)))
  .usage('$0 [args]')
  .option('force', {
    describe: 'force overwrite of existing files',
    type: 'boolean'
  })
  .option('bun', {
    describe: 'use bun as the package installer',
    type: 'boolean'
  })
  .option('drizzle', {
    describe: 'use drizzle ORM for databases',
    type: 'boolean'
  })
  .option('esm', {
    describe: 'use imports (es6) instead of require (cjs)',
    type: 'boolean'
  })
  .option('ejs', {
    describe: 'use Embedded JavaScript templating (ejs)',
    type: 'boolean'
  })
  .option('express', {
    describe: 'use express web server',
    type: 'boolean'
  })
  .option('knex', {
    describe: 'use knex ORM for databases',
    type: 'boolean'
  })
  .option('htmx', {
    describe: 'use htmx for socket updates',
    type: 'boolean'
  })
  .option('mongodb', {
    alias: ['mongo'],
    describe: 'use mongodb',
    type: 'boolean'
  })
  .option('mustache', {
    describe: 'use mustache templates',
    type: 'boolean'
  })
  .option('pnpm', {
    describe: 'use pnpm as the package manager',
    type: 'boolean'
  })
  .option('postgresql', {
    alias: ['postgres', 'pg'],
    describe: 'use postgresdb',
    type: 'boolean'
  })
  .option('prisma', {
    describe: 'use prisma ORM for databases',
    type: 'boolean'
  })
  .option('redis', {
    describe: 'use redis pub/sub',
    type: 'boolean'
  })
  .option('sqlite', {
    alias: ['sqlite3'],
    describe: 'use sqlite3',
    type: 'boolean'
  })
  .option('tailwindcss', {
    alias: ['tailwind', 'tw'],
    describe: 'use tailwindcss',
    type: 'boolean'
  })
  .option('typescript', {
    alias: 'ts',
    describe: 'generate typescript',
    type: 'boolean'
  })
  .option('websocket', {
    alias: 'ws',
    describe: 'use websockets for real-time updates',
    type: 'boolean'
  })
  .option('yarn', {
    describe: 'use yarn as the package manager',
    type: 'boolean'
  })
  .parse()

// generate dockerfile and related artifacts
new DemoGenerator().run(process.cwd(), { ...options })
