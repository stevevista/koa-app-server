
const {Koa, Static, WebSocket} = require('./index')
const path = require('path')

const app = new Koa()

app.on('error', err => {
  if (err.ctx) {
    const ctx = err.ctx
    ctx.body = err.message
  }
})

app.use(Static('/', path.join(__dirname, './public'), {gzip: true}))

app.start({
  port: 8080,
  ssl: {
    dir: '../ssl',
  //  cert: ...
    port: 4433,
    sslOnly: false
  }
}, ({master, numCPUs}) => {
  console.log('server started')
})
