
const {Koa, Static, WebSocket} = require('./index')
const path = require('path')

const app = new Koa()

app.on('error', err => {
  console.log(err)
  if (err.ctx) {
    const ctx = err.ctx
    ctx.body = err.message
  }
})

app.use(Static('/', path.join(__dirname, './public'), {gzip: true}))

app.start({port: 8011}, ({master, numCPUs}) => {
  console.log('server started', master, numCPUs)
})
