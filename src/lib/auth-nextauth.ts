/**
 * lib/auth-nextauth.ts — إعداد NextAuth v4.
 */
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { db } from './db'
import { verifyPassword } from './auth'

const providers: any[] = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      username: { label: 'اسم المستخدم', type: 'text' },
      password: { label: 'كلمة المرور', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.username || !credentials?.password) return null
      const username = String(credentials.username).trim()
      const password = String(credentials.password)
      const user = await db.user.findFirst({
        where: { OR: [{ username: { equals: username } }, { email: { equals: username.toLowerCase() } }] },
      })
      if (!user || !user.password) return null
      const valid = await verifyPassword(password, user.password)
      if (!valid) return null
      if (user.role === 'member') return null
      return { id: user.id, name: user.username, email: user.email, image: user.avatarUrl, role: user.role } as any
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }))
}

export const authOptions = {
  providers,
  session: { strategy: 'jwt' as const },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
    if (!secret) {
      throw new Error('NEXTAUTH_SECRET or JWT_SECRET environment variable is required')
    }
    return secret
  })(),
  pages: { signIn: '/admin/login' },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) { token.role = (user as any).role || 'member'; token.id = (user as any).id }
      return token
    },
    async session({ session, token }: any) {
      if (session?.user) { session.user.role = token.role; session.user.id = token.id }
      return session
    },
  },
}

export const authHandler = NextAuth(authOptions)
