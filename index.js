
const Static = require('./lib/static')
const Koa = require('./lib/server')
const WebSocketRouter = require('./lib/router')
const {GraphQL} = require('./lib/graphql')

module.exports = {
  Koa,
  Static,
  GraphQL,
  WebSocketRouter
}
