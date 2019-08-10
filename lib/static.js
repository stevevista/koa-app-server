'use strict'
const path = require('path')
const send = require('koa-send')
const etag = require('etag')
const fresh = require('fresh')
const fs = require('fs')

function stat (path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        resolve(null)
      } else {
        resolve(stats)
      }
    })
  })
}

function parseTokenList (str) {
  var end = 0
  var list = []
  var start = 0

  // gather tokens
  for (var i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          start = end = i + 1
        }
        break
      case 0x2c: /* , */
        list.push(str.substring(start, end))
        start = end = i + 1
        break
      default:
        end = i + 1
        break
    }
  }

  // final token
  list.push(str.substring(start, end))

  return list
}

function parseHttpDate (date) {
  var timestamp = date && Date.parse(date)

  return typeof timestamp === 'number'
    ? timestamp
    : NaN
}

function isConditionalGET (ctx) {
  return ctx.headers['if-match'] ||
    ctx.headers['if-unmodified-since'] ||
    ctx.headers['if-none-match'] ||
    ctx.headers['if-modified-since']
}

function isPreconditionFailure (ctx, etag, lastModified) {
  // if-match
  var match = ctx.headers['if-match']
  if (match) {
    return !etag || (match !== '*' && parseTokenList(match).every(function (match) {
      return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag
    }))
  }

  // if-unmodified-since
  var unmodifiedSince = parseHttpDate(ctx.headers['if-unmodified-since'])
  if (!isNaN(unmodifiedSince)) {
    return lastModified > unmodifiedSince
  }

  return false
}

function serveStatic(virtualPath, root, opt = {}, ...middlewares) {
  const hasEtag = opt.etag !== false
  const gzip = opt.gzip !== false

  return async function (ctx, next) {
    if (ctx.method === 'HEAD' || ctx.method === 'GET') {
      if (ctx.path.slice(0, virtualPath.length) === virtualPath) {
        let subpath = ctx.path.slice(virtualPath.length)
        const fullpath = path.join(root, subpath)

        let stats
        if (gzip && ctx.acceptsEncodings('gzip', 'identity') === 'gzip') {
          stats = await stat(fullpath + '.gz')
        }
        if (!stats) {
          stats = await stat(fullpath)
        }

        if (stats) {
          const etagVal = hasEtag ? etag(stats) : undefined
          if (isConditionalGET(ctx)) {
            if (isPreconditionFailure(ctx, etagVal, stats.mtime)) {
              ctx.throw(412)
              return
            }
        
            if (fresh(ctx.headers, {
              'etag': etagVal,
              'last-modified': stats.mtime.toUTCString()
            })) {
              ctx.status = 304
              return
            }
          }

          async function dummyNext() {}

          for (const func of middlewares) {
            await func(ctx, dummyNext);
          }

          ctx.response.etag = etagVal

          let actualRoot = root;
          if (subpath === '') {
            subpath = path.basename(virtualPath);
            actualRoot = path.dirname(root);
          }

          await send(ctx, subpath, {...opt, root: actualRoot})
          return
        }
      }
    }
    await next()
  }
}

module.exports = serveStatic
