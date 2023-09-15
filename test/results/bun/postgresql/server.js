const pg = require('pg')

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
    let contents = await Bun.file('views/index.tmpl').text()
    contents = contents.replace('@@COUNT@@', count.toString())

    return new Response(contents, { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (error) {
    return new Response(error + '\n', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}

(async() => {
  // try to connect to postgres
  await postgres.tryConnect(true)

  // Ensure welcome table exists
  await postgres.client?.query('CREATE TABLE IF NOT EXISTS "welcome" ( "count" INTEGER )')

  // Start web server on port 3000
  Bun.serve({ port: 3000, fetch })
  console.log('Server is listening on port 3000')
})()
