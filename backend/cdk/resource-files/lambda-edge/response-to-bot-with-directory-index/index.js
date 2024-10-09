const URL_DIST = 'https://@{DOMAIN_NAME_DIST}';
const BOTS = [
  'Twitterbot',
  'facebookexternalhit',
  'line-poker',
  'Discordbot',
  'SkypeUriPreview',
  'Slackbot-LinkExpanding',
  'PlurkBot',
  'notebot',
  'Iframely/1.3.1', // Notion
];

const SITE_NAME = '@{APP_TITLE}';
const TOOLS = @{TOOLS_DEFINITION};

const generateContent = ({tool, requestUrl, imageUrl}) => {
  return `
    <!doctype html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/png" sizes="16x16" href="/img/${tool.iconDir}/16.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/img/${tool.iconDir}/32.png">
      <link rel="apple-touch-icon" sizes="180x180" href="/img/${tool.iconDir}/180.png">
      <meta name="description" content="${tool.description}">
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="ja_JP" />
      <meta property="og:site_name" content="${SITE_NAME}" />
      <meta property="og:title" content="${tool.title} - ${SITE_NAME}" />
      <meta property="og:url" content="${requestUrl}" />
      <meta property="og:image" content="${imageUrl}" />
      <meta property="og:description" content="${tool.description}" />
      <meta name="note:card" content="summary_large_image" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="${imageUrl}" />
      <meta name="robots" content="all">
      <title>${tool.title} - ${SITE_NAME}</title>
    </head>
    <body>
    </body>
    </html>
  `;
};

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const queryString = request.querystring;
  const userAgent = request.headers['user-agent'][0].value;

  console.log('URL: ' + uri + ', UA: ' + userAgent + ', QS: ' + queryString);

  const isBot = BOTS.some((v) => userAgent.includes(v));
  if (isBot && queryString) {
    const toolKey = Object.keys(TOOLS).find(key => uri.includes(TOOLS[key].params.path));
    if (toolKey) {
      const tool = TOOLS[toolKey].params;
      const imageUrl = `https://@{DOMAIN_NAME_OGP}${uri}?${queryString}`;
      const requestUrl = `${URL_DIST}${uri}?${queryString}`;

      const body = generateContent({tool, requestUrl, imageUrl});

      return {
        status: '200',
        statusDescription: 'OK',
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/html' }],
        },
        body,
      };
    }
  }

  // Directory Index
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri += '/index.html';
  }

  return request;
};
