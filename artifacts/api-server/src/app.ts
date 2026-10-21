import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { trustedOrigin } from "./modules/access/origin";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use((req, res, next) => {
  const origin = req.header("origin");
  if (origin && !trustedOrigin(origin, req.header("host"), process.env.CORS_ALLOWED_ORIGINS)) {
    res.status(403).json({ error: "Origin not allowed" }); return;
  }
  next();
});
app.use(cors({ credentials: true, origin: true }));
// Spreadsheet rows are sent as JSON by the browser. Keep enough headroom for
// realistic catalogues while still bounding request memory usage.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Resolve publishable key from the incoming request host
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Keep API failures JSON-shaped. Without this, Vercel/Express may return an
// HTML error page and the frontend reports the misleading `Unexpected token <`.
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error }, "Request failed");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
