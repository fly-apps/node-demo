import redis from 'redis'

// list of active websocket sessions
const clients = new Set()

// common reconnect logic for postgres, redis clients
const reconnect = {
  client: null,
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
  }
}

// redis subscriber
const subscriber = {
  ...reconnect,
  async connect() {
    this.client = redis.createClient({ url: process.env.REDIS_URL })

    await this.client.connect()

    // Forward messages from redis to all websocket clients
    this.client.subscribe('welcome:counter', (message) => {
      clients.forEach(client => {
        try { client.send(message) } catch {}
      })
    })

    this.client.on('error', (err) => {
      console.error('Redis Server Error', err)
      this.disconnect()
      this.reconnect()
    })
  },

  disconnect() {
    if (this.client) {
      this.client.quit()
      this.client = null
    }
  }
}

// redis publisher
const publisher = {
  ...reconnect,

  async connect() {
    this.client = redis.createClient({ url: process.env.REDIS_URL })

    await this.client.connect()
  },

  disconnect() {
    if (this.client) {
      this.client.quit()
      this.client = null
    }
  }
}

// last known count
let count = 0

// Process requests based on pathname
async function fetch(request, server) {
  const { pathname } = new URL(request.url)

  if (pathname === '/') {
    return main(request)
  } else if (pathname === '/websocket') {
    if (server.upgrade(request)) return
    return new Response('Not found.', { status: 404 })
  } else if (await Bun.file(`public${pathname}`).exists()) {
    return new Response(Bun.file(`public${pathname}`))
  } else {
    return new Response('Not found.', { status: 404 })
  }
}

// Main page
async function main(_request) {
  const oldCount = count

  // increment counter in counter.txt file
  try {
    count = parseInt(await Bun.file('counter.txt').text()) + 1
  } catch {
    count = 1
  }

  await Bun.write('counter.txt', count.toString())

  if (oldCount !== count) {
    // publish new count on redis
    publisher.client?.publish('welcome:counter', count.toString())
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

// Define web socket
// Define web socket
const websocket = {
  open(ws) {
    clients.add(ws)

    // update client on a best effort basis
    if (count) try { ws.send(count.toString()) } catch {}
  },

  close(ws) {
    clients.delete(ws)
  },

  // We don’t expect any messages on websocket, but log any ones we do get.
  message(ws, message) {
    console.log(message)
  }
}

;(async() => {
  // try to connect to each service
  await Promise.all([
    subscriber.tryConnect(true),
    publisher.tryConnect(true)
  ])

  // Start web server on port 3000
  Bun.serve({ port: 3000, fetch, websocket })
  console.log('Server is listening on port 3000')
})()
