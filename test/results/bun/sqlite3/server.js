import sqlite3 from 'bun:sqlite'
import url from 'node:url'

// open database
process.env.DATABASE_URL ||= url.pathToFileURL('production.sqlite3').toString()
const db = new sqlite3.Database(new URL(process.env.DATABASE_URL).pathname.slice(1))

// last known count
let count = 0

// Process requests based on pathname
async function fetch(request) {
  const { pathname } = new URL(request.url)

  if (pathname === '/') {
    return main(request)
  } else if (await Bun.file(`public${pathname}`).exists()) {
    return new Response(Bun.file(`public${pathname}`))
  } else {
    return new Response('Not found.', { status: 404 })
  }
}

// Main page
async function main(_request) {
  // increment count, creating table row if necessary
  const row = db.query('SELECT "count" from "welcome"').get()
  let query = 'UPDATE "welcome" SET "count" = ?'

  if (row) {
    count = row.count + 1
  } else {
    count = 1
    query = 'INSERT INTO "welcome" VALUES(?)'
  }

  db.query(query).run(count)

  // render HTML response
  try {
    let contents = await Bun.file('views/index.tmpl').text()
    contents = contents.replace('@@COUNT@@', count.toString())

    return new Response(contents, { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (error) {
    return new Response(error + '\n', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}

// Ensure welcome table exists
db.run('CREATE TABLE IF NOT EXISTS "welcome" ( "count" INTEGER )')

// Start web server on port 3000
Bun.serve({ port: 3000, fetch })
console.log('Server is listening on port 3000')
