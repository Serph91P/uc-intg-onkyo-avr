/*jslint node:true nomen:true*/
"use strict";
import * as uc from "@unfoldedcircle/integration-api";
import { ALL_SIMPLE_COMMANDS, SIMPLE_COMMANDS_MAP } from "./simpleCommands.js";
import { REMOTE_SUFFIX } from "./sensorSuffixes.js";
import log from "./loggers.js";

type CmdHandlerFn = (entity: uc.Entity, cmdId: string, params?: { [key: string]: string | number | boolean }) => Promise<uc.StatusCodes>;

// Optional per-AVR option lists used to build the source / listening-mode UI rows. When a user configured a custom
// list for the corresponding Select entity, the remote entity reflects exactly that list instead of every possible value.
type RemoteUiOptions = {
  inputSelectorOptions?: string[];
  listeningModeOptions?: string[];
};

const GRID_WIDTH = 4;
const MAX_GRID_HEIGHT = 12;

// Remote entity — optional (createRemoteEntity config). Exposes the same media-player style commands as the media player
// entity plus the generated simple commands, mapped to physical buttons and UI pages.
export function createRemoteEntity(avrEntry: string, displayBaseName: string, cmdHandler?: CmdHandlerFn, uiOptions: RemoteUiOptions = {}): uc.Remote {
  const remoteEntity = new uc.Remote(
    `${avrEntry}${REMOTE_SUFFIX}`,
    { en: `${displayBaseName} Remote` },
    {
      features: [uc.RemoteFeatures.OnOff, uc.RemoteFeatures.Toggle],
      attributes: {
        [uc.RemoteAttributes.State]: uc.RemoteStates.Unknown
      },
      simpleCommands: ALL_SIMPLE_COMMANDS,
      buttonMapping: buildRemoteButtonMapping(),
      uiPages: buildRemoteUiPages(uiOptions.inputSelectorOptions ?? [], uiOptions.listeningModeOptions ?? []),
      cmdHandler
    }
  );
  return remoteEntity;
}

// Physical button mapping for the remote entity — all commands are handled by remoteEntityCommandHandler.
function buildRemoteButtonMapping(): uc.DeviceButtonMapping[] {
  return [
    uc.createBtnMapping(uc.Buttons.Back, uc.MediaPlayerCommands.Back),
    uc.createBtnMapping(uc.Buttons.Home, uc.MediaPlayerCommands.Home),
    uc.createBtnMapping(uc.Buttons.ChannelUp, uc.MediaPlayerCommands.ChannelUp),
    uc.createBtnMapping(uc.Buttons.ChannelDown, uc.MediaPlayerCommands.ChannelDown),
    uc.createBtnMapping(uc.Buttons.DpadUp, uc.MediaPlayerCommands.CursorUp),
    uc.createBtnMapping(uc.Buttons.DpadDown, uc.MediaPlayerCommands.CursorDown),
    uc.createBtnMapping(uc.Buttons.DpadLeft, uc.MediaPlayerCommands.CursorLeft),
    uc.createBtnMapping(uc.Buttons.DpadRight, uc.MediaPlayerCommands.CursorRight),
    uc.createBtnMapping(uc.Buttons.DpadMiddle, uc.MediaPlayerCommands.CursorEnter),
    uc.createBtnMapping(uc.Buttons.VolumeUp, uc.MediaPlayerCommands.VolumeUp),
    uc.createBtnMapping(uc.Buttons.VolumeDown, uc.MediaPlayerCommands.VolumeDown),
    uc.createBtnMapping(uc.Buttons.Mute, uc.MediaPlayerCommands.MuteToggle),
    uc.createBtnMapping(uc.Buttons.Power, uc.MediaPlayerCommands.Toggle),
    uc.createBtnMapping(uc.Buttons.Play, uc.MediaPlayerCommands.PlayPause),
    uc.createBtnMapping(uc.Buttons.Prev, uc.MediaPlayerCommands.Previous),
    uc.createBtnMapping(uc.Buttons.Next, uc.MediaPlayerCommands.Next)
  ];
}

// Build the simple-command id for an option, e.g. "dolby-virtual" → "LISTENING_MODE_DOLBY_VIRTUAL".
function toSimpleCmdId(prefix: string, option: string): string {
  return `${prefix}_${option.replace(/-/g, "_").toUpperCase()}`;
}

// Append a header row plus one button per option (wrapping every GRID_WIDTH columns). Options without a generated
// simple command are skipped. Returns the number of rows used (0 when nothing was added).
function addOptionRows(page: uc.UiPage, label: string, startY: number, options: string[], prefix: string, excludeValues: string[]): number {
  const usable = options.filter((option) => {
    if (excludeValues.includes(option)) return false;
    const cmdId = toSimpleCmdId(prefix, option);
    if (!SIMPLE_COMMANDS_MAP[cmdId]) {
      log.warn("remoteEntity: skipping '%s' option '%s' - no simple command generated", prefix, option);
      return false;
    }
    return true;
  });
  if (usable.length === 0) return 0;

  page.add(uc.createUiText(label, 0, startY, undefined, new uc.Size(GRID_WIDTH, 1)));
  usable.forEach((option, i) => {
    const x = i % GRID_WIDTH;
    const y = startY + 1 + Math.floor(i / GRID_WIDTH);
    page.add(uc.createUiText(option.toUpperCase(), x, y, uc.createRemoteSendCmd(toSimpleCmdId(prefix, option))));
  });
  return 1 + Math.ceil(usable.length / GRID_WIDTH);
}

function buildRemoteUiPages(inputSelectorOptions: string[], listeningModeOptions: string[]): uc.UiPage[] {
  const pages: uc.UiPage[] = [];

  // Each option page fits on its own grid: one header row plus GRID_WIDTH buttons per remaining row.
  const capToPage = (label: string, options: string[]): string[] => {
    const maxOptions = (MAX_GRID_HEIGHT - 1) * GRID_WIDTH;
    if (options.length > maxOptions) {
      log.warn("remoteEntity: too many %s options (%d), showing first %d on remote UI", label, options.length, maxOptions);
      return options.slice(0, maxOptions);
    }
    return options;
  };

  const sources = capToPage("input selector", inputSelectorOptions);
  const listeningModes = capToPage("listening mode", listeningModeOptions);

  const avrPage = new uc.UiPage("onkyo_avr_commands", "AVR commands", new uc.Size(8, 8));
  avrPage.add(uc.createUiIcon("uc:power-on", 0, 0, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Toggle)));
  avrPage.add(uc.createUiIcon("uc:memo-circle-info", 3, 0, uc.createRemoteSendCmd("DISPLAY_MODE_TOGGLE"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiText("HDMI", 4, 0, uc.createRemoteSendCmd("HDMI_OUTPUT_UP"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiText("SLEEP", 6, 0, uc.createRemoteSendCmd("SLEEP_UP"), new uc.Size(1, 1)));

  avrPage.add(uc.createUiText("Settings:", 0, 1, undefined, new uc.Size(2, 1)));
  avrPage.add(uc.createUiText("Quick", 3, 1, uc.createRemoteSendCmd("SETUP_QUICK"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiText("Full", 6, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Settings), new uc.Size(1, 1)));

  avrPage.add(uc.createUiText("Treble:", 0, 2, undefined, new uc.Size(2, 1)));
  avrPage.add(uc.createUiIcon("uc:minus", 3, 2, uc.createRemoteSendCmd("TONE_FRONT_TREBLE_DOWN"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:plus", 6, 2, uc.createRemoteSendCmd("TONE_FRONT_TREBLE_UP"), new uc.Size(1, 1)));

  avrPage.add(uc.createUiText("Vocal:", 0, 3, undefined, new uc.Size(2, 1)));
  avrPage.add(uc.createUiIcon("uc:minus", 3, 3, uc.createRemoteSendCmd("VOCAL_DOWN"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:plus", 6, 3, uc.createRemoteSendCmd("VOCAL_UP"), new uc.Size(1, 1)));

  avrPage.add(uc.createUiText("Bass:", 0, 4, undefined, new uc.Size(2, 1)));
  avrPage.add(uc.createUiIcon("uc:minus", 3, 4, uc.createRemoteSendCmd("TONE_FRONT_BASS_DOWN"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:plus", 6, 4, uc.createRemoteSendCmd("TONE_FRONT_BASS_UP"), new uc.Size(1, 1)));

  avrPage.add(uc.createUiText("Subwoofer:", 0, 5, undefined, new uc.Size(2, 1)));
  avrPage.add(uc.createUiIcon("uc:minus", 3, 5, uc.createRemoteSendCmd("SUBWOOFER_TEMP_LEVEL_DOWN"), new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:plus", 6, 5, uc.createRemoteSendCmd("SUBWOOFER_TEMP_LEVEL_UP"), new uc.Size(1, 1)));

  avrPage.add(uc.createUiIcon("uc:speakers", 0, 6, undefined, new uc.Size(1, 1)));
  avrPage.add(uc.createUiText("Music", 1, 6, uc.createRemoteSendCmd("LISTENING_MODE_MUSIC"), new uc.Size(2, 1)));
  avrPage.add(uc.createUiText("Movie", 3, 6, uc.createRemoteSendCmd("LISTENING_MODE_MOVIE"), new uc.Size(2, 1)));
  avrPage.add(uc.createUiText("Game", 5, 6, uc.createRemoteSendCmd("LISTENING_MODE_GAME"), new uc.Size(2, 1)));
  avrPage.add(uc.createUiText("THX", 7, 6, uc.createRemoteSendCmd("LISTENING_MODE_THX"), new uc.Size(1, 1)));

  avrPage.add(uc.createUiIcon("uc:light-on", 0, 7, undefined, new uc.Size(1, 1)));
  avrPage.add(uc.createUiText("Dark", 1, 7, uc.createRemoteSendCmd("DIMMER_DARK"), new uc.Size(2, 1)));
  avrPage.add(uc.createUiText("Dim", 3, 7, uc.createRemoteSendCmd("DIMMER_DIM"), new uc.Size(2, 1)));
  avrPage.add(uc.createUiText("Bright", 5, 7, uc.createRemoteSendCmd("DIMMER_BRIGHT"), new uc.Size(2, 1)));
  pages.push(avrPage);

  if (sources.length > 0) {
    const sourcePage = new uc.UiPage("onkyo_avr_commands", "Source", new uc.Size(GRID_WIDTH, 1 + Math.ceil(sources.length / GRID_WIDTH)));
    addOptionRows(sourcePage, "Sources:", 0, sources, "INPUT", ["up", "down"]);
    pages.push(sourcePage);
  }

  if (listeningModes.length > 0) {
    const lmPage = new uc.UiPage("onkyo_avr_commands", "Listening Mode", new uc.Size(GRID_WIDTH, 1 + Math.ceil(listeningModes.length / GRID_WIDTH)));
    addOptionRows(lmPage, "Listening Modes:", 0, listeningModes, "LISTENING_MODE", ["up", "down"]);
    pages.push(lmPage);
  }

  return pages;
}
