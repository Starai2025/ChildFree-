import {
  errorCodes,
  requestSchema,
  snapshotSchema,
} from "../../../packages/domain/src/index.ts";

export interface AuthGateway {
  getUser(): Promise<{ authenticated: boolean; anonymous: boolean }>;
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<
    { data: unknown; error: { message: string; code: string } | null }
  >;
}
export interface HandlerConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  allowedOrigins?: string;
}
export function createHandler(
  config: HandlerConfig,
  factory: (authorization: string) => AuthGateway,
) {
  return async (request: Request) => {
    const origin = request.headers.get("origin");
    const allowed = (config.allowedOrigins ?? "").split(",").filter(Boolean);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
    };
    if (origin && allowed.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] =
        "authorization, apikey, content-type, x-client-info";
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    }
    const fail = (code: typeof errorCodes[number], status: number) =>
      new Response(JSON.stringify({ ok: false, code }), { status, headers });
    if (origin && !allowed.includes(origin)) return fail("RESTRICTED", 403);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") return fail("INVALID_INPUT", 405);
    const authorization = request.headers.get("authorization");
    if (!authorization?.match(/^Bearer \S+$/)) {
      return fail("UNAUTHENTICATED", 401);
    }
    const url = config.supabaseUrl;
    const key = config.supabaseKey;
    if (!url || !key) return fail("PROVIDER_UNAVAILABLE", 503);
    try {
      if (Number(request.headers.get("content-length") ?? 0) > 16384) {
        return fail("INVALID_INPUT", 413);
      }
      const reader = request.body?.getReader();
      if (!reader) return fail("INVALID_INPUT", 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 16384) {
            await reader.cancel();
            return fail("INVALID_INPUT", 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const body = new TextDecoder().decode(bytes);
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return fail("INVALID_INPUT", 400);
      }
      const parsed = requestSchema.safeParse(json);
      if (!parsed.success) return fail("INVALID_INPUT", 400);
      const client = factory(authorization);
      const user = await client.getUser();
      if (!user.authenticated || user.anonymous) {
        return fail("UNAUTHENTICATED", 401);
      }
      const input = parsed.data;
      const operation = (() => {
        switch (input.action) {
          case "bootstrap":
            return { name: "api_onboarding", args: {} };
          case "eligibility":
            return {
              name: "api_eligibility",
              args: {
                p_dob: input.dob,
                p_answers: input.answers,
                p_policy_version: input.policy_version,
              },
            };
          case "pledge_accept":
            return {
              name: "api_accept_pledge",
              args: { p_version: input.version },
            };
          case "draft_save":
            return {
              name: "api_save_draft",
              args: {
                p_fields: input.fields,
                p_expected_revision: input.expected_revision,
              },
            };
          case "profile_save":
            return {
              name: "api_save_profile",
              args: {
                p_fields: input.fields,
                p_expected_revision: input.expected_revision,
              },
            };
          case "profile_submit":
            return {
              name: "api_submit_profile",
              args: { p_revision: input.revision },
            };
        }
      })();
      const { data, error } = await client.rpc(operation.name, operation.args);
      if (error) {
        const code = errorCodes.find((code) => code === error.message) ??
          (error.code.startsWith("22")
            ? "INVALID_INPUT"
            : "PROVIDER_UNAVAILABLE");
        return fail(
          code,
          code === "CONFLICT"
            ? 409
            : code === "PROVIDER_UNAVAILABLE"
            ? 503
            : 403,
        );
      }
      const state = snapshotSchema.safeParse(data);
      if (!state.success) return fail("PROVIDER_UNAVAILABLE", 503);
      return new Response(JSON.stringify({ ok: true, data: state.data }), {
        status: 200,
        headers,
      });
    } catch {
      // Never emit DOB, answers, tokens, payloads or database errors to logs/responses.
      return fail("PROVIDER_UNAVAILABLE", 503);
    }
  };
}
