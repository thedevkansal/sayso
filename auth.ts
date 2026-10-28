import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Live mode auth. Least privilege: read mail, send mail, write calendar events.
 * Tokens live only in the encrypted, httpOnly session cookie (JWT strategy, no database)
 * and are read server-side with getToken(); the client-visible session carries no tokens.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

type GoogleTokens = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // seconds since epoch
  scope?: string;
  error?: "refresh_failed";
};

async function refresh(token: GoogleTokens): Promise<GoogleTokens> {
  if (!token.refreshToken) return { ...token, error: "refresh_failed" };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "refresh failed");
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600),
      // Google only returns a new refresh token sometimes.
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    // Common in Testing mode: refresh tokens expire after about 7 days.
    return { ...token, error: "refresh_failed" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: GOOGLE_SCOPES.join(" "),
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/connect", error: "/connect" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          scope: account.scope,
        };
      }
      const t = token as typeof token & GoogleTokens;
      if (t.expiresAt && Date.now() / 1000 < t.expiresAt - 60) return token;
      return { ...token, ...(await refresh(t)) };
    },
    async session({ session, token }) {
      const t = token as typeof token & GoogleTokens;
      // Only flags reach the browser, never tokens.
      return {
        ...session,
        error: t.error,
        scopesOk: GOOGLE_SCOPES.slice(3).every((s) => t.scope?.includes(s)),
      };
    },
  },
});
