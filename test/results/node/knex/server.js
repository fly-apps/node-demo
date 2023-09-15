const fs = require('node:fs')
const http = require('node:http')
const knex = require('knex')
const url = require('node:url')

// set up web server
const server = http.createServer(listener)

// open database
process.env.DATABASE_URL ||= url.pathToFileURL('production.sqlite3').toString()
const db = knex({
  client: 'sqlite3',
  connection: { filename: new URL(process.env.DATABASE_URL).pathname },
  useNullAsDefault: true
})

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
  // Get current count (may return null)
  const welcome = await db.table('welcome').first()

  // Increment count, creating table row if necessary
  if (welcome) {
    count = welcome.count + 1
    await db('welcome').update({ count })
  } else {
    count = 1
    await db('welcome').insert({ count })
  }

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

(async() => {
  // Ensure welcome table exists
  if (!(await db.schema.hasTable('welcome'))) {
    await db.schema.createTable('welcome', table => {
      table.integer('count')
    })
  }

  // Start web server on port 3000
  server.listen(3000, () => {
    console.log('Server is listening on port 3000')
  })
})()
