'use strict'
const { SubscriptionServer } = require('subscriptions-transport-ws')
const { execute, subscribe } = require('graphql')
const WebSocket = require('ws')

class GraphQLMiddleware {
  constructor(graphqlPath, schema, serverOptions) {
    graphqlPath = graphqlPath || '/graphql'
    serverOptions = serverOptions || {}

    this.schema = schema
    this.serverOptions = {schema, ...serverOptions}
    this.graphqlPath = graphqlPath
  }

  bindSubscription(server, ws) {
    if (!this.schema._subscriptionType) {
      return ws
    }

    if (!ws) {
      ws = new WebSocket.Server({ server, path: this.graphqlPath })
    }

    SubscriptionServer.create(
      {
        schema: this.schema,
        execute,
        subscribe,
      },
      ws
    )

    return ws
  }
}

function GraphQL(graphqlPath, schema, serverOptions) {
  return new GraphQLMiddleware(graphqlPath, schema, serverOptions, graphqlPath)
}

module.exports = {
  GraphQL,
  GraphQLMiddleware
}
