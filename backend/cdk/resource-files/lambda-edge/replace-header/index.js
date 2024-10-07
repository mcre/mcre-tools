'use strict';

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const queryString = request.querystring;

    const response = event.Records[0].cf.response;
    if (!queryString) {
      return response;
    }

    let body = response.body;

    const uriPath = request.uri;
    const host = request.headers.host[0].value;
    const scheme = 'https';

    const ogpUrlBase = 'https://@{DOMAIN_NAME_OGP}';
    const ogpUrl = `${ogpUrlBase}${uriPath}?${queryString}`;
    const requestUrl = `${scheme}://${host}${uriPath}?${queryString}`;

    body = body.replace(/(<meta[^>]+id="og-url"[^>]+content=")[^"]+("[^>]*>)/, `$1${requestUrl}$2`);
    body = body.replace(/(<meta[^>]+id="og-image"[^>]+content=")[^"]+("[^>]*>)/, `$1${ogpUrl}$2`);
    body = body.replace(/(<meta[^>]+id="tw-card"[^>]+content=")[^"]+("[^>]*>)/, '$1summary_large_image$2');
    body = body.replace(/(<meta[^>]+id="tw-image"[^>]+content=")[^"]+("[^>]*>)/, `$1${ogpUrl}$2`);

    response.body = body;

    return response;
};
