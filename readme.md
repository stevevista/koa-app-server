# Features
- Static Server
- WebSocket
- Https
- Cluster

# API
## Koa
- use(Static(path, localpath, optinos = {gzip: true}))
- use(WebSocket(routerMiddleware))
 - listen(option = {port, ssl = {key, cert}})
 - start(option = {port, ssl = {key, cert}, cluster}, function({master, numCPUs}))

### Option
- port (default: 80)
- cluster (boolean or object)
  - numCPUs
- ssl
  - dir (path which contain key / cert files)
  - key (content)
  - cert (content) 
  - port (default: 443)

# Usage
```
const Router = require('koa-router')
const path = require('path')
const {Koa, Static, WebSocket} = require('koa-app-server')

const wsRouter = new Router()

wsRouter.all('/:topic', async ctx => {
  ctx.websocket.send(`Connect on ${ctx.params.topic}`)
})

const app = new Koa()

app.on('error', err => {
  if (err.ctx) {
    const ctx = err.ctx
    ctx.body = err.message
  }
})

app.use(WebSocket(wsRouter.routes()))

app.use(Static('/', path.join(__dirname, './public'), {gzip: true}))

app.start({
  port: 8080,
  //ssl: {
  //  key: ...
  //  cert: ...
  //  port: 443
  //},
  cluster: true
}, ({master, numCPUs}) => {
  console.log('server started')
})

```