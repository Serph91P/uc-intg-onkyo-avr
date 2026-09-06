import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { once } from "node:events";
import WebSocket from "ws";
import { ConfigManager, getConfigPath } from "./dist/configManager.js";
assert.equal(process.getuid(), 1000, "runtime must use UID 1000");
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
const recreated = process.env.SMOKE_RECREATED === "true";
// Empty AVR list is valid restore input and cannot send discovery/control commands.
const expected = { avrs: [], logLevel: "error" };
assert.equal(getConfigPath(), "/config/config.json");
if (!recreated) assert.ok(!existsSync(getConfigPath()), "fresh owned volume must be empty");
const ws = new WebSocket("ws://127.0.0.1:9090");
const timeout = setTimeout(() => {
  console.error("WebSocket setup/restore timeout");
  process.exit(1);
}, 10000);
ws.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
let id = 0;
function exchange(msg, msg_data, matches) {
  return new Promise((resolve) => {
    const requestId = ++id;
    const listener = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.req_id === requestId) assert.equal(message.code, 200);
      if (matches(message, requestId)) {
        ws.off("message", listener);
        resolve(message);
      }
    };
    ws.on("message", listener);
    ws.send(JSON.stringify({ kind: "req", id: requestId, msg, msg_data }));
  });
}
const setupState = (state) => (message) => message.msg === "driver_setup_change" && message.msg_data.state === state;
try {
  await once(ws, "open");
  const response = await exchange("get_driver_metadata", {}, (message, requestId) => message.req_id === requestId);
  assert.equal(response.msg, "driver_metadata");
  assert.equal(response.msg_data.driver_id, metadata.driver_id);
  assert.equal(response.msg_data.version, pkg.version);
  if (!recreated) {
    // SetupHandler.handleDriverSetupReconfigure -> restoreConfiguration -> ConfigManager.save.
    await exchange("setup_driver", { reconfigure: true, setup_data: { choice: "restore", restore_data: JSON.stringify(expected) } }, setupState("OK"));
  }
  assert.deepEqual(JSON.parse(readFileSync(getConfigPath(), "utf8")), expected);
  assert.equal(statSync(getConfigPath()).uid, 1000);
  assert.ok(!existsSync("/app/config.json"), "configuration must not fall back to the working directory");
  assert.deepEqual(ConfigManager.load(), expected);
  if (recreated) {
    // Ask the restarted default-CMD driver to load settings into its real setup form.
    await exchange("setup_driver", { reconfigure: true, setup_data: {} }, setupState("WAIT_USER_ACTION"));
    const form = await exchange("set_driver_user_data", { input_values: { action: "configure" } }, setupState("WAIT_USER_ACTION"));
    const settings = form.msg_data.require_user_action.input.settings;
    assert.equal(settings.find((setting) => setting.id === "logLevel").field.dropdown.value, expected.logLevel);
    // Do not submit the manual form: blank AVR fields would request discovery.
  }
  console.log(JSON.stringify({ uid: process.getuid(), version: pkg.version, configPath: getConfigPath(), config: expected, recreated }));
} finally {
  clearTimeout(timeout);
  ws.close();
}
