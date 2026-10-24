import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export const IDP_CLIENT_ID = "norish";

export type Identity = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  groups?: string[];
};

// A minimal OIDC provider. A test calls `authorize`; a browser's `/authorize`
// signs in as `signInAs`, or cancels while that is null.
export function createIdentityProvider() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rogueKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test", alg: "RS256", use: "sig" };
  const grants = new Map<string, { identity: Identity; nonce: string | null; forged: boolean }>();
  const tokenRequests: URLSearchParams[] = [];
  let issuer = "";
  let hanging = false;
  let signInAs: Identity | null = null;
  let promptValues: string[] | undefined;

  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signIdToken = (claims: Record<string, unknown>, key = privateKey) => {
    const input = `${encode({ alg: "RS256", kid: "test", typ: "JWT" })}.${encode(claims)}`;

    return `${input}.${sign("sha256", Buffer.from(input), key).toString("base64url")}`;
  };

  /** The user signs in at the provider, which sends them back with a code. */
  const authorize = (authorizationUrl: URL, identity: Identity, { forged = false } = {}) => {
    const code = randomUUID();

    grants.set(code, { identity, nonce: authorizationUrl.searchParams.get("nonce"), forged });

    const callback = new URL(authorizationUrl.searchParams.get("redirect_uri") ?? "");

    callback.searchParams.set("code", code);
    callback.searchParams.set("state", authorizationUrl.searchParams.get("state") ?? "");

    return callback;
  };

  const server = createServer(async (req, res) => {
    // A provider that takes the connection and never answers.
    if (hanging) return;

    const url = new URL(req.url ?? "/", issuer);
    const json = (body: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/.well-known/openid-configuration") {
      return json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
        end_session_endpoint: `${issuer}/logout`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        ...(promptValues ? { prompt_values_supported: promptValues } : {}),
      });
    }

    if (url.pathname === "/authorize") {
      let location: URL;

      if (signInAs) {
        location = authorize(url, signInAs);
      } else {
        location = new URL(url.searchParams.get("redirect_uri") ?? "");
        location.searchParams.set("error", "access_denied");
        location.searchParams.set("state", url.searchParams.get("state") ?? "");
      }

      return res.writeHead(302, { location: location.toString() }).end();
    }

    if (url.pathname === "/jwks") return json({ keys: [jwk] });

    if (url.pathname === "/token") {
      let body = "";

      for await (const chunk of req) body += chunk;

      const params = new URLSearchParams(body);
      const grant = grants.get(params.get("code") ?? "");

      tokenRequests.push(params);

      if (!grant) {
        res.writeHead(400, { "content-type": "application/json" });

        return res.end(JSON.stringify({ error: "invalid_grant" }));
      }

      const now = Math.floor(Date.now() / 1000);

      return json({
        access_token: `access-${grant.identity.sub}`,
        token_type: "Bearer",
        expires_in: 3600,
        id_token: signIdToken(
          {
            iss: issuer,
            aud: IDP_CLIENT_ID,
            iat: now,
            exp: now + 300,
            ...(grant.nonce ? { nonce: grant.nonce } : {}),
            ...grant.identity,
          },
          grant.forged ? rogueKey : privateKey
        ),
      });
    }

    if (url.pathname === "/userinfo") {
      const sub = req.headers.authorization?.replace("Bearer access-", "");
      const grant = [...grants.values()].find((candidate) => candidate.identity.sub === sub);

      return json(grant?.identity ?? {});
    }

    res.writeHead(404).end();
  });

  return {
    tokenRequests,
    authorize,
    get listening() {
      return server.listening;
    },
    set hanging(value: boolean) {
      hanging = value;
    },
    /** The `prompt` values discovery lists; none listed, as Authentik does, while unset. */
    set promptValues(values: string[] | undefined) {
      promptValues = values;
    },
    set signInAs(identity: Identity | null) {
      signInAs = identity;
    },
    async start(port = 0) {
      await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
      issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      return issuer;
    },
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

export type IdentityProvider = ReturnType<typeof createIdentityProvider>;
