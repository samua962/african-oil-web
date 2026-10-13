import nodemailer, { type Transporter } from 'nodemailer'

type Message = { to: string; subject: string; text: string; html: string; devLink?: string }

let transporter: Transporter | null | undefined

function getTransporter() {
  if (transporter !== undefined) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  transporter = SMTP_HOST
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT ?? 587),
        secure: Number(SMTP_PORT ?? 587) === 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        connectionTimeout: 15_000,
      })
    : null
  return transporter
}

// Sends via SMTP; without SMTP settings, links are printed to the console in development only.
export async function sendMail({ to, subject, text, html, devLink }: Message) {
  const mailer = getTransporter()
  if (mailer) {
    await mailer.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to, subject, text, html })
    return
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMTP is not configured.')
  }
  console.log(`[dev mail] To: ${to} | ${subject}\n  ${devLink ?? text}`)
}
