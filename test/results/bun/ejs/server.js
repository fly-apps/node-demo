const ejs = require('ejs')

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
    return new Response('Not found.', { status: 400 })
  }
}

// Main page
async function main(_request) {
  // increment counter in counter.txt file
  try {
    count = parseInt(await Bun.file('counter.txt').text()) + 1
  } catch {
    count = 1
  }

  await Bun.write('counter.txt', count.toString())

  // render HTML response
  try {
    let contents = await Bun.file('views/index.ejs').text()
    contents = ejs.render(contents, { count })

    return new Response(contents, { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (error) {
    return new Response(error + '\n', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
};

Bun.serve({ port: 3000, fetch })
console.log('Server is listening on port 3000')
