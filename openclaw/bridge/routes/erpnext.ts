import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { asyncHandler } from "../utils.js";

export function erpnextRoutes(): Router {
  const router = Router();

  const openclawHome = () =>
    process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
  const envFile = () => path.join(openclawHome(), ".env.erpnext");

  // GET /api/erpnext/credentials — read current credentials from ~/.openclaw/.env.erpnext
  router.get("/credentials", asyncHandler(async (_req, res) => {
    const file = envFile();
    if (!fs.existsSync(file)) {
      res.json({ url: "", apiKey: "", apiSecret: "" });
      return;
    }

    const content = fs.readFileSync(file, "utf-8");
    const result: Record<string, string> = { url: "", apiKey: "", apiSecret: "" };
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      if (key === "ERPNEXT_URL") result.url = value;
      if (key === "ERPNEXT_API_KEY") result.apiKey = value;
      if (key === "ERPNEXT_API_SECRET") result.apiSecret = value;
    }
    res.json(result);
  }));

  // PUT /api/erpnext/credentials — save credentials to ~/.openclaw/.env.erpnext
  router.put("/credentials", asyncHandler(async (req, res) => {
    const { url, apiKey, apiSecret } = req.body as {
      url?: string;
      apiKey?: string;
      apiSecret?: string;
    };

    const lines: string[] = [
      "# SCMClaw ERPNext Credentials (auto-generated, do not edit manually)",
      url ? `ERPNEXT_URL=${url}` : "",
      apiKey ? `ERPNEXT_API_KEY=${apiKey}` : "",
      apiSecret ? `ERPNEXT_API_SECRET=${apiSecret}` : "",
    ].filter(Boolean);

    fs.mkdirSync(openclawHome(), { recursive: true });
    fs.writeFileSync(envFile(), lines.join("\n") + "\n", "utf-8");
    res.json({ ok: true });
  }));

  // DELETE /api/erpnext/credentials — delete ~/.openclaw/.env.erpnext
  router.delete("/credentials", asyncHandler(async (_req, res) => {
    const file = envFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    res.json({ ok: true });
  }));

  return router;
}
