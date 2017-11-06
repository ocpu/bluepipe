const express = require('express')
const redis = require('redis')
const fs = require('fs')
const zlib = require('zlib')
const util = require('util')
const path = require('path')
const stylus = require('express-stylus')
const nib = require('nib')
const { parseMD } = require('./util')

const app = express()
const client = redis.createClient()
const readFile = util.promisify(fs.readFile)
const gzip     = util.promisify(zlib.gzip)
const redisGet = util.promisify(client.get).bind(client)
const redisSet = util.promisify(client.set).bind(client)

client.on('error', error => {
    console.error('Error ' + error)
})

app.use(stylus({
    src: path.join(process.cwd(), 'public'),
    use: [nib()],
    import: ['nib'],
    compress: true
}))
app.use(express.static(path.join(process.cwd(), 'public')))

app.get('/posts/:post', (req, res) => {
    res.send(req.params.post || '').status(200)
})

app.get('/', async (req, res) => {
    const page = await parsePage('index')
    res.set({
        'content-encoding': 'gzip',
        'content-type': 'text/html; charset=utf-8',
        'content-length': page.length,
        'cache-control': 'no-cache'
    }).send(await gzip(page || '')).status(200)
})

app.listen(process.env.PORT || 5000)

async function parsePage(page) {
    const shell = await getShell()
    const p = await getPage(page)
    return shell
        .replace("<!-- title -->", (p.info.title || '') + ' | Opencubes')
        .replace("<!-- Additional meta -->", 'meta' in p.info ? 
            Object.keys(p.info.meta)
                .map(key => [key, p.info.meta[key]])
                .reduce((all, [key, value]) => all + `<meta name="${key}" value="${value}">`, '') :
            ''
        )
        .replace("<!-- content goes here -->", p.html)
}

async function getPage(page) {
    return await new Promise(async (resolve, reject) => {
        try {
            let pageContent = await redisGet(page)
            if (!pageContent) {
                // console.log("Getting content for:", page)
                pageContent = await readFile(
                    path.resolve(process.cwd(), 'content', ...(page + ".md").split("/")),
                    'utf-8'
                )
                pageContent = await parseMD(pageContent)
                await redisSet(page, JSON.stringify(pageContent), 'EX', 10)
            }


            resolve(typeof pageContent === 'string' ? JSON.parse(pageContent) : pageContent)
        } catch (e) {
            console.error(e)
            resolve(void 0)
        }
    })
}

async function getShell() {
    return await new Promise(async(resolve, reject) => {
        try {
            let shell = await redisGet('shell')
            if (!shell) {
                shell = await readFile(path.join(process.cwd(), 'content', 'shell.html'), 'utf-8')
                // await redisSet('shell', shell)
            }
            
            resolve(shell)
        } catch (e) {
            console.error('Error ' + e)
            resolve(void 0)
        }
    })
}

