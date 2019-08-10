'use strict'
const KoaBase = require('koa')
const WebSocket = require('ws')
const url = require('url')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const compose = require('koa-compose')
const cluster = require('cluster')
const { ApolloServer } = require('apollo-server-koa')
const { GraphQLMiddleware } = require('./graphql')

const WebSocketRouter = require('./router')
const serveStatic = require('./static')


class Koa extends KoaBase {
  constructor() {
    super()
    this.wsRoutes = []


    // route error handle
    this.use(async (ctx, next) => {
      try {
        await next()
      } catch (e) {
        ctx.status = e.status || 500
        e.ctx = ctx
        this.emit('error', e)
      }
    })
  }

  use(handle) {
    if (handle instanceof WebSocketRouter) {
      this.wsRoutes.push(handle.middleware())
    } else if (handle instanceof GraphQLMiddleware) {
      this.graphql = handle
      this.graphqlServer = new ApolloServer(handle.serverOptions)
      this.graphqlServer.setGraphQLPath(handle.graphqlPath)
      this.graphqlServer.applyMiddleware({ app: this })
    } else {
      super.use(handle)
    }

    return this
  }

  _server(option = 80) {

    const servers = {}

    let {sslOnly, key, cert, port: sslPort} = option.ssl

    // the key maybe is file path
    if (key && typeof key === 'string') {
      const ext = path.extname(key)
      if (ext === '.key') {
        key = fs.readFileSync(key)
      }
    }

    if (cert && typeof cert === 'string') {
      const ext = path.extname(cert)
      if (ext === '.crt' || ext === '.pem') {
        cert = fs.readFileSync(cert)
      }
    }

    // HTTP server
    if (!sslOnly) {
      const httpServer = http.createServer(this.callback())
      httpServer.listen(option.port)
      servers.http = httpServer

      httpServer.on('error', e => {
        this.emit('error', e)
      })
    }

    // HTTPS Server
    if (key && cert && sslPort) {
      const httpsServer = https.createServer({key, cert}, this.callback())
      httpsServer.listen(sslPort)
      servers.https = httpsServer

      httpsServer.on('error', e => {
        this.emit('error', e)
      })
    }

    // websocket
    if (this.wsRoutes.length > 0) {

      const router = this.wsRoutes.length > 1 ? compose(this.wsRoutes) : this.wsRoutes[0]

      const bindWsServer = (server) => {
        const ws = new WebSocket.Server({ server })
        ws.on('connection', async (socket, req) => {
          const path = url.parse(req.url).pathname

          if (socket.protocol === 'graphql-ws') {
            // other specific binding, e.g. graphQL subscriptions
            if (this.graphql && this.graphql.graphqlPath) {
              if (path !== this.graphql.graphqlPath) {
                socket.close()
              }
            }
            return
          }

          const ctx = this.createContext(req)
          ctx.websocket = socket
          ctx.path = path
      
          try {
            await router(ctx, () => {
              socket.close()
              this.emit('error', new Error('Not Found Websocket path'))
            })
          } catch (e) {
            socket.close()
            this.emit('error', e)
          }
        })

        return ws
      }

      if (servers.http) {
        servers.ws = bindWsServer(servers.http)
      }

      if (servers.https) {
        servers.wss = bindWsServer(servers.https)
      }
    }

    // graph ql
    if (this.graphql) {
      if (servers.http) {
        servers.ws = this.graphql.bindSubscription(servers.http, servers.ws)
      }
      if (servers.https) {
        servers.wss = this.graphql.bindSubscription(servers.https, servers.wss)
      }
    }

    return servers
  }

  start(option = 80, callback = ()=> {}) {
    if (typeof option !== 'object') {
      option = { port: option }
    }
      
    option = {port: 80, ssl: {}, ...option};
    option.ssl = {port: 443, ...option.ssl};

    let numCPUs = 1

    if (typeof option.cluster === 'number') {
      numCPUs = option.cluster;
    } else if (option.cluster === true) {
      numCPUs = require('os').cpus().length
    }

    if (numCPUs > 1) {
      if (cluster.isMaster) {
        for (let i = 0; i < numCPUs; i++) {
          cluster.fork()
        }
      
        cluster.on('exit', (worker, code, signal) => {
          setTimeout(() => cluster.fork(), 2000)
        })

        callback({
          master: true,
          numCPUs
        })
      } else {
        const servers = this._server(option)
        callback({
          master: false,
          numCPUs,
          servers
        })
      }
    } else {
      const servers = this._server(option)
      callback({
        master: true,
        numCPUs,
        servers
      })
    }
  }

  staticRoute(path, opt = {}, ...middlewares) {
    const {root} = opt;
    if (!root) {
      throw Error('must set root option for static router');
    }
    return this.use(serveStatic(path, root, opt, ...middlewares));
  }

  wsRoute(path, ...middlewares_and_wshandler) {
    const count = middlewares_and_wshandler.length;

    if (count === 0) {
      throw Error('must have websocket handler');
    }

    const wshandler = middlewares_and_wshandler[count - 1];
    const middlewares = middlewares_and_wshandler.slice(0, count - 1);
    
    const router = new WebSocketRouter();
    router.route(path, ...middlewares, wshandler);
    return this.use(router);
  }
}

module.exports = Koa
