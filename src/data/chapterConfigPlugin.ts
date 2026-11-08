import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import { applyChapterEdits, type ChapterEdit } from './chapterEdits'
import { applyDualMark, type DualItem } from './dualSpreads'

interface StoredChapter {
  leftImageUrl?: string
  chapterName?: string
  num?: number
  pages?: string[]
}

const FILES: Record<string, string> = {
  main: 'src/data/book1-chapters.json',
  summer: 'src/data/book2-chapters.json',
  school: 'src/data/book3-chapters.json',
}

const DUAL_FILES: Record<string, string> = {
  main: 'src/data/book1-dual-pictures.json',
  summer: 'src/data/book2-dual-pictures.json',
  school: 'src/data/book3-dual-pictures.json',
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function chapterConfigPlugin(): Plugin {
  return {
    name: 'chapter-config',
    configureServer(server) {
      server.middlewares.use('/__config/chapters', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 404
          res.end()
          return
        }
        void (async () => {
          try {
            const body = JSON.parse(await readBody(req)) as {
              part?: string
              chapters?: ChapterEdit[]
            }
            const rel = body.part ? FILES[body.part] : undefined
            if (!rel || !Array.isArray(body.chapters)) throw new Error('请求无效')
            const full = path.resolve(server.config.root, rel)
            const current = JSON.parse(fs.readFileSync(full, 'utf8')) as StoredChapter[]
            if (!Array.isArray(current)) throw new Error('章节文件格式不对')
            const next = applyChapterEdits(current, body.chapters)
            fs.writeFileSync(full, `${JSON.stringify(next, null, 2)}\n`)
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: true }))
          } catch (error) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : '保存失败',
              }),
            )
          }
        })()
      })

      server.middlewares.use('/__config/dual', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 404
          res.end()
          return
        }
        void (async () => {
          try {
            const body = JSON.parse(await readBody(req)) as {
              part?: string
              leftImageUrl?: string
              rightImageUrl?: string
              marked?: boolean
            }
            const rel = body.part ? DUAL_FILES[body.part] : undefined
            if (!rel || typeof body.leftImageUrl !== 'string' || typeof body.rightImageUrl !== 'string') {
              throw new Error('请求无效')
            }
            if (!body.leftImageUrl.startsWith('/image/') || !body.rightImageUrl.startsWith('/image/')) {
              throw new Error('页面路径无效')
            }
            const full = path.resolve(server.config.root, rel)
            const current = JSON.parse(fs.readFileSync(full, 'utf8')) as DualItem[]
            if (!Array.isArray(current)) throw new Error('双页图文件格式不对')
            const next = applyDualMark(
              current,
              { leftImageUrl: body.leftImageUrl, rightImageUrl: body.rightImageUrl },
              Boolean(body.marked),
            )
            fs.writeFileSync(full, `${JSON.stringify(next, null, 2)}\n`)
            server.ws.send({
              type: 'custom',
              event: 'dual:updated',
              data: { part: body.part, items: next },
            })
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: true, marked: Boolean(body.marked), count: next.length }))
          } catch (error) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : '保存失败',
              }),
            )
          }
        })()
      })
    },
  }
}
