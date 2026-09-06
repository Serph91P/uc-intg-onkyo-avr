import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import WebSocket from "ws";
assert.notEqual(process.getuid(), 0, "runtime must not be root");
const metadata = JSON.parse(readFileSync("driver.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(metadata.version, pkg.version);
assert.ok(existsSync(pkg.main), "compiled entrypoint missing");
assert.ok(readFileSync("eiscp.png").length > 0);
for (const logo of ["back.svg", "deezer.svg", "eiscp.svg", "menu.svg", "music-server.svg", "tidal.svg", "tunein.svg"]) {
  assert.ok(readFileSync(`logos/${logo}`, "utf8").includes("<svg"));
}
assert.ok(readdirSync("node_modules").length > 0);
assert.ok(!existsSync("node_modules/typescript"), "development dependencies shipped");
if (process.env.SMOKE_RECREATED === "true") {
  assert.equal(readFileSync("/config/docker-smoke-marker", "utf8"), "persistent-non-root-write");
} else {
  writeFileSync("/config/docker-smoke-marker", "persistent-non-root-write");
}
const ws = new WebSocket("ws://127.0.0.1:9090");
const timeout = setTimeout(() => {
  console.error("WebSocket metadata timeout");
  process.exit(1);
}, 5000);
ws.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
ws.on("open", () => ws.send(JSON.stringify({ kind: "req", id: 1, msg: "get_driver_metadata", msg_data: {} })));
ws.on("message", (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.req_id !== 1) return;
  assert.equal(message.code, 200);
  assert.equal(message.msg, "driver_metadata");
  assert.equal(message.msg_data.driver_id, metadata.driver_id);
  assert.equal(message.msg_data.version, pkg.version);
  clearTimeout(timeout);
  ws.close();
  console.log(JSON.stringify({ uid: process.getuid(), version: pkg.version, protocol: message.msg, recreated: process.env.SMOKE_RECREATED === "true" }));
});
