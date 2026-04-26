import { Router } from "express";
import https from "https";
import http from "http";

const router: Router = Router();

/**
 * Pinned EGH Node (Wings) binary version.
 * Change this constant and redeploy to update the binary version served to nodes.
 */
export const PINNED_VERSION = "v1.11.13";

/**
 * GitHub release downloads may redirect through a few different asset hosts.
 * We allow only known GitHub-owned hosts here.
 */
const ALLOWED_REDIRECT_HOSTS = [
  "github.com",
  "githubusercontent.com",
  "objects.githubusercontent.com",
  "codeload.github.com",
  "releases.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "objects-origin.githubusercontent.com",
];

const DOWNLOAD_TIMEOUT_MS = 30_000;

function buildWingsUrl(): string {
  return `https://github.com/pterodactyl/wings/releases/download/${PINNED_VERSION}/wings_linux_amd64`;
}

function isAllowedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_REDIRECT_HOSTS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function resolveRedirect(currentUrl: string, location: string): string {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return location;
  }
}

function fetchWithRedirects(
  url: string,
  res: import("express").Response,
  redirectCount = 0,
): void {
  if (redirectCount > 10) {
    res.status(502).json({ error: "Too many redirects fetching binary" });
    return;
  }

  if (!isAllowedHost(url)) {
    res.status(502).json({ error: "Redirect target is not an allowed host", url });
    return;
  }

  const lib = url.startsWith("https://") ? https : http;

  const req = lib.get(
    url,
    {
      headers: {
        "User-Agent": "EGH-Panel/1.0",
        Accept: "application/octet-stream,*/*",
      },
    },
    (upstream) => {
      const { statusCode, headers } = upstream;

      if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
        upstream.resume();
        const nextUrl = resolveRedirect(url, headers.location);
        fetchWithRedirects(nextUrl, res, redirectCount + 1);
        return;
      }

      if (!statusCode || statusCode < 200 || statusCode >= 300) {
        upstream.resume();
        res.status(502).json({ error: `Upstream returned ${statusCode}` });
        return;
      }

      res.setHeader("Content-Disposition", 'attachment; filename="egh-node"');
      res.setHeader("Content-Type", "application/octet-stream");

      if (headers["content-length"]) {
        res.setHeader("Content-Length", headers["content-length"]);
      }

      upstream.pipe(res);
    },
  );

  req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
    req.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: "Timed out fetching binary from upstream" });
    }
  });

  req.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: `Failed to fetch binary: ${err.message}` });
    }
  });
}

router.get("/download/egh-node", (_req, res): void => {
  fetchWithRedirects(buildWingsUrl(), res);
});

export default router;
