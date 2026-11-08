import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import { applyChapterEdits, type ChapterEdit } from './chapterEdits'

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
    },
  }
}
