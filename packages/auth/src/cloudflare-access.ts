import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import {
	createRemoteJWKSet,
	errors,
	type JWTVerifyGetKey,
	jwtVerify,
} from "jose";
import { z } from "zod";

export const CLOUDFLARE_ACCESS_SIGN_IN_PATH = "/cloudflare-access/sign-in";

export const CLOUDFLARE_ACCESS_ASSERTION_HEADER = "cf-access-jwt-assertion";

export type CloudflareAccessConfig = {
	teamDomain: string;
	audience: string;
};

export type CloudflareAccessVerifier = (
	assertion: string,
) => Promise<string | null>;

const accessClaims = z.object({ email: z.email() });

export function cloudflareAccessKeys(
	config: CloudflareAccessConfig,
): JWTVerifyGetKey {
	return createRemoteJWKSet(
		new URL(`https://${config.teamDomain}/cdn-cgi/access/certs`),
	);
}

export function cloudflareAccessVerifier(
	config: CloudflareAccessConfig,
	keys: JWTVerifyGetKey = cloudflareAccessKeys(config),
): CloudflareAccessVerifier {
	const issuer = `https://${config.teamDomain}`;

	return async (assertion) => {
		try {
			const { payload } = await jwtVerify(assertion, keys, {
				issuer,
				audience: config.audience,
				algorithms: ["RS256"],
			});
			const claims = accessClaims.safeParse(payload);
			return claims.success ? claims.data.email.toLowerCase() : null;
		} catch (cause) {
			if (cause instanceof errors.JOSEError) return null;
			throw cause;
		}
	};
}

export function cloudflareAccess(
	config: CloudflareAccessConfig & { appUrl: string },
	verify: CloudflareAccessVerifier = cloudflareAccessVerifier(config),
) {
	return {
		id: "cloudflare-access",
		endpoints: {
			cloudflareAccessSignIn: createAuthEndpoint(
				CLOUDFLARE_ACCESS_SIGN_IN_PATH,
				{ method: "GET", requireHeaders: true },
				async (ctx) => {
					const assertion = ctx.headers.get(CLOUDFLARE_ACCESS_ASSERTION_HEADER);
					const email = assertion ? await verify(assertion) : null;
					if (!email) {
						throw new APIError("UNAUTHORIZED", {
							message:
								"Cloudflare Access did not vouch for this request. Open the CRM through its Access-protected address.",
						});
					}

					const found =
						await ctx.context.internalAdapter.findUserByEmail(email);
					const user =
						found?.user ??
						(await ctx.context.internalAdapter.createUser({
							email,
							name: email.split("@")[0] ?? email,
							emailVerified: true,
						}));

					const session = await ctx.context.internalAdapter.createSession(
						user.id,
					);
					await setSessionCookie(ctx, { session, user });

					throw ctx.redirect(config.appUrl);
				},
			),
		},
	} satisfies BetterAuthPlugin;
}
