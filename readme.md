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

# Usage
```
const Router = require('koa-router')
const {Koa, Static, WebSocket} = require('koa-app-server')

const wsRouter = new Router()

wsRouter.all('/:topic', async ctx => {
  ctx.websocket.send(`Connect on ${ctx.params.topic}`)
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