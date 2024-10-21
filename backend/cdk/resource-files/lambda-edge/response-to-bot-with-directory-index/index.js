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

const LOCALES = @{LOCALES};

const generateContent = ({ lang, toolName, toolMessages, requestUrl, imageUrl }) => {
  const siteName = LOCALES[lang].common.title
  return `
    <!doctype html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/png" sizes="16x16" href="/img/${toolName}/16.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/img/${toolName}/32.png">
      <link rel="apple-touch-icon" sizes="180x180" href="/img/${toolName}/180.png">
      <meta name="description" content="${toolMessages.description}">
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="${LOCALES[lang].localeName}" />
      <meta property="og:site_name" content="${siteName}" />
      <meta property="og:title" content="${toolMessages.title} - ${siteName}" />
      <meta property="og:url" content="${requestUrl}" />
      <meta property="og:image" content="${imageUrl}" />
      <meta property="og:description" content="${toolMessages.description}" />
      <meta name="note:card" content="summary_large_image" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="${imageUrl}" />
      <meta name="robots" content="all">
      <title>${toolMessages.title} - ${siteName}</title>
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

  let lang = 'ja';
  const uriLang = uri.split('/')[1];
  if (Object.keys(LOCALES).includes(uriLang)) {
    lang = uriLang;
  }

  const tools = LOCALES[lang]["tools"]

  const isBot = BOTS.some((v) => userAgent.includes(v));
  if (isBot && queryString) {
    const toolName = Object.keys(tools).find((tool) => uri.includes("/" + tool));
    if (toolName) {
      const toolMessages = tools[toolName];
      const imageUrl = `https://@{DOMAIN_NAME_OGP}${uri}?${queryString}`;
      const requestUrl = `${URL_DIST}${uri}?${queryString}`;

      const body = generateContent({ lang, toolName, toolMessages, requestUrl, imageUrl });

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
