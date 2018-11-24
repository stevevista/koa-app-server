'use strict'
const KoaBase = require('koa')
const WebSocket = require('ws')
const url = require('url')
const http = require('http')
const https = require('https')
const compose = require('koa-compose')
const cluster = require('cluster')

const Static = require('./static')

function WebSocketHandle(handle) {
  return function __websocketRouteWrap() {
    return handle
  }
}

class Koa extends KoaBase {
  constructor() {
    super()
    this.wsRoutes = []
  }

  use(handle) {
    if (handle.name === '__websocketRouteWrap') {
      this.wsRoutes.push(handle())
    } else {
      super.use(handle)
    }

    return this
  }

  listen(optinos = 80) {
    if (typeof optinos !== 'object') {
      optinos = { port: optinos }
    }

    // http
    let httpsServer
    const server = http.createServer(this.callback())
    server.listen(optinos.port || 80)
    
    if (optinos.ssl) {
      httpsServer = https.createServer(optinos.ssl, this.callback())
      httpsServer.listen(optinos.ssl.port || 443)
    }

    // websocket
    if (this.wsRoutes.length > 0) {

      const router = this.wsRoutes.length > 1 ? compose(this.wsRoutes) : this.wsRoutes[0]

      const bindWsServer = (server) => {
        const ws = new WebSocket.Server({ server })
        ws.on('connection', async (socket, req) => {
          const ctx = this.createContext(req)
          ctx.websocket = socket
          ctx.path = url.parse(req.url).pathname
      
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
      }

      bindWsServer(server)
      if (httpsServer) {
        bindWsServer(httpsServer)
      }
    }
  }

  start(optinos = 80, callback = ()=> {}) {
    if (typeof optinos !== 'object') {
      optinos = { port: optinos }
    }

    let numCPUs = 1
    if (optinos.cluster) {
      numCPUs = optinos.cluster.numCPUs || require('os').cpus().length
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
        this.listen(optinos)
        callback({
          master: false,
          numCPUs
        })
      }
    } else {
      this.listen(optinos)
      callback({
        master: true,
        numCPUs
      })
    }
  }
}

module.exports = {
  Koa,
  Static,
  WebSocket: WebSocketHandle
}
