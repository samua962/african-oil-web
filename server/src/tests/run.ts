import 'dotenv/config'
import { spawnSync } from 'node:child_process'

// Runs the suite in an isolated Postgres schema so real shop data is never touched.
const base = process.env.DATABASE_URL
if (!base) {
  console.error('DATABASE_URL is not set in server/.env.')
  process.exit(1)
}

const url = new URL(base)
url.searchParams.set('schema', 'inventory_test')
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  NODE_ENV: 'test',
  // Keep tests from sending real email.
  SMTP_HOST: '',
}

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit', shell: true })
if (migrate.status !== 0) process.exit(migrate.status ?? 1)

const tests = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'src/tests/auth.test.ts', 'src/tests/sales.test.ts', 'src/tests/purchasing.test.ts'], { env, stdio: 'inherit' })
process.exit(tests.status ?? 1)
