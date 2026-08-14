import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

function mkTmpDir(prefix = "onkyo-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

it("EntityRegistrar builds entities correctly", async () => {
  const tmp = mkTmpDir();
  try {
    const cfgModule = await import("../src/configManager.js");
    if (typeof (cfgModule as any).setConfigDir === "function") {
      (cfgModule as any).setConfigDir(tmp);
    }

    // Import compiled module from dist
    const avrStateModule = await import("../src/avrState.js");
    const module = await import("../src/entityRegistrar.js");
    const EntityRegistrar = module.default as any;
    const { avrStateManager } = avrStateModule as any;
    const registrar = new EntityRegistrar(avrStateManager);

    const avrEntry = "Model_192.168.1.2_main";

    const mp = registrar.createMediaPlayerEntity(avrEntry, 80, async () => {});
    expect(mp).toBeTruthy();
    expect((mp as any).options?.volume_steps).toBe(80);
    expect(Array.isArray((mp as any).options?.simple_commands)).toBe(true);
    expect((mp as any).options?.simple_commands.length > 0).toBe(true);
    expect((mp as any).name?.en).toBe("Model_192.168.1.2_main");

    const sensors = registrar.createSensorEntities(avrEntry);
    expect(sensors).toBeTruthy();
    expect(Array.isArray(sensors)).toBe(true);
    expect(sensors.length > 0).toBe(true);
    expect((sensors[0] as any).id.startsWith(avrEntry)).toBe(true);

    const select = registrar.createListeningModeSelectEntity(avrEntry, async () => {});
    expect(select).toBeTruthy();
    const attrs = (select as any).attributes || {};
    expect(Array.isArray(attrs.options)).toBe(true);
    expect(attrs.options.length > 0).toBe(true);
    expect((select as any).id.endsWith("_listening_mode")).toBe(true);
    expect((select as any).name?.en).toBe("Model_192.168.1.2_main Listening Mode");

    // When user config contains listeningModeOptions, the select entity should use it exactly
    const userList = ["stereo", "straight-decode", "neural-thx", "full-mono"];
    (cfgModule as any).ConfigManager.save({ avrs: [{ model: "Model", ip: "192.168.1.2", port: 60128, zone: "main", listeningModeOptions: userList, entityNameStyle: "long" }] });
    const avrStateModule2 = await import("../src/avrState.js");
    const registrar2Module = await import("../src/entityRegistrar.js");
    const Registrar2 = registrar2Module.default as any;
    const { avrStateManager: avrStateManager2 } = avrStateModule2 as any;
    const registrar2 = new Registrar2(avrStateManager2);
    const select2 = registrar2.createListeningModeSelectEntity("Model 192.168.1.2 main", async () => {});
    const attrs2 = (select2 as any).attributes || {};
    expect(attrs2.options).toEqual(userList);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

it("EntityRegistrar sensor names omit host from display name", async () => {
  const tmp = mkTmpDir();
  try {
    const cfgModule = await import("../src/configManager.js");
    if (typeof (cfgModule as any).setConfigDir === "function") {
      (cfgModule as any).setConfigDir(tmp);
    }
    (cfgModule as any).ConfigManager.save({ avrs: [{ model: "TX-RZ50", ip: "192.168.1.2", port: 60128, zone: "main", entityNameStyle: "short" }] });
    const module = await import("../src/entityRegistrar.js");
    const avrStateModule = await import("../src/avrState.js");
    const EntityRegistrar = module.default as any;
    const { avrStateManager } = avrStateModule as any;
    const registrar = new EntityRegistrar(avrStateManager);

    const avrEntry = "TX-RZ50 192.168.1.2 main";
    const sensors = registrar.createSensorEntities(avrEntry);

    expect(Array.isArray(sensors)).toBe(true);
    expect(sensors.length > 0).toBe(true);
    expect((sensors[0] as any).id).toBe(`${avrEntry}_volume_sensor`);
    expect((sensors[0] as any).name?.en).toBe("TX-RZ50 Main Volume");

    const mp = registrar.createMediaPlayerEntity(avrEntry, 100, async () => {});
    expect((mp as any).name?.en).toBe("TX-RZ50 Main");

    const listeningMode = registrar.createListeningModeSelectEntity(avrEntry, async () => {});
    expect((listeningMode as any).name?.en).toBe("TX-RZ50 Main Listening Mode");

    const inputSelector = registrar.createInputSelectorSelectEntity(avrEntry, async () => {});
    expect((inputSelector as any).name?.en).toBe("TX-RZ50 Main Input Selector");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

it("EntityRegistrar long entity names include host when configured", async () => {
  const tmp = mkTmpDir();
  try {
    const cfgModule = await import("../src/configManager.js");
    if (typeof (cfgModule as any).setConfigDir === "function") {
      (cfgModule as any).setConfigDir(tmp);
    }
    (cfgModule as any).ConfigManager.save({ avrs: [{ model: "TX-RZ50", ip: "192.168.1.2", port: 60128, zone: "main", entityNameStyle: "long" }] });

    const module = await import("../src/entityRegistrar.js");
    const EntityRegistrar = module.default as any;
    const avrStateModule = await import("../src/avrState.js");
    const { avrStateManager } = avrStateModule as any;
    const registrar = new EntityRegistrar(avrStateManager);
    const avrEntry = "TX-RZ50 192.168.1.2 main";

    const mp = registrar.createMediaPlayerEntity(avrEntry, 100, async () => {});
    expect((mp as any).name?.en).toBe(avrEntry);

    const sensor = registrar.createSensorEntities(avrEntry)[0];
    expect((sensor as any).name?.en).toBe(`${avrEntry} Volume`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

it("EntityRegistrar builds remote entity with features, buttons, pages and simple commands", async () => {
  const tmp = mkTmpDir();
  try {
    const cfgModule = await import("../src/configManager.js");
    if (typeof (cfgModule as any).setConfigDir === "function") {
      (cfgModule as any).setConfigDir(tmp);
    }
    (cfgModule as any).ConfigManager.save({ avrs: [{ model: "TX-RZ50", ip: "192.168.1.2", port: 60128, zone: "main", entityNameStyle: "short" }] });

    const module = await import("../src/entityRegistrar.js");
    const EntityRegistrar = module.default as any;
    const avrStateModule = await import("../src/avrState.js");
    const { avrStateManager } = avrStateModule as any;
    const registrar = new EntityRegistrar(avrStateManager);
    const avrEntry = "TX-RZ50 192.168.1.2 main";

    const remote = registrar.createRemoteEntity(avrEntry, async () => 0);
    expect(remote).toBeTruthy();
    expect(remote.id.endsWith("_remote")).toBe(true);
    expect((remote as any).name?.en).toBe("TX-RZ50 Main Remote");

    expect(Array.isArray((remote as any).features)).toBe(true);
    expect((remote as any).features).toContain("on_off");
    expect((remote as any).features).toContain("toggle");

    const options = (remote as any).options || {};
    expect(Array.isArray(options.simple_commands)).toBe(true);
    expect(options.simple_commands.length > 0).toBe(true);
    expect(Array.isArray(options.button_mapping)).toBe(true);
    expect(Array.isArray(options.user_interface?.pages)).toBe(true);
    expect(options.user_interface.pages.length).toBeGreaterThan(0);
    expect((remote as any).attributes?.state).toBe("UNKNOWN");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

it("Remote entity UI reflects configured input and listening mode options", async () => {
  const tmp = mkTmpDir();
  try {
    const cfgModule = await import("../src/configManager.js");
    if (typeof (cfgModule as any).setConfigDir === "function") {
      (cfgModule as any).setConfigDir(tmp);
    }
    const inputOptions = ["bd", "tv", "net"];
    const lmdOptions = ["stereo", "direct"];
    (cfgModule as any).ConfigManager.save({
      avrs: [{ model: "TX-RZ50", ip: "192.168.1.2", port: 60128, zone: "main", inputSelectorOptions: inputOptions, listeningModeOptions: lmdOptions, entityNameStyle: "short" }]
    });

    const module = await import("../src/entityRegistrar.js");
    const avrStateModule = await import("../src/avrState.js");
    const EntityRegistrar = module.default as any;
    const { avrStateManager } = avrStateModule as any;
    const registrar = new EntityRegistrar(avrStateManager);
    const avrEntry = "TX-RZ50 192.168.1.2 main";

    const remote = registrar.createRemoteEntity(avrEntry, async () => 0);
    const pages = (remote as any).options?.user_interface?.pages;
    expect(Array.isArray(pages)).toBe(true);

    const avrPage = pages[0];
    expect(avrPage.grid).toEqual({ width: 8, height: 8 });
    expect(avrPage.items.filter((item: any) => item.type === "text").map((i: any) => i.text)).not.toContain("BD");

    const inputPage = pages.find((p: any) => p.name === "Source");
    expect(inputPage).toBeTruthy();
    const texts = inputPage.items.filter((item: any) => item.type === "text").map((item: any) => ({ text: item.text, cmd: item.command?.params?.command, x: item.location.x, y: item.location.y }));

    // Configured options rendered as buttons at the top of the input page
    expect(texts).toContainEqual({ text: "Sources:", cmd: undefined, x: 0, y: 0 });
    expect(texts).toContainEqual({ text: "BD", cmd: "INPUT_BD", x: 0, y: 1 });
    expect(texts).toContainEqual({ text: "TV", cmd: "INPUT_TV", x: 1, y: 1 });
    expect(texts).toContainEqual({ text: "NET", cmd: "INPUT_NET", x: 2, y: 1 });
    const inputCmds = texts.filter((t: any) => t.cmd?.startsWith("INPUT_")).length;
    expect(inputCmds).toBe(3);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

it("Remote entity caps large option lists per page without emptying them", async () => {
  const tmp = mkTmpDir();
  try {
    const cfgModule = await import("../src/configManager.js");
    if (typeof (cfgModule as any).setConfigDir === "function") {
      (cfgModule as any).setConfigDir(tmp);
    }
    (cfgModule as any).ConfigManager.save({
      avrs: [{ model: "TX-RZ50", ip: "192.168.1.2", port: 60128, zone: "main", entityNameStyle: "short" }]
    });

    const module = await import("../src/entityRegistrar.js");
    const avrStateModule = await import("../src/avrState.js");
    const EntityRegistrar = module.default as any;
    const { avrStateManager } = avrStateModule as any;
    const registrar = new EntityRegistrar(avrStateManager);
    const avrEntry = "TX-RZ50 192.168.1.2 main";

    const remote = registrar.createRemoteEntity(avrEntry, async () => 0);
    const pages = (remote as any).options?.user_interface?.pages;

    const lmPage = pages.find((p: any) => p.name === "Listening Mode");
    expect(lmPage).toBeTruthy();
    const lmOptions = lmPage.items.filter((item: any) => item.type === "text" && item.command?.params?.command?.startsWith("LISTENING_MODE_")).length;
    expect(lmOptions).toBeGreaterThan(0);

    const sourcePage = pages.find((p: any) => p.name === "Source");
    expect(sourcePage).toBeTruthy();
    const sourceOptions = sourcePage.items.filter((item: any) => item.type === "text" && item.command?.params?.command?.startsWith("INPUT_")).length;
    expect(sourceOptions).toBeGreaterThan(0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
