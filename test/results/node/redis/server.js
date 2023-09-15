const { WebSocketServer } = require('ws')
const fs = require('node:fs')
const http = require('node:http')
const redis = require('redis')
const url = require('node:url')

// set up web server
const server = http.createServer(listener)
const wss = new WebSocketServer({ noServer: true })

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
      for (const client of wss.clients) {
        try { client.send(message) } catch {}
      }
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
  const oldCount = count

  // increment counter in counter.txt file
  try {
    count = parseInt(fs.readFileSync('counter.txt', 'utf-8')) + 1
  } catch {
    count = 1
  }

  fs.writeFileSync('counter.txt', count.toString())

  if (oldCount !== count) {
    // publish new count on redis
    publisher.client?.publish('welcome:counter', count.toString())
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

// Define web socket
server.on('upgrade', (request, socket, head) => {
  const { pathname } = url.parse(request.url)

  if (pathname === '/websocket') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws) => {
  // update client on a best effort basis
  if (count) try { ws.send(count.toString()) } catch {}

  // We don’t expect any messages on websocket, but log any ones we do get.
  ws.on('message', console.log)
})

;(async() => {
  // try to connect to each service
  await Promise.all([
    subscriber.tryConnect(true),
    publisher.tryConnect(true)
  ])

  // Start web server on port 3000
  server.listen(3000, () => {
    console.log('Server is listening on port 3000')
  })
})()
