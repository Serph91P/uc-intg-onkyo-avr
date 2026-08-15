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

const GRID_WIDTH = 7;
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

  const avrPage1 = new uc.UiPage("onkyo_avr_commands", "AVR commands (1)", new uc.Size(GRID_WIDTH, 8));
  avrPage1.add(uc.createUiIcon("uc:power-on", 0, 0, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Toggle)));
  avrPage1.add(uc.createUiText("SLEEP", 6, 0, uc.createRemoteSendCmd("SLEEP_UP"), new uc.Size(1, 1)));
  
  avrPage1.add(uc.createUiText("Settings:", 0, 1, undefined, new uc.Size(2, 1)));
  avrPage1.add(uc.createUiText("Quick", 3, 1, uc.createRemoteSendCmd("SETUP_QUICK"), new uc.Size(1, 1)));
  avrPage1.add(uc.createUiText("Full", 6, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Settings), new uc.Size(1, 1)));
  
  avrPage1.add(uc.createUiText("Treble:", 0, 2, undefined, new uc.Size(2, 1)));
  avrPage1.add(uc.createUiIcon("uc:minus", 3, 2, uc.createRemoteSendCmd("TONE_FRONT_TREBLE_DOWN"), new uc.Size(1, 1)));
  avrPage1.add(uc.createUiIcon("uc:plus", 6, 2, uc.createRemoteSendCmd("TONE_FRONT_TREBLE_UP"), new uc.Size(1, 1)));

  avrPage1.add(uc.createUiText("Vocal:", 0, 3, undefined, new uc.Size(2, 1)));
  avrPage1.add(uc.createUiIcon("uc:minus", 3, 3, uc.createRemoteSendCmd("VOCAL_DOWN"), new uc.Size(1, 1)));
  avrPage1.add(uc.createUiIcon("uc:plus", 6, 3, uc.createRemoteSendCmd("VOCAL_UP"), new uc.Size(1, 1)));

  avrPage1.add(uc.createUiText("Bass:", 0, 4, undefined, new uc.Size(2, 1)));
  avrPage1.add(uc.createUiIcon("uc:minus", 3, 4, uc.createRemoteSendCmd("TONE_FRONT_BASS_DOWN"), new uc.Size(1, 1)));
  avrPage1.add(uc.createUiIcon("uc:plus", 6, 4, uc.createRemoteSendCmd("TONE_FRONT_BASS_UP"), new uc.Size(1, 1)));

  avrPage1.add(uc.createUiText("Center:", 0, 5, undefined, new uc.Size(2, 1)));
  avrPage1.add(uc.createUiIcon("uc:minus", 3, 5, uc.createRemoteSendCmd("CENTER_TEMP_LEVEL_DOWN"), new uc.Size(1, 1)));
  avrPage1.add(uc.createUiIcon("uc:plus", 6, 5, uc.createRemoteSendCmd("CENTER_TEMP_LEVEL_UP"), new uc.Size(1, 1))); 

  avrPage1.add(uc.createUiText("Subwoofer:", 0, 6, undefined, new uc.Size(2, 1)));
  avrPage1.add(uc.createUiIcon("uc:minus", 3, 6, uc.createRemoteSendCmd("SUBWOOFER_TEMP_LEVEL_DOWN"), new uc.Size(1, 1)));
  avrPage1.add(uc.createUiIcon("uc:plus", 6, 6, uc.createRemoteSendCmd("SUBWOOFER_TEMP_LEVEL_UP"), new uc.Size(1, 1)));
  pages.push(avrPage1);

  const avrPage2 = new uc.UiPage("onkyo_avr_commands", "AVR commands (2)", new uc.Size(GRID_WIDTH, 8));
  avrPage2.add(uc.createUiText("Listening Mode:", 0, 0, undefined, new uc.Size(7, 1)));
  avrPage2.add(uc.createUiText("Music", 0, 1, uc.createRemoteSendCmd("LISTENING_MODE_MUSIC"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("Movie", 2, 1, uc.createRemoteSendCmd("LISTENING_MODE_MOVIE"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("Game", 4, 1, uc.createRemoteSendCmd("LISTENING_MODE_GAME"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("THX", 6, 1, uc.createRemoteSendCmd("LISTENING_MODE_THX"), new uc.Size(1, 1)));
  
  avrPage2.add(uc.createUiText("Dirac:", 0, 3, undefined, new uc.Size(7, 1)));
  avrPage2.add(uc.createUiText("Slot1", 0, 4, uc.createRemoteSendCmd("DIRAC_SLOT1"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("Slot2", 2, 4, uc.createRemoteSendCmd("DIRAC_SLOT2"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("Slot3", 4, 4, uc.createRemoteSendCmd("DIRAC_SLOT3"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("Off", 6, 4, uc.createRemoteSendCmd("DIRAC_OFF"), new uc.Size(1, 1)));


  avrPage2.add(uc.createUiText("LateNight", 0, 6, uc.createRemoteSendCmd("LATE_NIGHT_UP"), new uc.Size(2, 1)));  
  avrPage2.add(uc.createUiText("MusicOptimizer", 4, 6, uc.createRemoteSendCmd("MUSIC_OPTIMIZER_UP"), new uc.Size(3, 1)));
  avrPage2.add(uc.createUiText("AccuEQ", 0, 7, uc.createRemoteSendCmd("ACCUEQ_UP"), new uc.Size(2, 1)));
  avrPage2.add(uc.createUiText("StereoAssign", 4, 7, uc.createRemoteSendCmd("STEREO_ASSIGN_UP"), new uc.Size(3, 1)));

  pages.push(avrPage2);

  const avrPage3 = new uc.UiPage("onkyo_avr_commands", "AVR commands (3)", new uc.Size(GRID_WIDTH, 8));
  avrPage3.add(uc.createUiText("HDMI", 0, 0, uc.createRemoteSendCmd("HDMI_OUTPUT_UP"), new uc.Size(7, 1)));
  avrPage3.add(uc.createUiText("LipSync", 0, 1, uc.createRemoteSendCmd("LIP_SYNC_UP"), new uc.Size(7, 1))); 
  avrPage3.add(uc.createUiText("PanelDisplayMode", 0, 2, uc.createRemoteSendCmd("DISPLAY_MODE_TOGGLE"), new uc.Size(7, 1)));

  avrPage3.add(uc.createUiIcon("uc:light-on", 0, 3, undefined, new uc.Size(1, 1)));
  avrPage3.add(uc.createUiText("Dark", 1, 3, uc.createRemoteSendCmd("DIMMER_DARK"), new uc.Size(2, 1)));
  avrPage3.add(uc.createUiText("Dim", 3, 3, uc.createRemoteSendCmd("DIMMER_DIM"), new uc.Size(2, 1)));
  avrPage3.add(uc.createUiText("Bright", 5, 3, uc.createRemoteSendCmd("DIMMER_BRIGHT"), new uc.Size(2, 1)));
  pages.push(avrPage3);

  if (sources.length > 0) {
    const sourcePage = new uc.UiPage("onkyo_avr_commands", "Configured Sources", new uc.Size(GRID_WIDTH, 1 + Math.ceil(sources.length / GRID_WIDTH)));
    addOptionRows(sourcePage, "Sources:", 0, sources, "INPUT", ["up", "down"]);
    pages.push(sourcePage);
  }

  if (listeningModes.length > 0) {
    const lmPage = new uc.UiPage("onkyo_avr_commands", "Configured Listening Modes", new uc.Size(GRID_WIDTH, 1 + Math.ceil(listeningModes.length / GRID_WIDTH)));
    addOptionRows(lmPage, "Listening Modes:", 0, listeningModes, "LISTENING_MODE", ["up", "down"]);
    pages.push(lmPage);
  }

  return pages;
}
