const fs = require("fs");
const path = require("path");
const files = {
  "lib/prisma.ts": `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
`,
  "auth.ts": `import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const expectedUser = process.env.APP_ADMIN_USER;
        const hash = process.env.APP_ADMIN_PASSWORD_HASH;
        if (!credentials?.username || !credentials?.password || !expectedUser || !hash) {
          return null;
        }
        if (String(credentials.username) !== expectedUser) return null;
        const ok = await bcrypt.compare(String(credentials.password), hash);
        if (!ok) return null;
        return { id: "admin", name: "Administrador" };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
`,
  "middleware.ts": `import { auth } from "@/auth";

export default auth((req) => {
  const logged = !!req.auth;
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  if (!logged && !isLogin) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (logged && isLogin) {
    return Response.redirect(new URL("/empleados", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
`,
  "app/api/auth/[...nextauth]/route.ts": `import { handlers } from "@/auth";

export const { GET, POST } = handlers;
`,
  "types/next-auth.d.ts": `import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id?: string };
  }
}
`,
};
for (const [rel, content] of Object.entries(files)) {
  const p = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}
console.log("wrote", Object.keys(files).length, "files");