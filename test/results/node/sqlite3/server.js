const fs = require('node:fs')
const http = require('node:http')
const sqlite3 = require('sqlite3')
const url = require('node:url')

// set up web server
const server = http.createServer(listener)

// open database
process.env.DATABASE_URL ||= url.pathToFileURL('production.sqlite3').toString()
const db = new sqlite3.Database(new URL(process.env.DATABASE_URL).pathname.slice(1))

// last known count
let count = 0

// Map of file extensions to mime types
const mimeTypes = {
  ico: 'image/x-icon',
  js: 'text/javascript',
  css: 'text/css',
  svg: 'image/svg+xml'
}

// Process requests based on pathname
async function listener(request, response) {
  const { pathname } = url.parse(request.url)

  if (pathname === '/') {
    await main(request, response)
  } else if (fs.existsSync(`public${pathname}`)) {
    try {
      const contents = fs.readFileSync(`public${pathname}`, 'utf-8')
      const mimeType = mimeTypes[pathname.split('.').pop()] || 'application/octet-stream'

      response.writeHead(200, { 'Content-Type': mimeType })
      response.write(contents, 'utf-8')
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain' })
      response.write(error + '\n')
    }

    response.end()
  } else {
    response.writeHead(404)
    response.end('Not found.')
  }
}

// Main page
async function main(_request, response) {
  // increment count, creating table row if necessary
  await new Promise((resolve, reject) => {
    db.get('SELECT "count" from "welcome"', (err, row) => {
      let query = 'UPDATE "welcome" SET "count" = ?'

      if (err) {
        reject(err)
        return
      } else if (row) {
        count = row.count + 1
      } else {
        count = 1
        query = 'INSERT INTO "welcome" VALUES(?)'
      }

      db.run(query, [count], err => {
        err ? reject(err) : resolve()
      })
    })
  })

  // render HTML response
  try {
    let contents = fs.readFileSync('views/index.tmpl', 'utf-8')
    contents = contents.replace('@@COUNT@@', count.toString())

    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.write(contents, 'utf-8')
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' })
    response.write(error + '\n')
  }

  response.end()
}

// Ensure welcome table exists
db.run('CREATE TABLE IF NOT EXISTS "welcome" ( "count" INTEGER )')

// Start web server on port 3000
server.listen(3000, () => {
  console.log('Server is listening on port 3000')
})
