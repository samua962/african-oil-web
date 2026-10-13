import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { prisma } from '../lib/prisma.js'
import { issueToken } from '../lib/authTokens.js'
import { Client, createUser, loggedIn, password, resetDatabase, startServer } from './helpers.js'

describe('authentication', () => {
  let server: Awaited<ReturnType<typeof startServer>>

  before(async () => {
    await resetDatabase()
    server = await startServer()
  })
  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  it('locks an account after repeated failed logins', async () => {
    await createUser('CASHIER', 'locky')
    const client = new Client(server.base)
    for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(await client.login('locky', 'wrong-password-123'), 401)
    // Even the correct password is refused while locked.
    assert.equal(await client.login('locky'), 429)
  })

  it('resets a password once, revokes old sessions, and rejects expired tokens', async () => {
    const user = await createUser('CASHIER', 'resetter', { email: 'resetter@example.com', verified: true })
    const oldSession = await loggedIn(server.base, 'resetter')
    assert.equal((await oldSession.request('GET', '/api/auth/me')).status, 200)

    const token = await issueToken(user.id, 'PASSWORD_RESET', 'resetter@example.com')
    const newPassword = 'a-brand-new-passphrase'
    assert.equal((await new Client(server.base).request('POST', '/api/auth/reset-password', { token, password: newPassword })).status, 200)
    assert.equal((await new Client(server.base).request('POST', '/api/auth/reset-password', { token, password: 'another-passphrase-1' })).status, 400)

    assert.equal((await oldSession.request('GET', '/api/auth/me')).status, 401)
    assert.equal(await new Client(server.base).login('resetter', newPassword), 200)
    assert.equal(await new Client(server.base).login('resetter', password), 401)

    const expired = await issueToken(user.id, 'PASSWORD_RESET', 'resetter@example.com')
    await prisma.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await new Client(server.base).request('POST', '/api/auth/reset-password', { token: expired, password: 'yet-another-passphrase' })).status, 400)
  })

  it('answers forgot-password the same way for unknown emails', async () => {
    const response = await new Client(server.base).request('POST', '/api/auth/forgot-password', { email: 'nobody@example.com' })
    assert.equal(response.status, 200)
    assert.match(response.json.message, /If that email belongs/)
  })
})
