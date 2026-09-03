// The same plain HTTP server for both local dev and Cloud Run: Cloud Run just
// needs a container listening on $PORT, and `handler` doesn't know or care
// which platform is calling it.
import { createServer } from "node:http";
import { handler } from "./index.mjs";

const port = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  const result = await handler({
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    requestContext: { http: { method: req.method } },
    headers: req.headers,
  });

  res.writeHead(result.statusCode, result.headers);
  res.end(result.body);
}).listen(port, () => console.log(`API listening on port ${port}`));
