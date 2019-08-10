
const {Koa} = require('../index')
const path = require('path')

const app = new Koa()

app.on('error', err => {
  console.log(err)
  if (err.ctx) {
    const ctx = err.ctx
    ctx.body = err.message
  }
})

app.staticRoute('/', {
  gzip: true,
  root: path.join(__dirname, './public')
}, async ctx => {
  console.log('--get static page:', ctx.path);
})

app.wsRoute('/ws', async ctx => {
  console.log(ctx.websocket);
})

app.start({port: 8011}, ({master, numCPUs, servers}) => {
  console.log('server started', master, numCPUs)
})
