const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serwowanie plików statycznych (HTML, CSS, JS)
    if (req.method === "GET") {
      let filePath = "." + req.url;
      if (filePath === "./") filePath = "./index.html";
      const extname = path.extname(filePath);
      const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".json": "application/json",
      };
      const contentType = mimeTypes[extname] || "application/octet-stream";

      fs.readFile(filePath, (error, content) => {
        if (!error) {
          res.writeHead(200, { "Content-Type": contentType });
          res.end(content, "utf-8");
        } else {
          res.writeHead(404);
          res.end("Nie znaleziono pliku");
        }
      });
    }
    // Proxy do API Claude
    else if (req.method === "POST" && req.url === "/api/analyze") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          const rawKey = (data.apiKey || "").trim();

          const payload = JSON.stringify({
            model: "claude-opus-5-5",
            max_tokens: 4096,
            system: data.system,
            messages: data.messages,
          });

          const options = {
            hostname: "api.anthropic.com",
            port: 443,
            path: "/v1/messages",
            method: "POST",
            headers: {
              "x-api-key": rawKey,
              "anthropic-version": "2023-06-01",
              "anthropic-workspace-id": "wrkspc_01SwmZn8hE6Et1fsfWGWXuCe",
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
            },
          };

          const proxyReq = https.request(options, (proxyRes) => {
            let responseData = "";
            proxyRes.on("data", (chunk) => (responseData += chunk));
            proxyRes.on("end", () => {
              console.log(`[Status Anthropic]: ${proxyRes.statusCode}`);
              res.writeHead(proxyRes.statusCode, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(responseData);
            });
          });

          proxyReq.on("error", (e) => {
            console.error("Błąd połączenia:", e);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          });

          proxyReq.write(payload);
          proxyReq.end();
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Błąd przetwarzania żądania" }));
        }
      });
    }
  })
  .listen(PORT, () => {
    console.log(`🚀 Serwer Antiq działa pod adresem: http://localhost:${PORT}`);
  });
