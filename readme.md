# Features
- Static Server
- WebSocket
- Https

# Usage
```
const {Koa, Static, WebSocket} = require('koa-server')

app.use(WebSocket(wsRouter.routes()))

app.use(Static('/', path.join(__dirname, '../public'), {gzip: true}))

app.listen({
  port: 80,
  sslOption: {
    key: ...
    cert: ...
    port: 443
  }
})

```