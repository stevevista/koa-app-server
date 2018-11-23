# Features
- Static Server
- WebSocket
- Https

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

app.listen({
  port: 8080,
  //sslOption: {
  //  key: ...
  //  cert: ...
  //  port: 443
  //}
})

```