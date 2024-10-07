'use strict';

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;

  if (uri.endsWith('/')) {
      request.uri += 'index.html';
  }
  else if (!uri.split('/').pop().includes('.')) {
      request.uri += '/index.html';
  }

  return request;
};
