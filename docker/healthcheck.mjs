// TCP liveness only: no setup, discovery, subscriptions or AVR commands.
import { connect } from "node:net";
const bind = process.env.UC_INTEGRATION_INTERFACE;
const host = !bind || bind === "0.0.0.0" ? "127.0.0.1" : bind === "::" ? "::1" : bind;
const socket = connect({ host, port: Number(process.env.UC_INTEGRATION_HTTP_PORT || 9090) });
socket.setTimeout(3000);
socket.once("connect", () => {
  socket.destroy();
  process.exit(0);
});
socket.once("error", () => process.exit(1));
socket.once("timeout", () => process.exit(1));
