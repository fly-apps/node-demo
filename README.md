## Overview

Provides a Node.js demo with minimal (and selectable) set of dependencies.

See [blog post](https://fly.io/javascript-journal/vanilla-candy-sprinkles/) for more information.

## Usage

To run once, in an empty directory:

```
npx --yes @flydotio/node-demo@latest
```

To enable rerunning with different options, install via:

```
npm install @flydotio/node-demo --save-dev
```

Then you can rerun as many times as desired using:

```
npx node-demo
```

### General Option:

* `--force` - overwrite existing files
* `--esm` - use imports (es6) instead of require (cjs)

## Templating Options:

* `--ejs` - use Embedded JavaScript templating (ejs)
* `--mustache` - use mustache templates

# Alternate Web Server

* `--express` - use express web server

## Database Options:

* `--monbodb` - use mongodb
* `--postgresql` - use postgresdb
* `--sqlite` - use sqlite3

## ORM Options:

* `--drizzle` - use drizzle ORM for databases.  Implies typescript.
* `--knex` - use knex ORM for databases
* `--prisma` - use prisma ORM for databases

## WebSocket:

* `--websocket` - use websockets for real-time updates
* `--htmx` - use htmx for socket updates
* `--redis` - use redis pub/sub

## Packaging alternatives:

* `--pnpm` - use pnpm as the package manager
* `--yarn` - use yarn as the package manager

## Popular builders

* `--tailwindcss` - use tailwindcss
* `--typescript` - generate typescript

## Testing

A testing strategy is evolving.  The combinatorics of the above options are mind boggling!

What tests we have can be run with `npm test`.  This runs a series of tests defined in [test.json](./test/test.json), and compares the results to previously captures [test/results](./test/results/).

Capturing new test results can be accomplished by running `npm run test:capture`.  Review the results before committing.

## Known bugs/limitations:

* When rerunning this tool, files that were previously created but no longer needed are removed.  This does not include outputs in the `build` directory for example.

* Switching packaging managers may result in problems.  It generally is best to delete the `node_modules` directory before switching.

* This tool does not install or set up Postgres or Mongodb databases for you locally.

* This tool does not set environment variables or update your `.env` file.
