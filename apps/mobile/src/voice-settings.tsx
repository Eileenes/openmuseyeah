import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { ModelSettingsView } from "./api";
import { useTranslation } from "./i18n";
import { Button, Card, CheckRow, colors, ErrorNotice, Field, SectionHeading, s } from "./ui";
import { useWorkspace } from "./workspace";

const PROVIDERS = ["stub", "openai"] as const;
const LLM_PROVIDERS = ["openai", "anthropic", "google", "custom"] as const;
const LLM_PROVIDER_LABEL: Record<(typeof LLM_PROVIDERS)[number], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  custom: "voice.provider.custom",
};
const PROVIDER_KEY: Record<string, string> = {
  stub: "voice.provider.stub",
  openai: "voice.provider.openai",
};
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function VoiceSettings() {
  const { t } = useTranslation();
  const { api } = useWorkspace();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [view, setView] = useState<ModelSettingsView | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [llmProvider, setLlmProvider] = useState<(typeof LLM_PROVIDERS)[number]>("openai");
  const [llmModel, setLlmModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
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
    setBaseUrl(next.settings.llm.baseUrl ?? "");
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

  useEffect(() => {
    void run("load", load);
  }, [run, load]);

  async function chooseProvider(kind: "stt" | "tts", provider: string) {
    await run(`${kind}-provider`, async () => {
      apply(await api.saveModelSettings({ [kind]: { provider } }));
      setNote(
        t(kind === "stt" ? "voice.note.sttProvider" : "voice.note.ttsProvider", {
          provider: t(PROVIDER_KEY[provider]),
        }),
      );
    });
  }

  async function saveModels() {
    const key = secret.trim();
    await run("save", async () => {
      apply(
        await api.saveModelSettings({
          llm: { provider: llmProvider, model: llmModel.trim(), baseUrl: baseUrl.trim() },
          ...(key ? { keys: { [llmProvider]: key } } : {}),
          stt: { model: sttModel.trim(), language: language.trim() },
          tts: { model: ttsModel.trim(), voiceId: voiceId.trim(), speed: Number(speed) || 1 },
          voice: { speakReplies },
        }),
      );
      setSecret("");
      setNote(t(key ? "voice.keyStored" : "status.saved"));
    });
  }

  async function test() {
    await run("test", async () => {
      const result = await api.testModelSettings();
      const reasoning = result.reasoning.ok
        ? t("voice.test.llmOk", { model: String(result.reasoning.model ?? "") })
        : t("voice.test.llmError", { error: String(result.reasoning.error ?? "") });
      const speech = result.speechToText.ok
        ? t("voice.test.sttOk", { provider: String(result.speechToText.provider ?? "") })
        : t("voice.test.sttError", { error: String(result.speechToText.error ?? "") });
      const voice = result.textToSpeech.ok
        ? t("voice.test.ttsOk", {
            provider: String(result.textToSpeech.provider ?? ""),
            bytes: result.textToSpeech.bytes ?? 0,
          })
        : t("voice.test.ttsError", { error: String(result.textToSpeech.error ?? "") });
      setNote(`${reasoning}\n${speech} · ${voice}`);
    });
  }

  const credential = view?.credentials[llmProvider];
  const custom = llmProvider === "custom";
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.between}>
        <SectionHeading title={t("voice.model.title")} />
        <View style={[s.row, { gap: 8 }]}>
          <Button busy={busy === "test"} disabled={!view} onPress={() => void test()}>
            {t("voice.test")}
          </Button>
          <Button
            primary
            busy={busy === "save"}
            disabled={!view || (custom && !baseUrl.trim())}
            onPress={() => void saveModels()}
          >
            {t("voice.save")}
          </Button>
        </View>
      </View>
      {note ? <Text style={[s.small, { color: colors.blueDark }]}>{note}</Text> : null}
      <ErrorNotice error={error} />
      {!view && <Text style={s.muted}>{t("common.loading")}</Text>}
      {view && (
        <>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            {LLM_PROVIDERS.map((provider) => (
              <Button
                key={provider}
                small
                primary={llmProvider === provider}
                onPress={() => setLlmProvider(provider)}
              >
                {t(LLM_PROVIDER_LABEL[provider], undefined, LLM_PROVIDER_LABEL[provider])}
              </Button>
            ))}
          </View>
          <Field
            label={t("voice.modelId")}
            value={llmModel}
            onChangeText={setLlmModel}
            autoCapitalize="none"
            placeholder={t("voice.modelId.placeholder")}
          />
          <Field
            label={t(custom ? "voice.baseUrl.required" : "voice.baseUrl")}
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder={t(
              custom ? "voice.baseUrl.customPlaceholder" : "voice.baseUrl.placeholder",
            )}
          />
          <Field
            label={t(credential?.stored ? "voice.replaceKey" : "voice.enterKey")}
            value={secret}
            onChangeText={setSecret}
            secureTextEntry
            autoCapitalize="none"
            placeholder={
              credential?.stored
                ? t("voice.credential.stored", { masked: String(credential.masked ?? "") })
                : "sk-…"
            }
          />
          <Button
            small
            onPress={() => setVoiceOpen(!voiceOpen)}
            style={{ alignSelf: "flex-start" }}
          >
            {t(voiceOpen ? "voice.section.close" : "voice.section.open")}
          </Button>
          {voiceOpen && (
            <>
              <Text style={s.label}>{t("voice.stt")}</Text>
              <View style={[s.row, { gap: 8 }]}>
                {PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    small
                    primary={view.settings.stt.provider === provider}
                    onPress={() => void chooseProvider("stt", provider)}
                  >
                    {t(PROVIDER_KEY[provider])}
                  </Button>
                ))}
              </View>
              <Field label={t("voice.stt.model")} value={sttModel} onChangeText={setSttModel} />
              <Field
                label={t("voice.stt.language")}
                value={language}
                onChangeText={setLanguage}
                placeholder={t("voice.stt.language.placeholder")}
              />
              <Text style={s.label}>{t("voice.tts")}</Text>
              <View style={[s.row, { gap: 8 }]}>
                {PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    small
                    primary={view.settings.tts.provider === provider}
                    onPress={() => void chooseProvider("tts", provider)}
                  >
                    {t(PROVIDER_KEY[provider])}
                  </Button>
                ))}
              </View>
              <Field label={t("voice.tts.model")} value={ttsModel} onChangeText={setTtsModel} />
              <Field label={t("voice.tts.voice")} value={voiceId} onChangeText={setVoiceId} />
              <Field
                label={t("voice.tts.speed")}
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
                label={t("voice.speakReplies")}
                checked={speakReplies}
                onPress={() => setSpeakReplies(!speakReplies)}
              />
            </>
          )}
        </>
      )}
    </Card>
  );
}
