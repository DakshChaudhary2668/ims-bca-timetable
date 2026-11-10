import { timetableAssets } from "../../../lib/timetable";

type Asset = keyof typeof timetableAssets;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(timetableAssets).map((asset) => ({ asset }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  if (!Object.hasOwn(timetableAssets, asset)) {
    return new Response(null, { status: 404 });
  }

  const { body, contentType } = timetableAssets[asset as Asset];
  return new Response(body, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
