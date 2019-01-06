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

  server(option = 80) {
    if (typeof option !== 'object') {
      option = { port: option }
    }

    const servers = {}

    // http
    let httpsServer
    let httpServer

    if (!option.ssl || ! option.ssl.sslOnly) {
      httpServer = http.createServer(this.callback())
      httpServer.listen(option.port || 80)
      servers.http = httpServer
    }
    
    if (option.ssl) {
      let {dir, key, cert, port} = option.ssl
      if (!key || !cert) {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            const ext = path.extname(f)
            if ((ext === '.crt' || ext === '.pem') && !cert) {
              cert = fs.readFileSync(path.join(dir, f))
            } else if (ext === '.key' && !key) {
              key = fs.readFileSync(path.join(dir, f))
            }
          }
        }
      }

      httpsServer = https.createServer({key, cert}, this.callback())
      httpsServer.listen(port || 443)
      servers.https = httpsServer
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

      if (httpServer) {
        servers.ws = bindWsServer(httpServer)
      }

      if (httpsServer) {
        servers.wss = bindWsServer(httpsServer)
      }
    }

    // graph ql
    if (this.graphql) {
      servers.ws = this.graphql.bindSubscription(servers.http, servers.ws)
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

    let numCPUs = 1
    if (option.cluster) {
      numCPUs = option.cluster.numCPUs || require('os').cpus().length
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
        const servers = this.server(option)
        callback({
          master: false,
          numCPUs,
          servers
        })
      }
    } else {
      const servers = this.server(option)
      callback({
        master: true,
        numCPUs,
        servers
      })
    }
  }
}

module.exports = Koa
