const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
dotenv.config({ path: path.resolve(__dirname, `../${envFile}`) })

const domain = `https://${process.env.VITE_DISTRIBUTION_DOMAIN_NAME}`

const typedRouterPath = path.resolve(__dirname, '../src/router/index.ts')
const fileContent = fs.readFileSync(typedRouterPath, 'utf8')

const routes = []
const regex = /path:\s*['"`]([^'"`]+)['"`]/gm
let match

while ((match = regex.exec(fileContent)) !== null) {
  routes.push(match[1].trim())
}

const excludedRoutes = ['/:pathMatch(.*)*']
const filteredRoutes = routes.filter(route => !excludedRoutes.includes(route))

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${filteredRoutes
  .map(route => {
    return `
  <url>
    <loc>${domain}${route}</loc>
  </url>`
  })
  .join('')}
</urlset>`

const sitemapOutputPath = path.resolve(__dirname, '../public/sitemap.xml')
fs.writeFileSync(sitemapOutputPath, sitemap)

const robotsTxt = `User-agent: *
Disallow:

Sitemap: ${domain}/sitemap.xml`

const robotsTxtOutputPath = path.resolve(__dirname, '../public/robots.txt')
fs.writeFileSync(robotsTxtOutputPath, robotsTxt)
