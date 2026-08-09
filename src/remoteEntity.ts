/*jslint node:true nomen:true*/
"use strict";
import * as uc from "@unfoldedcircle/integration-api";
import { ALL_SIMPLE_COMMANDS } from "./simpleCommands.js";
import { REMOTE_SUFFIX } from "./sensorSuffixes.js";

type CmdHandlerFn = (entity: uc.Entity, cmdId: string, params?: { [key: string]: string | number | boolean }) => Promise<uc.StatusCodes>;

// Remote entity — optional (createRemoteEntity config). Exposes the same media-player style commands as the media player
// entity plus the generated simple commands, mapped to physical buttons and UI pages.
export function createRemoteEntity(avrEntry: string, displayBaseName: string, cmdHandler?: CmdHandlerFn): uc.Remote {
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
      uiPages: buildRemoteUiPages(),
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
    uc.createBtnMapping(uc.Buttons.ChannelDown, uc.MediaPlayerCommands.ChannelDown),
    uc.createBtnMapping(uc.Buttons.DpadUp, uc.MediaPlayerCommands.CursorUp),
    uc.createBtnMapping(uc.Buttons.DpadDown, uc.MediaPlayerCommands.CursorDown),
    uc.createBtnMapping(uc.Buttons.DpadLeft, uc.MediaPlayerCommands.CursorLeft),
    uc.createBtnMapping(uc.Buttons.DpadRight, uc.MediaPlayerCommands.CursorRight),
    uc.createBtnMapping(uc.Buttons.DpadMiddle, uc.MediaPlayerCommands.CursorEnter),
    uc.createBtnMapping(uc.Buttons.VolumeUp, uc.MediaPlayerCommands.VolumeUp),
    uc.createBtnMapping(uc.Buttons.VolumeDown, uc.MediaPlayerCommands.VolumeDown),
    uc.createBtnMapping(uc.Buttons.Mute, uc.MediaPlayerCommands.MuteToggle),
    uc.createBtnMapping(uc.Buttons.Power, uc.MediaPlayerCommands.Toggle)
  ];
}

// Remote UI command pages — modeled after the Yamaha AVR integration.
function buildRemoteUiPages(): uc.UiPage[] {
  const pages: uc.UiPage[] = [];

  const avrPage = new uc.UiPage("onkyo_avr_commands", "AVR commands", new uc.Size(4, 7));
  avrPage.add(uc.createUiIcon("uc:power-on", 0, 0, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Toggle)));
  
  avrPage.add(uc.createUiText("Vol", 0, 1, undefined, new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:mute", 1, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.MuteToggle), new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:minus", 2, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.VolumeDown), new uc.Size(1, 1)));
  avrPage.add(uc.createUiIcon("uc:plus", 3, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.VolumeUp), new uc.Size(1, 1)));
  
  // avrPage.add(uc.createUiText("Dimmer", 0, 2, undefined, new uc.Size(4, 1)));
  // avrPage.add(uc.createUiText("Bright", 1, 2, uc.createRemoteSendCmd("DIMMER_BRIGHT")));
  // avrPage.add(uc.createUiText("Dim", 2, 2, uc.createRemoteSendCmd("DIMMER_DIM")));
  // avrPage.add(uc.createUiText("Dark", 3, 2, uc.createRemoteSendCmd("DIMMER_DARK")));
  
  // avrPage.add(uc.createUiText("Listening Mode", 0, 4, undefined, new uc.Size(4, 1)));
  // avrPage.add(uc.createUiText("Stereo", 0, 5, uc.createRemoteSendCmd("LISTENING_MODE_STEREO"), new uc.Size(2, 1)));
  // avrPage.add(uc.createUiText("Direct", 2, 5, uc.createRemoteSendCmd("LISTENING_MODE_DIRECT"), new uc.Size(2, 1)));
  // avrPage.add(uc.createUiText("All Ch Stereo", 0, 6, uc.createRemoteSendCmd("LISTENING_MODE_ALL_CH_STEREO"), new uc.Size(2, 1)));
  // avrPage.add(uc.createUiText("Surround", 2, 6, uc.createRemoteSendCmd("LISTENING_MODE_SURROUND"), new uc.Size(2, 1)));
  pages.push(avrPage);

  const dPadPage = new uc.UiPage("TV direction pad", "TV direction pad", new uc.Size(3, 3));
  dPadPage.add(uc.createUiIcon("uc:back", 0, 0, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Back)));
  dPadPage.add(uc.createUiIcon("uc:up-arrow", 1, 0, uc.createRemoteSendCmd(uc.MediaPlayerCommands.CursorUp)));
  dPadPage.add(uc.createUiIcon("uc:home", 2, 0, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Home)));
  dPadPage.add(uc.createUiIcon("uc:left-arrow", 0, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.CursorLeft)));
  dPadPage.add(uc.createUiText("OK", 1, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.CursorEnter)));
  dPadPage.add(uc.createUiIcon("uc:right-arrow", 2, 1, uc.createRemoteSendCmd(uc.MediaPlayerCommands.CursorRight)));
  dPadPage.add(uc.createUiIcon("uc:down-arrow", 1, 2, uc.createRemoteSendCmd(uc.MediaPlayerCommands.CursorDown)));
  dPadPage.add(uc.createUiText("Settings", 0, 2, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Settings), new uc.Size(1, 1)));
  dPadPage.add(uc.createUiText("Exit", 2, 2, uc.createRemoteSendCmd(uc.MediaPlayerCommands.Back)));
  pages.push(dPadPage);

  // const inputsPage = new uc.UiPage("Inputs & More", "Inputs & More", new uc.Size(4, 4));
  // inputsPage.add(uc.createUiText("Inputs", 0, 0, undefined, new uc.Size(4, 1)));
  // inputsPage.add(uc.createUiText("BD/DVD", 0, 1, uc.createRemoteSendCmd("INPUT_BD")));
  // inputsPage.add(uc.createUiText("TV", 1, 1, uc.createRemoteSendCmd("INPUT_TV")));
  // inputsPage.add(uc.createUiText("CD", 2, 1, uc.createRemoteSendCmd("INPUT_CD")));
  // inputsPage.add(uc.createUiText("NET", 3, 1, uc.createRemoteSendCmd("INPUT_NET")));
  // inputsPage.add(uc.createUiText("Bluetooth", 0, 2, uc.createRemoteSendCmd("INPUT_BLUETOOTH"), new uc.Size(2, 1)));
  // inputsPage.add(uc.createUiText("TuneIn", 2, 2, uc.createRemoteSendCmd("INPUT_TUNEIN"), new uc.Size(2, 1)));
  // inputsPage.add(uc.createUiText("Preset Up", 0, 3, uc.createRemoteSendCmd("PRESET_UP")));
  // inputsPage.add(uc.createUiText("Preset Down", 1, 3, uc.createRemoteSendCmd("PRESET_DOWN")));
  // inputsPage.add(uc.createUiText("Speaker A", 2, 3, uc.createRemoteSendCmd("SPEAKER_A_ON")));
  // inputsPage.add(uc.createUiText("Speaker B", 3, 3, uc.createRemoteSendCmd("SPEAKER_B_ON")));
  // pages.push(inputsPage);

  return pages;
}
