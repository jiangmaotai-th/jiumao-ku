#!/usr/bin/env node
import http from "node:http";
import { createAccountMiddleware } from "./account-api.js";

const PORT = Number(process.env.PORT || 3194);
const ROOT = process.env.SCRATCH_ROOT || "/var/lib/maotaiworks/scratch";
const handler = createAccountMiddleware(ROOT);

const server = http.createServer((req, res) => {
  handler(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "not found" }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`scratch-account listening on 127.0.0.1:${PORT}`);
});
