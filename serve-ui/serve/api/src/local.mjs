// Run the exact Lambda handler on localhost so the React dev server has
// something to talk to. `npm run dev` in serve/api, then point
// VITE_API_BASE at http://localhost:8787.
import { createServer } from "node:http";
import { handler } from "./index.mjs";

const port = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  const result = await handler({
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    requestContext: { http: { method: req.method } },
  });

  res.writeHead(result.statusCode, result.headers);
  res.end(result.body);
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
