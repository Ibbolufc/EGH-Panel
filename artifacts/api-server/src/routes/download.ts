import { Router } from "express";
import https from "https";
import http from "http";

const router: Router = Router();

const WINGS_RELEASE_URL =
  "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64";

const ALLOWED_REDIRECT_HOSTS = [
  "github.com",
  "objects.githubusercontent.com",
  "codeload.github.com",
  "releases.githubusercontent.com",
];

const DOWNLOAD_TIMEOUT_MS = 30_000;

function isAllowedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_REDIRECT_HOSTS.some(
      (allowed) => hostname === allowed || hostname.endsWith("." + allowed)
    );
  } catch {
    return false;
  }
}

function fetchWithRedirects(
  url: string,
  res: import("express").Response,
  redirectCount = 0
): void {
  if (redirectCount > 10) {
    res.status(502).json({ error: "Too many redirects fetching binary" });
    return;
  }

  if (!isAllowedHost(url)) {
    res.status(502).json({ error: "Redirect target is not an allowed host" });
    return;
  }

  const lib = url.startsWith("https://") ? https : http;

  const req = lib.get(url, (upstream) => {
    const { statusCode, headers } = upstream;

    if (
      statusCode &&
      statusCode >= 300 &&
      statusCode < 400 &&
      headers.location
    ) {
      upstream.resume();
      fetchWithRedirects(headers.location, res, redirectCount + 1);
      return;
    }

    if (!statusCode || statusCode < 200 || statusCode >= 300) {
      upstream.resume();
      res.status(502).json({ error: `Upstream returned ${statusCode}` });
      return;
    }

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="egh-node"'
    );
    res.setHeader("Content-Type", "application/octet-stream");

    if (headers["content-length"]) {
      res.setHeader("Content-Length", headers["content-length"]);
    }

    upstream.pipe(res);
  });

  req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
    req.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: "Timed out fetching binary from upstream" });
    }
  });

  req.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch binary: " + err.message });
    }
  });
}

router.get("/download/egh-node", (_req, res) => {
  fetchWithRedirects(WINGS_RELEASE_URL, res);
});

export default router;
