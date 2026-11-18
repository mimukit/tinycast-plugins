import { Action, ActionPanel, Icon, List, Toast, open, showHUD, showInFinder, showToast } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { ensureSoundFolder, failureMessage, openSession } from "../components/runtime";
import { checkPlayable } from "../playback/playable";
import type { FailureRecord, SessionRecord } from "../playback/session";
import { discoverSounds, type Sound, type SoundSection } from "../sounds/discover";
import { soundLabel } from "../sounds/formats";

interface State {
  loading: boolean;
  root: string;
  sections: SoundSection[];
  current?: SessionRecord;
  failure?: FailureRecord;
}

export default function Command() {
  const [state, setState] = useState<State>({ loading: true, root: "", sections: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const root = ensureSoundFolder();
    const session = openSession();
    let current: SessionRecord | undefined;
    let failure: FailureRecord | undefined;
    try {
      failure = session.takeFailure();
      current = await session.current();
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Cannot read the session", message: failureMessage(error) });
    }
    setState({ loading: false, root, sections: discoverSounds(root), current, failure });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { root, current, failure } = state;

  async function play(sound: Sound) {
    if (current?.file === sound.path) {
      await showHUD(`${sound.label} is already playing`);
      return;
    }
    const check = checkPlayable(root, sound.path);
    if (!check.ok) {
      await showToast({ style: Toast.Style.Failure, title: `Cannot play ${sound.label}`, message: check.message });
      return;
    }
    try {
      await openSession().start(check.path);
      await showHUD(`Playing ${sound.label}`);
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: `Cannot play ${sound.label}`, message: failureMessage(error) });
    }
    await load();
  }

  async function stop() {
    try {
      const result = await openSession().stop();
      await showToast({ style: Toast.Style.Success, title: result === "stopped" ? "Sound stopped" : "Nothing plays" });
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Cannot stop the sound", message: failureMessage(error) });
    }
    await load();
  }

  const common = (path?: string) => (
    <>
      <Action title="Stop" icon={Icon.Stop} shortcut={{ modifiers: ["cmd"], key: "." }} onAction={stop} />
      <Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={load} />
      <Action title="Open Sound Folder" icon={Icon.Folder} shortcut={{ modifiers: ["cmd"], key: "o" }} onAction={() => open(root)} />
      <Action
        title="Show in Finder"
        icon={Icon.Finder}
        shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
        onAction={() => showInFinder(path ?? root)}
      />
    </>
  );

  return (
    <List isLoading={state.loading} searchBarPlaceholder="Search sounds">
      {current ? (
        <List.Section title="Now playing">
          <List.Item
            title={soundLabel(current.file)}
            subtitle="Now playing"
            icon={Icon.SpeakerOn}
            actions={<ActionPanel>{common(current.file)}</ActionPanel>}
          />
        </List.Section>
      ) : failure ? (
        <List.Section title="Now playing">
          <List.Item
            title={`${soundLabel(failure.file)} stopped`}
            subtitle={`The player failed 3 times (exit ${failure.code})`}
            icon={Icon.Warning}
            actions={<ActionPanel>{common(failure.file)}</ActionPanel>}
          />
        </List.Section>
      ) : null}
      {state.sections.map((section) => (
        <List.Section key={section.title} title={section.title}>
          {section.sounds.map((sound) => (
            <List.Item
              key={sound.path}
              title={sound.label}
              subtitle={sound.subtitle}
              icon={current?.file === sound.path ? Icon.SpeakerOn : Icon.Music}
              accessories={current?.file === sound.path ? [{ text: "Playing" }] : undefined}
              actions={
                <ActionPanel>
                  <Action title="Play" icon={Icon.Play} onAction={() => play(sound)} />
                  {common(sound.path)}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
      <List.EmptyView
        title="No sounds yet"
        description={`Add .m4a, .aac, .mp3, .wav, .aif, .aiff or .caf files to ${root}`}
        icon={Icon.Music}
        actions={
          <ActionPanel>
            <Action title="Open Sound Folder" icon={Icon.Folder} onAction={() => open(root)} />
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={load} />
          </ActionPanel>
        }
      />
    </List>
  );
}
