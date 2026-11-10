import { z } from "zod";
import { apiOrigin } from "../../../lib/api";
import { resources } from "../../../lib/resources";

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [resource, id] = path;
  if (
    (!Object.hasOwn(resources, resource) &&
      !(resource === "operator" && path.length === 1) &&
      !(resource === "timetables" && path.length === 2)) ||
    path.length > 2 ||
    (id && !z.uuid().safeParse(id).success)
  ) {
    return Response.json(
      { error: { message: "Endpoint not found." } },
      { status: 404 },
    );
  }

  const write = request.method === "POST" || request.method === "PUT";
  if (
    write &&
    request.headers.get("content-type")?.split(";")[0] !== "application/json"
  ) {
    return Response.json(
      { error: { message: "Send a JSON request body." } },
      { status: 415 },
    );
  }

  try {
    const target = new URL(`/api/${path.join("/")}`, apiOrigin());
    target.search = new URL(request.url).search;
    const headers = new Headers();
    const authorization = request.headers.get("authorization");
    if (authorization) headers.set("authorization", authorization);
    if (write) headers.set("content-type", "application/json");
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(write
        ? {
            body: request.body,
            duplex: "half" as const,
          }
        : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const contentType = upstream.headers.get("content-type");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "cache-control": "no-store",
        ...(contentType ? { "content-type": contentType } : {}),
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          message:
            "The academic records service is unavailable. Try again shortly.",
        },
      },
      { status: 503 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
