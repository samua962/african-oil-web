import 'dotenv/config'
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'

// Writes a compressed pg_dump to server/backups and prunes old files.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const url = new URL(databaseUrl)
const keepDays = Number(process.env.BACKUP_KEEP_DAYS ?? 14)
const directory = path.resolve(process.env.BACKUP_DIR ?? 'backups')
mkdirSync(directory, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = path.join(directory, `inventory-${stamp}.dump`)
const pgDump = process.env.PG_DUMP_PATH ?? 'pg_dump'

// The password goes through the environment so it never appears in the process list.
const child = spawn(pgDump, [
  '--format=custom',
  '--host', url.hostname,
  '--port', url.port || '5432',
  '--username', decodeURIComponent(url.username),
  '--dbname', decodeURIComponent(url.pathname.slice(1)),
  '--file', file,
], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, stdio: ['ignore', 'inherit', 'inherit'] })

child.on('error', (error) => {
  console.error(`Could not run pg_dump (${error.message}). Install PostgreSQL client tools or set PG_DUMP_PATH in server/.env.`)
  process.exit(1)
})

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`pg_dump failed with exit code ${code}.`)
    process.exit(code ?? 1)
  }
  console.log(`Backup saved to ${file}`)
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
  for (const name of readdirSync(directory)) {
    const candidate = path.join(directory, name)
    if (/^inventory-.*\.dump$/.test(name) && statSync(candidate).mtimeMs < cutoff) {
      unlinkSync(candidate)
      console.log(`Removed old backup ${name}`)
    }
  }
})
