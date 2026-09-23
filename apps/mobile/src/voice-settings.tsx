import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import type { ModelSettingsView } from "./api";
import { Button, Card, CheckRow, colors, ErrorNotice, Field, SectionHeading, s } from "./ui";
import { useWorkspace } from "./workspace";

const PROVIDERS = ["stub", "openai"] as const;
const LLM_PROVIDERS = ["openai", "anthropic", "google"] as const;
const PROVIDER_LABEL: Record<string, string> = {
  stub: "Offline",
  openai: "OpenAI",
};
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Voice and model configuration. Loading happens when the panel is opened so
 * the screen stays cheap for people who never touch it.
 */
export function VoiceSettings() {
  const { api } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ModelSettingsView | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [llmProvider, setLlmProvider] = useState<(typeof LLM_PROVIDERS)[number]>("openai");
  const [llmModel, setLlmModel] = useState("");
  const [sttModel, setSttModel] = useState("");
  const [language, setLanguage] = useState("");
  const [ttsModel, setTtsModel] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speed, setSpeed] = useState("1");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const apply = useCallback((next: ModelSettingsView) => {
    setView(next);
    setSpeakReplies(next.settings.voice.speakReplies);
    setLlmProvider(next.settings.llm.provider);
    setLlmModel(next.settings.llm.model);
    setSttModel(next.settings.stt.model);
    setLanguage(next.settings.stt.language);
    setTtsModel(next.settings.tts.model);
    setVoiceId(next.settings.tts.voiceId);
    setSpeed(String(next.settings.tts.speed));
  }, []);

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setNote("");
    try {
      await action();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy("");
    }
  }, []);

  const load = useCallback(async () => apply(await api.modelSettings()), [api, apply]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !view) await run("load", load);
  }

  async function chooseProvider(kind: "stt" | "tts", provider: string) {
    await run(`${kind}-provider`, async () => {
      apply(await api.saveModelSettings({ [kind]: { provider } }));
      setNote(
        `${kind === "stt" ? "Speech to text" : "Speech"} now uses ${PROVIDER_LABEL[provider]}.`,
      );
    });
  }

  async function saveModels() {
    await run("save", async () => {
      apply(
        await api.saveModelSettings({
          llm: { provider: llmProvider, model: llmModel.trim() },
          stt: { model: sttModel.trim(), language: language.trim() },
          tts: { model: ttsModel.trim(), voiceId: voiceId.trim(), speed: Number(speed) || 1 },
          voice: { speakReplies },
        }),
      );
      setNote("Saved.");
    });
  }

  async function saveKey() {
    await run("key", async () => {
      apply(await api.saveModelSettings({ keys: { openai: secret.trim() } }));
      setSecret("");
      setNote("Key encrypted and stored on the server.");
    });
  }

  async function test() {
    await run("test", async () => {
      const result = await api.testModelSettings();
      const speech = result.speechToText.ok
        ? `Speech to text: ok (${result.speechToText.provider})`
        : `Speech to text: ${result.speechToText.error}`;
      const voice = result.textToSpeech.ok
        ? `Speech: ok (${result.textToSpeech.provider}, ${result.textToSpeech.bytes} bytes)`
        : `Speech: ${result.textToSpeech.error}`;
      setNote(`${speech} · ${voice}`);
    });
  }

  const credential = view?.credentials.openai;
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={toggle}>{open ? "Close voice & models" : "Voice & models"}</Button>
      {open && (
        <Card style={{ gap: 12 }}>
          <SectionHeading title="Voice & models" />
          {!view && <Text style={s.muted}>Loading…</Text>}
          {view && (
            <>
              <Text style={s.label}>Reasoning model</Text>
              <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
                {LLM_PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    small
                    primary={llmProvider === provider}
                    onPress={() => setLlmProvider(provider)}
                  >
                    {provider}
                  </Button>
                ))}
              </View>
              <Field
                label="Model id"
                value={llmModel}
                onChangeText={setLlmModel}
                autoCapitalize="none"
                placeholder="Leave blank to use the server default"
              />
              <Text style={s.small}>
                Credentials for the reasoning model come from the server environment. Changes apply
                to your next message.
              </Text>

              <Text style={s.label}>Speech to text</Text>
              <View style={[s.row, { gap: 8 }]}>
                {PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    small
                    primary={view.settings.stt.provider === provider}
                    onPress={() => void chooseProvider("stt", provider)}
                  >
                    {PROVIDER_LABEL[provider]}
                  </Button>
                ))}
              </View>
              <Field label="Transcription model" value={sttModel} onChangeText={setSttModel} />
              <Field
                label="Spoken language"
                value={language}
                onChangeText={setLanguage}
                placeholder="zh, en, or blank to detect"
              />

              <Text style={s.label}>Spoken replies</Text>
              <View style={[s.row, { gap: 8 }]}>
                {PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    small
                    primary={view.settings.tts.provider === provider}
                    onPress={() => void chooseProvider("tts", provider)}
                  >
                    {PROVIDER_LABEL[provider]}
                  </Button>
                ))}
              </View>
              <Field label="Speech model" value={ttsModel} onChangeText={setTtsModel} />
              <Field label="Voice" value={voiceId} onChangeText={setVoiceId} />
              <Field
                label="Speed"
                value={speed}
                onChangeText={setSpeed}
                keyboardType="numeric"
                placeholder="1"
              />
              {view.voices.length > 1 && (
                <View style={[s.row, { gap: 6, flexWrap: "wrap" }]}>
                  {view.voices.map((option) => (
                    <Button
                      key={option}
                      small
                      primary={voiceId === option}
                      onPress={() => setVoiceId(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </View>
              )}
              <CheckRow
                label="Read replies aloud"
                checked={speakReplies}
                onPress={() => setSpeakReplies(!speakReplies)}
              />

              <Text style={s.label}>OpenAI key</Text>
              <Text style={s.small}>
                {credential?.stored
                  ? `Stored on the server as ${credential.masked}`
                  : credential?.fromEnvironment
                    ? "Using OPENAI_API_KEY from the server environment"
                    : "No key stored. The offline provider needs none."}
              </Text>
              <Field
                label="Replace key"
                value={secret}
                onChangeText={setSecret}
                secureTextEntry
                autoCapitalize="none"
                placeholder="sk-…"
              />

              <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
                <Button small primary busy={busy === "save"} onPress={() => void saveModels()}>
                  Save
                </Button>
                <Button
                  small
                  disabled={secret.trim().length < 8}
                  busy={busy === "key"}
                  onPress={() => void saveKey()}
                >
                  Store key
                </Button>
                <Button small busy={busy === "test"} onPress={() => void test()}>
                  Test providers
                </Button>
              </View>
              {note ? <Text style={[s.small, { color: colors.blueDark }]}>{note}</Text> : null}
            </>
          )}
          <ErrorNotice error={error} />
        </Card>
      )}
    </View>
  );
}
