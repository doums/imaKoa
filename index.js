import '@babel/polyfill'
import Koa from 'koa'
import Router from 'koa-router'
import koaBody from 'koa-body'
import serve from 'koa-static'
import fs from 'fs'
import path from 'path'

const IMAGES_DIR = path.join(__dirname, './images')

const app = new Koa()
const router = new Router()

fs.access(IMAGES_DIR, fs.constants.F_OK | fs.constants.W_OK, err => {
  if (err && err.code === 'ENOENT') {
    fs.mkdirSync(IMAGES_DIR)
  } else if (err) {
    console.error(`${IMAGES_DIR} is read-only`)
  }
})

app.on('error', err => {
  console.log('server error', err)
})

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = err.message
    ctx.app.emit('error', err, ctx)
  }
})

// CORS's needs
app.use(async (ctx, next) => {
  ctx.set('Access-Control-Allow-Origin', '*')
  ctx.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE, PATCH')
  ctx.set('Access-Control-Allow-Headers', 'Content-Type')
  await next()
})

// accept CORS preflight request
router.options('/', ctx => {
  ctx.status = 200
})

router.put('/image', koaBody({ multipart: true }), ctx => {
  const files = ctx.request.files
  if (!files) {
    ctx.throw(400, 'no image sent!')
  }
  const file = files[Object.keys(files)[0]]
  if (!file.type.startsWith('image/')) {
    ctx.throw(415, 'images only!')
  }
  const reader = fs.createReadStream(file.path)
  const stream = fs.createWriteStream(path.join(IMAGES_DIR, file.name))
  reader.pipe(stream)
  console.log('uploading %s -> %s', file.name, stream.path)
  ctx.status = 201
})

/* todo replace by http method DELETE (router.del(...)) when koa-body will have fixed it
    see https://github.com/dlau/koa-body/issues/133 */
router.post('/image', koaBody(), ctx => {
  if (ctx.is('json')) {
    const { name } = ctx.request.body
    if (!name) {
      ctx.throw(400, 'expected payload: { name: "image_name" }')
    }
    try {
      fs.unlinkSync(`${IMAGES_DIR}/${name}`, err => {
        if (err) {
          ctx.throw(500, `error while deleting file "${name}"`)
        }
      })
    } catch (e) {
      if (e.code !== 'ENOENT') {
        ctx.throw(500, `error while deleting file "${name}"`)
      }
    }
    ctx.status = 200
  } else {
    ctx.throw(415, 'json only!')
  }
})

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(2001, () => console.log('listening on port 2001'))