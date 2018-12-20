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

function WebSocketHandle(handle) {
  return function __websocketRouteWrap() {
    return handle
  }
}

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
    if (handle.name === '__websocketRouteWrap') {
      this.wsRoutes.push(handle())
    } else {
      super.use(handle)
    }

    return this
  }

  listen(option = 80) {
    if (typeof option !== 'object') {
      option = { port: option }
    }

    // http
    let httpsServer
    const server = http.createServer(this.callback())
    server.listen(option.port || 80)
    
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
        this.listen(option)
        callback({
          master: false,
          numCPUs
        })
      }
    } else {
      this.listen(option)
      callback({
        master: true,
        numCPUs
      })
    }
  }
}

module.exports = {
  Koa,
  WebSocket: WebSocketHandle
}
