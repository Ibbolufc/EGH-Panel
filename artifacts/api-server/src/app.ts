import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app: Express = express();

app.set("trust proxy", 1);
app.set("etag", false);

app.use((req, res, next) => {
  // Prevent browsers/proxies from sending conditional cache validators
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];

  // Remove any cache validator headers and disable caching for API responses
  res.removeHeader("ETag");
  res.removeHeader("Last-Modified");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
});

app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(
  cors({
    origin: process.env["CORS_ORIGIN"] ?? true,
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(apiLimiter);

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;