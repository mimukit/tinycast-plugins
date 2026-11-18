import { showHUD } from "@raycast/api";
import { failureMessage, openSession } from "../components/runtime";
import { soundLabel } from "../sounds/formats";

export default async function Command() {
  try {
    const session = openSession();
    const current = await session.current();
    const result = await session.stop();
    await showHUD(result === "stopped" ? `Stopped ${current ? soundLabel(current.file) : "the sound"}` : "Nothing plays");
  } catch (error) {
    await showHUD(failureMessage(error));
  }
}
