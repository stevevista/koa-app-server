'use strict'
var compose = require('koa-compose');
var pathToRegExp = require('path-to-regexp');

function safeDecodeURIComponent(text) {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}

class Layer {
  constructor(path, middleware, opts) {
    this.opts = opts || {};
    this.paramNames = [];
    this.stack = Array.isArray(middleware) ? middleware : [middleware];

    // ensure middleware is a function
    this.stack.forEach(function(fn) {
      var type = (typeof fn);
      if (type !== 'function') {
        throw new Error(
          " `" + path +"`: `middleware` "
          + "must be a function, not `" + type + "`"
        );
      }
    }, this);

    this.path = path;
    this.regexp = pathToRegExp(path, this.paramNames, this.opts);
  }
  
  match (path) {
    return this.regexp.test(path);
  }

  /**
   * Returns map of URL parameters for given `path` and `paramNames`.
   */

  params (path, captures, existingParams) {
    var params = existingParams || {};

    for (var len = captures.length, i=0; i<len; i++) {
      if (this.paramNames[i]) {
        var c = captures[i];
        params[this.paramNames[i].name] = c ? safeDecodeURIComponent(c) : c;
      }
    }

    return params;
  }

  /**
   * Returns array of regexp url path captures.
   *
   * @param {String} path
   * @returns {Array.<String>}
   * @private
   */

  captures (path) {
    return path.match(this.regexp).slice(1);
  }
}

class WebSocketRouter {
  constructor(opts = {}) {
    this.opts = opts
    this.stack = []
  }

  route (path, ...middleware) {
    var router = this;
    var stack = this.stack;
  
    // support array of paths
    if (Array.isArray(path)) {
      path.forEach(function (p) {
        router.get.call(router, p, ...middleware);
      });
  
      return this;
    }
  
    // create route
    const route = new Layer(path, middleware, {
      end: true,
      sensitive: false,
      strict: false
    });
  
    stack.push(route);
  
    return route;
  }

  middleware() {  
    return (ctx, next) => {
      if (ctx.method !== 'GET') {
        return next()
      }
  
      const path = ctx.path
      const matchedLayers = this.match(path);
  
      if (matchedLayers.length === 0) return next();
  
      var mostSpecificLayer = matchedLayers[matchedLayers.length - 1]
      ctx._matchedRoute = mostSpecificLayer.path;
  
      const layerChain = matchedLayers.reduce(function(memo, layer) {
        memo.push(function(ctx, next) {
          ctx.captures = layer.captures(path, ctx.captures);
          ctx.params = layer.params(path, ctx.captures, ctx.params);
          return next();
        });
        return memo.concat(layer.stack);
      }, []);
  
      return compose(layerChain)(ctx, next);
    }
  }

  match(path) {
    const layers = this.stack;
    const pathAndMethod = []
  
    for (var len = layers.length, i = 0; i < len; i++) {
      const layer = layers[i];
  
      if (layer.match(path)) {
        pathAndMethod.push(layer);
      }
    }
  
    return pathAndMethod;
  }
}

module.exports = WebSocketRouter
