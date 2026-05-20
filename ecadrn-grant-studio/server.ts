import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { getPrompt } from "./prompts.ts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Generic AI Endpoint
app.post("/api/ai/:action", async (req, res) => {
  const { action } = req.params;
  const data = req.body;

  const promptText = getPrompt(action, data);
  if (promptText === "Invalid action") {
    return res.status(400).json({ error: "Invalid action" });
  }

  const isJson = action !== "chat";

  try {
    const config = isJson ? {
      responseMimeType: "application/json" as any,
      temperature: 0.4,
      topP: 0.85,
    } : {
      temperature: 0.7,
      topP: 0.9,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config,
    });

    const text = response.text || "";

    if (isJson) {
      try {
        // With responseMimeType: "application/json", it should already be JSON
        res.json(JSON.parse(text));
      } catch (e) {
        console.error("Failed to parse JSON from AI:", text);
        res.status(500).json({ error: "Invalid JSON response from AI", raw: text });
      }
    } else {
      res.send(text);
    }
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

