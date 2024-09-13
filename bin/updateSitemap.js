const fs = require('fs')
const path = require('path')

const typedRouterPath = path.resolve(__dirname, '../src/typed-router.d.ts')
const fileContent = fs.readFileSync(typedRouterPath, 'utf8')

const routes = []
const regex = /^\s*'\/[^']*'/gm
let match

while ((match = regex.exec(fileContent)) !== null) {
  routes.push(match[0].replace(/'/g, '').trim())
}

const excludedRoutes = ['/not-found']

const filteredRoutes = routes.filter(route => !excludedRoutes.includes(route))

const domain = 'https://tools.mcre.info'
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

const outputPath = path.resolve(__dirname, '../public/sitemap.xml')
fs.writeFileSync(outputPath, sitemap)
