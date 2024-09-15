'use strict'
exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request
  if (
    request.headers['x-prerender-token'] &&
    request.headers['x-prerender-host'] &&
    request.headers['x-query-string']
  ) {
    request.querystring = request.headers['x-query-string'][0].value
    request.origin = {
      custom: {
        domainName: 'service.prerender.io',
        port: 443,
        protocol: 'https',
        readTimeout: 20,
        keepaliveTimeout: 5,
        customHeaders: {},
        sslProtocols: ['TLSv1', 'TLSv1.1'],
        path: '/https%3A%2F%2F' + request.headers['x-prerender-host'][0].value
      }
    }
  }
  callback(null, request)
}
