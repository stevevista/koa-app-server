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
    - options.port (default: 80)
    - options.cluster (boolean or number)
    - options.ssl
      - key (content or path)
      - cert (content or path) 
      - port (default: 443)
      - sslOnly (false) 
  - staticRoute(path, options, ...middlewares)
    - options.gzip (default true)
    - options.root (required, dish static file path)

    options.root and path should be both file or directory

  - wsRoute(path, ...middlewares, wshandler)

    ctx will associate with websocket proerty

```js
app.staticRoute('/test.html', {
  root: path.join(__dirname, './public/real_test.html')
})

app.staticRoute('/res', {
  root: path.join(__dirname, './public/res_dir')
})

```    

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
```js
const path = require('path')
const {Koa} = require('koa-app-server')

const app = new Koa()

app.on('error', err => {
  if (err.ctx) {
    const ctx = err.ctx
    ctx.body = err.message
  }
})

app.wsRoute('/:topic', async ctx => {
  ctx.websocket.send(`Connect on ${ctx.params.topic}`)
})

app.staticRoute('/', {gzip: true, root: path.join(__dirname, './public')})

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