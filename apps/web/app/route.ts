import { timetableHtml, timetablePolicy } from "../lib/timetable";

export const dynamic = "force-static";

export function GET() {
  return new Response(timetableHtml, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": timetablePolicy,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
