import { Router, type IRouter } from "express";
import { POST as generate } from "../lib/pillar/generate";
import { POST as regenerate } from "../lib/pillar/regenerate";
import { POST as suggest } from "../lib/pillar/suggest";

const router: IRouter = Router();

// Preserve the imported handlers' Web Request/Response contract while serving
// them from Express instead of Vercel functions or a development-only shim.
for (const [path, handler] of Object.entries({ generate, regenerate, suggest })) {
  router.post(`/${path}`, async (req, res): Promise<void> => {
    try {
      const request = new Request(`http://pillar.internal/api/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body ?? {}),
      });
      const response = await handler(request);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      req.log.error({ err }, "Pillar API request failed");
      res.status(400).json({ error: "Invalid request body." });
    }
  });
  router.all(`/${path}`, (_req, res): void => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
  });
}

export default router;
