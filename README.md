## Overview

Provides a Node.js generator to produce Dockerfiles and related files.  It is intended to support any framework that lists its dependencies, includes a `start` script in `package.json`, and optionally includes a `build` script.

See [test](./test) for a list of frameworks and examples of Dockerfiles produced based on the associated `package.json` and lock files.

See [blog post](https://fly.io/blog/flydotio-heart-js/) for more information.

## Usage

To run once:

```
npx --yes @flydotio/node-demo@latest
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

A testing strategy has not yet been adopted.  The combinatorics of the above options are mind boggling!

## Known bugs/limitations:

* When rerunning this tool, files that were previously created but no longer needed are removed.  This does not include outputs in the `build` directory for example.

* Switching packaging managers may result in problems.  It generally is best to delete the `node_modules` directory before switching.

* This tool won't (yet!) define volumes or set up litefs, so sqlite databases are ephemeral.

* Nor does this tool set up Postgres databases for you locally.  If you wish to try this out, you will need to install postgres, and create a database.

* This tool does not set environment variables or update your `.env` file.
