const fs = require('node:fs')
const http = require('node:http')
const pg = require('pg')
const url = require('node:url')

// set up web server
const server = http.createServer(listener)

// postgres client
const postgres = {
  interval: null,

  reconnect() {
    if (this.interval) return

    this.interval = setInterval(() => {
      this.tryConnect().catch(console.log)
    }, 1000)
  },

  async tryConnect(reconnect = false) {
    if (this.client || !this.connect || !this.disconnect) return

    try {
      await this.connect()

      if (this.interval) {
        clearInterval(this.interval)
        this.interval = null
      }
    } catch (error) {
      console.error(error)
      this.disconnect()
      if (reconnect) this.reconnect()
      throw error
    }
  },

  async connect() {
    this.client = new pg.Client({ connectionString: process.env.DATABASE_URL })

    await this.client.connect()

    this.client.on('end', event => {
      this.disconnect()
      this.reconnect()
    })
  },

  disconnect() {
    if (this.client) {
      this.client.end()
      this.client = null
    }
  }
}

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
  if (postgres.client) {
    // fetch current count
    const welcome = await postgres.client.query('SELECT "count" from "welcome"')

    // increment count, creating table row if necessary
    if (!welcome.rows.length) {
      count = 1
      await postgres.client?.query('INSERT INTO "welcome" VALUES($1)', [count])
    } else {
      count = welcome.rows[0].count + 1
      await postgres.client?.query('UPDATE "welcome" SET "count" = $1', [count])
    }
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
  // try to connect to postgres
  await postgres.tryConnect(true)

  // Ensure welcome table exists
  await postgres.client?.query('CREATE TABLE IF NOT EXISTS "welcome" ( "count" INTEGER )')

  // Start web server on port 3000
  server.listen(3000, () => {
    console.log('Server is listening on port 3000')
  })
})()
