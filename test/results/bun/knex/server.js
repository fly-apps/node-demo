const knex = require('knex')
const url = require('node:url')

// open database
process.env.DATABASE_URL ||= url.pathToFileURL('production.sqlite3').toString()
const db = knex({
  client: 'sqlite3',
  connection: { filename: new URL(process.env.DATABASE_URL).pathname },
  useNullAsDefault: true
})

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
    let contents = await Bun.file('views/index.tmpl').text()
    contents = contents.replace('@@COUNT@@', count.toString())

    return new Response(contents, { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (error) {
    return new Response(error + '\n', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}

;(async() => {
  // Ensure welcome table exists
  if (!(await db.schema.hasTable('welcome'))) {
    await db.schema.createTable('welcome', table => {
      table.integer('count')
    })
  }

  // Start web server on port 3000
  Bun.serve({ port: 3000, fetch })
  console.log('Server is listening on port 3000')
})()
