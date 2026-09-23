# OpenMuse mobile

A shared React Native workspace for iOS, Android, and the web preview. The client uses native primitives and the CopilotKit headless hooks; the web preview renders those same screens through React Native Web.

## Demos

[![OpenMuse on iPhone — watch the 38-second demo](../../assets/demos/2026-09-16/mobile.png)](../../assets/demos/2026-09-16/mobile.mp4)

[iPhone · 38 seconds](../../assets/demos/2026-09-16/mobile.mp4) · [Desktop web · 42 seconds](../../assets/demos/2026-09-16/web.mp4) · [Recording setup](../../docs/DEMO.md)

Meet OpenMuse's capybara in two different journeys: Hacker News and CopilotKit on iPhone; reading a school-trip email and researching aquarium exhibits on desktop. Results appear inline in chat, with **Take control** opening the same browser session. Send and Stop share the input pill's primary control.

## Run

Start the API from the repository root, then:

```sh
pnpm --dir apps/mobile web
pnpm --dir apps/mobile ios
pnpm --dir apps/mobile android
```

The default API is `http://localhost:8787`, or `http://10.0.2.2:8787` on the Android emulator. Set `EXPO_PUBLIC_API_URL` to your reachable server URL for a physical device or deployment. Live mode asks for the server access key; local mode opens the fictional workspace automatically. Tokens stay in memory.

PDFs use `react-native-pdf` and `react-native-blob-util` in an Expo **development build**. Expo Go does not include these native modules. The config plugins in `app.json` configure the native projects. Web uses the browser’s real PDF reader, with page/zoom controls and download/print access. PDF form fields save a new server artifact.

## Checks

```sh
pnpm --dir apps/mobile typecheck
node --experimental-strip-types --test apps/mobile/test/date-time.test.ts
pnpm --dir apps/mobile build:web
pnpm --dir apps/mobile build:ios
pnpm --dir apps/mobile build:android
```

The `build:ios` and `build:android` commands validate and export platform JavaScript/Hermes bundles. They do not create signed installable apps. `ios` and `android` run Expo’s native development-build workflows and need the platform toolchains.

## Behavior

- Chat, Activity, Ideas, Goals and Apps are the primary navigation. Tasks, timelines and notifications refresh from the durable server state. Apps contains Mail, Calendar, Browser, Files and Connections.
- Drafts are saved in OpenMuse and can be reopened from Mail. Mail attachments import into Files before reading.
- Calendar edits preserve named time zones. Date entry rejects nonexistent times at daylight-saving transitions.
- Sending mail and creating, changing, or deleting events require a stored proposal and an explicit review decision. Editing a proposal declines the previous version, then opens a new draft.
- Chat restores/saves AG-UI conversation messages, renders frontend tool cards, and supports interruption, retry, and document references.
- While the agent replies, the send arrow becomes a stop square in the same input pill. Stop preserves the draft; the arrow returns when the run ends. A new message can continue immediately after stopping when no follow-ups are waiting. Held follow-ups resume through **Send queued messages**.
- Browser previews and consoles use only signed worker URLs returned by the API. PDF downloads import through the worker API.
- Google connects through the system browser. Refresh the workspace after completing OAuth.

Phone and wide layouts share Chat, Activity, Ideas, Goals and Apps. The task and notification sheets restore server state when reopened. Document and browser viewers have platform-specific files; presentation and state remain shared.

## Building for a device

The native projects are generated and their dependencies are installed, so a
local build needs no further setup. Only the cloud build needs an account.

### Local, on your own machine

```sh
cd apps/mobile
npx expo run:ios      # or: npx expo run:android
```

This is the build that has **never been run**. Everything up to it is verified —
the native project is generated, `NSMicrophoneUsageDescription` is present,
`RECORD_AUDIO` is present, and 90 pods are installed — but the app itself has
not been launched on a device, so the microphone, interruption and native
playback paths have no runtime evidence yet.

A real device build is also the only way to check the voice-activity threshold in
`packages/voice/src/utterance.ts`; its default of `0.02` was chosen on paper and
will likely need tuning per device.

### Cloud, with EAS

`eas.json` defines three profiles: `development` (a dev client), `preview`
(an installable APK), and `production` (store builds).

```sh
npx eas-cli login
npx eas-cli build --profile preview --platform ios
```

This needs your Expo account: it uploads the project to Expo's servers, so it is
deliberately not run for you publicly. Once logged in, `eas build` reads
`apps/mobile/eas.json` and `app.json` and needs no other configuration.
