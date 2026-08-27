// Repro: what apiKey does the CLI resolve, and does /subscribe accept it?
const apiUrl = "https://api.todofor.ai";
const envKey = process.env.TODOFORAI_API_TOKEN || "";
console.log("env TODOFORAI_API_TOKEN len:", envKey.length, "prefix:", envKey.slice(0, 6));

// Mirror the CLI's readCredential fallback
import { readFileSync } from "fs";
import os from "os";
let credTok = "";
try {
  const c = JSON.parse(readFileSync(os.homedir() + "/.config/todoforai/credentials.json", "utf8"));
  credTok = c[apiUrl] || c.apiToken || c.apiKey || "";
} catch {}
console.log("credentials.json token len:", credTok.length, "prefix:", credTok.slice(0, 6));

const key = envKey || credTok;
const res = await fetch(`${apiUrl}/api/v1/todos/bfca6220-c934-4b8d-a622-dc002c2bc595/subscribe`, {
  method: "POST",
  headers: { "x-api-key": key, "x-tab-id": "repro-tab", "Content-Type": "application/json" },
  body: JSON.stringify({ todoId: "bfca6220-c934-4b8d-a622-dc002c2bc595" }),
});
console.log("subscribe with chosen key:", res.status, await res.text());
