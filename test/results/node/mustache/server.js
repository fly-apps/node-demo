const fs = require('node:fs')
const http = require('node:http')
const mustache = require('mustache')
const url = require('node:url')

// set up web server
const server = http.createServer(listener)

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
    response.writeHead(400)
    response.end('Not found.')
  }
}

// Main page
async function main(_request, response) {
  // increment counter in counter.txt file
  try {
    count = parseInt(fs.readFileSync('counter.txt', 'utf-8')) + 1
  } catch {
    count = 1
  }

  fs.writeFileSync('counter.txt', count.toString())

  // render HTML response
  try {
    let contents = fs.readFileSync('views/index.mustache', 'utf-8')
    contents = mustache.render(contents, { count })

    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.write(contents, 'utf-8')
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' })
    response.write(error + '\n')
  }

  response.end()
};

// Start web server on port 3000
server.listen(3000, () => {
  console.log('Server is listening on port 3000')
})
