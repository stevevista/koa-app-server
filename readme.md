## Server
- Koa

extend Koa with WebSocket, Static and GraphQL
## Middlewares
- Static
- WebSocketRouter
- GraphQL

## API
### Koa
 - Koa##start(options, function({master, numCPUs, servers}))

### Option
- port (default: 80)
- cluster (boolean or number)
- ssl
  - key (content or path)
  - cert (content or path) 
  - port (default: 443)
  - sslOnly (false)

### Middlewares
 - Static(path, virtualPath, options)
 - GraphQL(graphqlPath, ExecutableSchema, serverOptions)
 - WebSocketRouter#route(path, ...middleware)

# Code Examples
- GraphQL

If schema contains Subscription, start app will create websocket on the path
```

const typeDefs = `
type Subscription {
  somethingChanged: Result
}
`;

const resolvers = {
    somethingChanged: {
      subscribe: () => pubsub.asyncIterator(SOMETHING_CHANGED_TOPIC),
    }
  },
};

const schema = makeExecutableSchema({typeDefs, resolvers});

app.use(GraphQL('/GQL', schema, {}))

```


# Usage
```
const Router = require('koa-router')
const path = require('path')
const {Koa, Static, WebSocketRouter} = require('koa-app-server')

const wsRouter = new WebSocketRouter()

wsRouter.route('/:topic', async ctx => {
  ctx.websocket.send(`Connect on ${ctx.params.topic}`)
})

const app = new Koa()

app.on('error', err => {
  if (err.ctx) {
    const ctx = err.ctx
    ctx.body = err.message
  }
})

app.use(wsRouter)

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