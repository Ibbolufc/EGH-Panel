import rateLimit from "express-rate-limit";

/** General API rate limiter — 200 req/min per IP */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

/** Auth-specific limiter — 10 attempts/min per IP */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

/**
 * Install-script limiter — 15 req/min per IP.
 *
 * The install.sh endpoint is public and token-authenticated. A lower limit
 * than the global 200/min makes brute-forcing the 192-bit registration token
 * impractical while still allowing legitimate retries during deploy pipelines.
 * The error body is valid bash so `curl … | sudo bash` fails with a clear message.
 */
export const installScriptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, res) {
    res
      .status(429)
      .setHeader("Content-Type", "text/x-shellscript")
      .send(
        "#!/usr/bin/env bash\n# Error: too many requests — wait a minute and try again\necho 'Error: rate limit exceeded, try again in 60 seconds' >&2\nexit 1\n"
      );
  },
});
