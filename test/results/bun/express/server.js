const express = require('express')
const fs = require('node:fs')

// set up express web server
const app = express()

// set up static content
app.use(express.static('public'))

// last known count
let count = 0

// Main page
app.get('/', async(_request, response) => {
  // increment counter in counter.txt file
  try {
    count = parseInt(await Bun.file('counter.txt').text()) + 1
  } catch {
    count = 1
  }

  await Bun.write('counter.txt', count.toString())

  // render HTML response
  try {
    const content = fs.readFileSync('views/index.tmpl', 'utf-8')
      .replace('@@COUNT@@', count.toString())
    response.set('Content-Type', 'text/html')
    response.send(content)
  } catch (error) {
    response.send()
  }
})

// Start web server on port 3000
app.listen(3000, () => {
  console.log('Server is listening on port 3000')
})
