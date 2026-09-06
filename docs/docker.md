# Run the Onkyo integration with Docker

This runs the integration on a **separate Docker host**, not on Remote 3. A Linux server, supported NAS, or Raspberry Pi with a **64-bit ARM64 OS** can host it. Remote Two/3 connects to the host over the local network; the host connects to the AVR.

There are two different installation methods:

- [Custom installation](installation.md): upload the release `.tar.gz` to the Remote's web-configurator; the Remote runs the driver.
- **External Docker integration (this guide)**: keep the container running on your server and register its WebSocket address with the Remote. Do not upload a Docker image or Compose file to “Install custom”.

Use only **one active copy of this driver**. Back up the existing integration before changing methods. Disable the old instance before registering the external one; duplicate driver IDs can cause conflicts. Moving methods may require reselecting entities in activities. A Docker volume backup is not a backup of the Remote's activities.

## Requirements

- A maintained Docker Engine with Buildx and the Compose v2 plugin (`docker version`, `docker buildx version`, `docker compose version`). Use your platform's supported [Docker installation instructions](https://docs.docker.com/engine/install/). The examples use Linux and `docker compose`, not the legacy `docker-compose` command.
- An x86-64 (`linux/amd64`) or ARM64 (`linux/arm64`) Docker host. A 32-bit Raspberry Pi OS is not a supported image target.
- A reachable LAN shared by the Docker host, Remote and AVR; DHCP reservations/fixed IP addresses for the host and AVR are recommended. IP subnet membership depends on the subnet mask, not simply matching the first three address components.
- Enable the AVR's **Network Standby** and **Network Control** options as applicable to the model. See its manual: menu names vary. After loss of mains power some models must be turned on once manually. Discovery and standby control are model-dependent.
- Keep Remote firmware current. This driver's `driver.json` declares **`min_core_api: 0.20.0`**, an API version, **not firmware 0.20.0**. The official custom-installation specification notes that this field is not enforced. The Docker image supplies its own Node.js runtime, so the Remote's bundled Node version does not determine the container runtime. No exact minimum Remote 3 firmware is asserted here; individual features can need newer firmware.
- Git for the local-build quick start; `curl` and `jq` only for optional manual registration.

## Quick start: Linux host networking

Use a checkout/release containing these Docker files. Until this change is merged upstream, use the reviewed feature revision rather than expecting upstream `main` to contain them.

```sh
git clone https://github.com/EddyMcNut/uc-intg-onkyo-avr.git
cd uc-intg-onkyo-avr
docker compose config --quiet
docker compose build --pull
docker compose up -d --no-build --pull never
docker compose ps
docker compose logs --tail=100 onkyo
```

The supplied [compose.yaml](../compose.yaml) builds `uc-intg-onkyo-avr:local`, uses Linux host networking, runs as UID/GID **1000:1000** (`node`), and stores settings in the named volume **`onkyo_config`**. It does not require Node/npm on the host. Keep the Compose project name `onkyo` unchanged to reuse that volume.

**Image availability:** this guide does not imply a GHCR image has already been published. The intended upstream image name is **`ghcr.io/eddymcnut/uc-intg-onkyo-avr`**. Once the maintainer has published an image, select an actual version listed in the upstream package (replace `X.Y.Z`):

```sh
export ONKYO_IMAGE=ghcr.io/eddymcnut/uc-intg-onkyo-avr:X.Y.Z
docker compose pull onkyo
docker compose up -d --no-build
```

Persist that choice as `ONKYO_IMAGE=ghcr.io/eddymcnut/uc-intg-onkyo-avr:X.Y.Z` in a local `.env` file so later shells use the same image. If pull reports “manifest unknown” or an unavailable/private package, use the local build above (unset `ONKYO_IMAGE` first). Do not substitute a fork image and assume it has identical contents. Prefer a version or digest over mutable `latest`.

### Add it to Remote Two/3

1. Open the **Remote's** web-configurator (at its own LAN address), then Integrations / Add new. Labels can vary with firmware.
2. On a multicast-capable LAN, the external “Onkyo/Pioneer/Integra AVR (eISCP)” driver should be discovered. Select it and complete setup. This is not “Install custom”.
3. Choose Configure and enter the AVR model and fixed AVR IP, or leave those fields empty for AVR discovery on a compatible host network/model. If discovery fails, use manual AVR setup, not a second container.
4. Select zones/entities and complete setup. Set the album-art endpoint for your AVR or `na` when unsupported; see [Album Art](album-art.md).
5. If the external driver is not listed, use the registration procedure below. Once registered, the usual [configuration and entity instructions](installation.md) apply without uploading an archive.

The driver listens on **`ws://HOST_LAN_IP:9090`**. This is the **Docker host's** address, not the Remote's address, `localhost`, `0.0.0.0`, or a private container address. Port 9090 is a WebSocket Integration API, **not a browser configuration GUI**. An HTTP error at `http://HOST:9090` does not by itself mean the driver is broken.

## Networking and security

The SDK used here is `@unfoldedcircle/integration-api` **0.5.0**. Its installed implementation was checked against the source used for this guide.

| Traffic                            | Purpose / direction                                                         |
| ---------------------------------- | --------------------------------------------------------------------------- |
| TCP 9090 (configurable)            | Remote → Docker host, WebSocket Integration API                             |
| UDP 5353 multicast                 | Integration advertisement, `_uc-integration._tcp` (mDNS); not AVR discovery |
| UDP 60128 broadcast/replies        | Docker host ↔ AVR, eISCP discovery during setup                             |
| TCP 60128 (AVR setting)            | Docker host → AVR, normal eISCP control and state                           |
| TCP 80 to AVR (usual HTTP default) | Docker host **and Remote** → AVR, model-specific album art                  |

**There is no separate thumbnail/album-art HTTP server in this upstream version.** `src/serviceThumbnails.ts` loads packaged SVG logos and generates inline `data:image/svg+xml` thumbnails. `src/zoneMediaRenderer.ts` hashes the AVR's HTTP image and sends a URL such as `http://AVR_IP/album_art.cgi?hash=...` to the Remote. Therefore the Remote also needs direct access to that AVR URL. There is no image-server port or advertised-image-host environment setting to configure. Endpoint paths vary by AVR; use `na` if absent. Do not map invented media ports.

### Host mode (recommended on Linux)

Host mode avoids a container network bridge for multicast and broadcast, but does not guarantee discovery. **Do not add `ports:`** to a host-network service: there is no port mapping. Check that 9090 is free on the host. To use another port, edit `UC_INTEGRATION_HTTP_PORT` in Compose and register `ws://HOST_LAN_IP:NEW_PORT`. Do not change the AVR's 60128 control port to fix a driver port conflict.

`UC_INTEGRATION_INTERFACE` takes a **bind address**, not a NIC name such as `eth0`. Leave it at `0.0.0.0` in normal use. Under host networking it can be a host LAN address, but SDK 0.5.0 does **not** constrain its Bonjour publisher to that interface. Multiple NICs, VPN adapters and conflicting `.local` names can advertise the wrong address; manual registration is the reliable fallback.

### Bridge mode / NAS / Docker Desktop / VLANs

Docker Desktop runs containers inside a VM; its host-network feature and NAS implementations are not equivalent to native Linux multicast/broadcast behavior. Some NAS interfaces do not support host mode. Across VLANs, routing alone does not forward mDNS or AVR broadcast discovery. Prefer manual registration and a fixed AVR IP rather than broadly relaying multicast.

For a bridge fallback, **edit the existing Compose file** (do not layer an override that accidentally retains `network_mode: host`):

1. Remove `network_mode: host`.
2. Set `UC_DISABLE_MDNS_PUBLISH: "true"`.
3. Keep `UC_INTEGRATION_INTERFACE: 0.0.0.0` and `UC_INTEGRATION_HTTP_PORT: "9090"`.
4. Add this under the `onkyo` service, replacing the example host address with your Docker host's LAN IP:

```yaml
ports:
  - "192.168.1.20:9090:9090/tcp"
```

Run `docker compose config --quiet` and `docker compose up -d --no-build --pull never` again. Register `ws://192.168.1.20:9090` (your actual host address). If host port 9090 is busy, use e.g. `192.168.1.20:9091:9090/tcp` and register port 9091; the container still listens on 9090. **Only the WebSocket TCP port needs publishing.** AVR TCP/HTTP connections originate outbound. Publishing UDP 60128 or 5353 does not make LAN broadcast/multicast traverse Docker NAT. Use manual AVR setup in bridge mode.

For VLANs/firewalls, allow only the required source/destination traffic in the table and established replies. “Driver discovered” does not prove AVR control works; “manual control works” does not prove multicast works. Wi-Fi client isolation can block both. Do not disable the firewall wholesale.

**Trusted LAN only:** the Node SDK does not implement secure WebSocket or token authentication; connections are accepted without an integration password. Do not expose the service publicly, use router port forwarding, or assume Remote PIN authentication protects this WebSocket port. No privileged container, Docker socket, `PUID`/`PGID`, invented token, or blanket host permission changes are required.

### Manual registration through the official Core REST API

The [official registration guide](https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-registration.md) specifies `POST /api/intg/drivers`. The [official Remote Two/3 TypeScript example](https://github.com/unfoldedcircle/integration-ts-example#driver-registration) confirms this workflow and `web-configurator` authentication using the Remote's PIN. Its simulator URL `localhost:8080` is **not** the address of a physical Remote.

Run from the checkout with the container running. Replace the two addresses below. `curl --user web-configurator` prompts privately for the PIN; do not put the PIN into a command, issue, screenshot, or checked-in file.

```sh
REMOTE_IP=192.168.1.30
HOST_LAN_IP=192.168.1.20
HOST_PORT=9090
docker compose cp onkyo:/app/driver.json ./driver-registration.json
jq --arg url "ws://${HOST_LAN_IP}:${HOST_PORT}" \
  '. + {driver_url: $url, enabled: true, icon: "uc:music"}' \
  driver-registration.json > driver-registration-request.json
curl --fail-with-body --user web-configurator \
  --header 'Content-Type: application/json' \
  --data-binary @driver-registration-request.json \
  "http://${REMOTE_IP}/api/intg/drivers"
curl --fail-with-body --user web-configurator \
  "http://${REMOTE_IP}/api/intg/drivers"
```

The second request verifies registration. Go back to the Remote web-configurator, select the registered driver and complete its setup; registration alone does not create configured AVR entities. If the driver ID already exists, inspect the existing instance and disable/remove the old copy deliberately instead of repeatedly POSTing or deleting other integrations.

The example uses a built-in music icon: the custom `eiscp.png` packaged in the container is **not automatically installed as a Remote icon** by external registration. The custom archive method has a separate icon installation mechanism. Missing custom pictograms are not a control/connectivity failure.

REST Basic authentication over HTTP is not encrypted; use this only on your trusted management LAN. No credentials are needed for the driver WebSocket itself. The official simulator also requires manual registration because its container does not provide working automatic discovery.

## Configuration, persistence and operation

Supported container environment settings:

| Setting                    | Image / Compose default                           | Meaning                                               |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `UC_CONFIG_HOME`           | `/config`                                         | Persisted driver configuration directory              |
| `UC_INTEGRATION_INTERFACE` | `0.0.0.0`                                         | WebSocket bind address                                |
| `UC_INTEGRATION_HTTP_PORT` | `9090`                                            | WebSocket listening port                              |
| `UC_DISABLE_MDNS_PUBLISH`  | SDK default `false`; Compose explicitly `"false"` | Set exactly `"true"` for manual/bridge mode           |
| `DEBUG`                    | Optional                                          | SDK logging, e.g. `ucapi:info,ucapi:warn,ucapi:error` |

AVR settings are entered in the Remote's integration setup, not invented environment variables. The application also has a persisted [log-level setting](loglevel.md).

Docker initializes a fresh named volume with `/config` ownership from the image (UID/GID 1000:1000). `config.json` survives container recreation. Do not mount an empty directory over `/app` or change the image's user to root. For an optional bind mount, pre-create a dedicated directory writable by 1000:1000, accounting for NAS ACLs, rootless Docker UID mapping and SELinux labeling where applicable. A bind mount hides image directory ownership; `Permission denied` is not fixed by adding `PUID`/`PGID` (unsupported) or `chmod 777`.

### Backup and restore

The [integration backup/restore UI](backup-restore.md) exports logical driver settings. For a full container-config backup, stop writes and archive the named volume. Run from the same Compose directory/project, with the selected image available locally:

```sh
docker compose stop onkyo
docker compose run --rm --no-deps -T --entrypoint tar onkyo \
  -czf - -C /config . > onkyo-config-backup.tar.gz
docker compose start onkyo
```

Check that the backup command succeeded and test the archive (`tar -tzf onkyo-config-backup.tar.gz`) before relying on it. Store it privately off the Docker host. To restore a **trusted** backup, stop the service first, back up current settings, then extract as the image's non-root user:

```sh
docker compose stop onkyo
docker compose run --rm --no-deps -T --entrypoint tar onkyo \
  --no-same-owner -xzf - -C /config < onkyo-config-backup.tar.gz
docker compose start onkyo
```

Extraction overwrites matching files, not unrelated files. For a clean disaster recovery, restore into a fresh named volume/project and verify ownership before switching over. Keep Compose's project name and volume consistent. **Never use `docker compose down -v` or volume pruning for an update/rollback**: these delete settings.

### Update and rollback

1. Read upstream release notes; take a backup and record the currently selected image tag/digest (`docker compose images`). Keep the old image locally.
2. For registry images, change `ONKYO_IMAGE` to the desired published version (and update `.env`), run `docker compose pull onkyo`, then `docker compose up -d --no-build`.
3. For local builds, check out the desired reviewed release/revision, build a new explicit local tag with `docker build -t uc-intg-onkyo-avr:NEW_VERSION .`, set `ONKYO_IMAGE` to it and run `docker compose up -d --no-build --pull never`.
4. Check health/logs and then test the Remote/AVR. For rollback, select the previous tag/digest and recreate with the same volume. If the new version migrated settings incompatibly, restore the matching pre-update backup while stopped. Do not run both versions against the volume simultaneously.

Compose uses `init: true`, an exec-form Node command, SIGTERM and a 20-second stop grace period. Signals reach Node directly instead of an npm/shell wrapper. The current application has no custom shutdown/drain hook; this is not a guarantee that an in-flight command completes. Config writes are persisted by the application during configuration changes.

### Logs and troubleshooting

```sh
docker compose ps
docker compose logs --tail=200 onkyo
docker compose exec onkyo node docker/healthcheck.mjs
```

For SDK connection/startup messages, add `DEBUG: "ucapi:info,ucapi:warn,ucapi:error"` to Compose environment and recreate. Broad `DEBUG=ucapi:*` includes protocol traces; review/redact logs before sharing, as configuration/logs can contain private addresses or settings. Log rotation is configured in the example.

- **Unhealthy/exits:** inspect logs for missing files, permission errors, or `EADDRINUSE`. Confirm the configured port is free and the bind address exists in the selected network mode.
- **Healthy but missing in the Remote:** health checks only open a local TCP connection. They do not test mDNS, Remote firmware, registration, AVR availability, album art or successful commands. Use manual registration and verify LAN routing.
- **Remote connected but AVR unavailable:** check the fixed AVR IP, network-control/standby settings and outbound TCP 60128. Use manual AVR setup if broadcast discovery is unavailable.
- **Artwork missing:** verify the model-specific HTTP endpoint from both the Docker host and Remote network. Do not publish an extra container port. Set `na` for models without an endpoint.
- **Settings disappeared after update:** check you reused the same Compose project and named volume, and did not run `down -v`. Stop and inspect before doing a fresh setup.

## Maintainers: build, verify and publish

The Docker workflow is independent of the existing custom-archive release workflow. It does **not** sync/merge forks, create releases, update dependencies, or deploy anything.

### Reproducible local checks

With a compatible Node version (`.nvmrc` is the reference) and Docker:

```sh
npm ci
npm run build
npm test
npm run code-check
docker compose config --quiet
docker build --progress=plain -t uc-intg-onkyo-avr:local .
bash docker/smoke.sh uc-intg-onkyo-avr:local
```

The smoke test creates uniquely named disposable containers and a named volume, uses **`--network none`** and `UC_DISABLE_MDNS_PUBLISH=true`, and does not publish ports or send AVR discovery/control commands. It checks the image's default command, actual `get_driver_metadata` WebSocket response, runtime assets, absence of TypeScript in production dependencies, non-root config writes, SIGTERM stop (no forced kill), and persistence after container recreation. It cleans up **only its own** test resources. Run it from the repository root; it does not use your configured Compose volume.

The Dockerfile uses lockfile-based `npm ci`, a separate production dependency stage, and only compiled code/runtime assets in the final image. It checks that `package.json` and `driver.json` versions match and fails on mismatch. Both are currently 0.9.3; future releases must update them together (and the lockfile's package version when changing package version). The default command is `node dist/driver.js`, **not** the obsolete `dist/src/index.js`.

The official Node base matches `.nvmrc` and is pinned to a multi-platform index digest. Update its version **and digest** deliberately when updating the runtime; verify the package `engines` range and rebuild/test both architectures. Keep the allowlisted `.dockerignore` in sync with any new build inputs; it intentionally excludes local config, credentials, Git history, tests, screenshots and research files.

### CI and registry policy

[`.github/workflows/docker.yml`](../.github/workflows/docker.yml):

- PRs and `main` / `feat/**` pushes run dependency installation, tests, code checks, Compose validation, and **native amd64 and arm64 image builds plus isolated smoke tests**. These jobs have only `contents: read`; no registry login/write or registry secrets.
- Pushing an authorized release tag `vX.Y.Z` publishes `ghcr.io/<lowercase-owner>/<lowercase-repository>:X.Y.Z` and `:latest`, **after both builds pass**. A prerelease must use a suffix such as `vX.Y.Z-rc.1`; it publishes only `:X.Y.Z-rc.1`, never `latest`. Do not use a stable-looking tag for a prerelease. Tags must match `package.json` exactly after removing `v`; build metadata (`+...`) is rejected because it is not a valid image tag.
- Manual dispatch defaults to **build/test only** (`publish: false`). Explicit `publish: true` can publish **only from the repository default branch**, under `:dev-<12-character-commit-SHA>`. It never creates/updates `latest` or a stable version tag.
- Only the publishing job has `packages: write`. It uses the repository's **`GITHUB_TOKEN`**, not a PAT, and lowercases the repository name for GHCR. Buildx with QEMU builds the multi-platform publication; validation runs natively on GitHub's public Linux x64 and ARM64 runners.

For upstream the resulting path is `ghcr.io/eddymcnut/uc-intg-onkyo-avr`. Maintainers must enable Actions/package publishing as permitted by their repository policy and make the GHCR package **public** if end users should pull anonymously (new packages may initially be private). Confirm package access and inspect the published manifest with `docker buildx imagetools inspect IMAGE:VERSION`; it must contain `linux/amd64` and `linux/arm64`. Protect release tags/default-branch publishing through repository permissions. Re-running a release build can replace its version tag; users needing immutable deployments should pin the manifest digest.

Do not push a release tag merely to test Docker: the pre-existing archive workflow also reacts to release tags. Feature branches and PRs do not publish images. Forks derive their own GHCR path; this workflow does not mirror upstream images.

### Verification boundaries

Automated smoke tests do not prove physical Remote 3 / AVR interoperability, multicast behavior on a user's network, or artwork rendering on firmware. Test those with hardware before claiming model/firmware support. Cross-platform manifest availability alone is not an ARM64 execution test; require both native CI builds/smokes to pass before publication.

## Official references and scope

- [UC TypeScript integration example for Remote Two/3](https://github.com/unfoldedcircle/integration-ts-example): external drivers, Remote vs simulator, registration and PIN authentication. Its Docker Compose instructions are for the **Core Simulator on another machine**, not for installing Docker on Remote 3.
- [Node SDK environment variables and limitations](https://github.com/unfoldedcircle/integration-node-library#environment-variables): supported bind/port/config/mDNS options and unsupported secure WebSocket/token authentication. The installed 0.5.0 implementation is authoritative for this image.
- [Driver mDNS advertisement](https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-advertisement.md) and [driver registration](https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-registration.md).
- [Custom driver installation](https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-installation.md): the distinct `.tar.gz` sandbox/metadata/icon mechanism; its firmware requirements are not Docker-host installation instructions.
- [WebSocket integration protocol](https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/websocket.md) and [Core REST API](https://unfoldedcircle.github.io/core-api/rest/).

This repository's Docker packaging and host/bridge recommendations apply those official external-driver mechanisms to Onkyo. They are not an official Unfolded Circle Onkyo Docker image or an instruction to alter the Remote's operating system.
