import { showHUD } from "@raycast/api";
import { ensureSoundFolder, failureMessage, openSession } from "../components/runtime";
import { checkPlayable } from "../playback/playable";
import { soundLabel } from "../sounds/formats";

export default async function Command() {
  try {
    const root = ensureSoundFolder();
    const result = await openSession().toggle((file) => checkPlayable(root, file).ok);
    switch (result.action) {
      case "stopped":
        await showHUD("Sound stopped");
        break;
      case "started":
        await showHUD(`Playing ${soundLabel(result.file)}`);
        break;
      case "no-last":
        await showHUD("No last sound. Pick one in Play Noise.");
        break;
      case "unplayable":
        await showHUD(`Cannot play ${soundLabel(result.file)}. Pick a sound in Play Noise.`);
        break;
    }
  } catch (error) {
    await showHUD(failureMessage(error));
  }
}
