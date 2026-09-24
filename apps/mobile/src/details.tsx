import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Download, Save } from "lucide-react-native";
import { useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import type { Artifact } from "../../../packages/domain/src";
import { DelegateSheet, NotificationsSheet, TaskDetail } from "./agent-ui";
import { useTranslation } from "./i18n";
import PdfReader from "./PdfReader";
import {
  Button,
  Card,
  CheckRow,
  dateLabel,
  ErrorNotice,
  Field,
  SectionHeading,
  Sheet,
  s,
} from "./ui";
import { type Detail, useWorkspace } from "./workspace";
export function Details({ detail }: { detail: Detail }) {
  if (detail.type === "task") return <TaskDetail taskId={detail.taskId} />;
  if (detail.type === "delegate") return <DelegateSheet />;
  if (detail.type === "notifications") return <NotificationsSheet />;
  return <FileDetail file={detail.file} />;
}
function FileDetail({ file: f }: { file: Artifact }) {
  const { t } = useTranslation();
  const { api, refresh, open, close } = useWorkspace();
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      (f.fields || [])
        .filter((field) => field.type !== "unsupported")
        .map((field) => [
          field.name,
          field.type === "checkbox" ? field.value === "true" || field.value === "Yes" : field.value,
        ]),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = api.url(f.url || `/api/files/${f.id}/content`);
  async function fill() {
    setBusy(true);
    setError("");
    try {
      const file = await api.request<Artifact>(`/api/files/${f.id}/fill`, { fields: values });
      await refresh();
      open({ type: "file", file });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    setError("");
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(url);
        return;
      }
      const target = `${FileSystem.cacheDirectory}${f.id}.pdf`;
      await FileSystem.downloadAsync(url, target, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(target, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      else throw new Error(t("files.shareUnavailable"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Sheet
      title={f.name}
      subtitle={t("files.detail", {
        count: f.pageCount,
        size: Math.max(1, Math.round(f.size / 1024)),
        source: f.source,
      })}
      onClose={close}
      wide
    >
      <PdfReader url={url} token={api.token} pageCount={f.pageCount} />
      <View style={[s.row, { gap: 10, marginVertical: 18, flexWrap: "wrap" }]}>
        <Button icon={Download} onPress={() => void share()}>
          {t(Platform.OS === "web" ? "files.openDownload" : "files.saveShare")}
        </Button>
      </View>
      {f.fields && f.fields.length > 0 && (
        <Card>
          <SectionHeading title={t("files.fillForm")} />
          <Text style={[s.muted, { marginBottom: 18 }]}>{t("files.fillForm.detail")}</Text>
          {f.fields.map((field) =>
            field.type === "unsupported" ? (
              <Text key={field.name} style={s.muted}>
                {t("files.unsupportedField", { name: field.name })}
              </Text>
            ) : field.type === "checkbox" ? (
              <CheckRow
                key={field.name}
                checked={!!values[field.name]}
                label={field.name.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())}
                onPress={() => setValues({ ...values, [field.name]: !values[field.name] })}
              />
            ) : (
              <Field
                key={field.name}
                label={field.name.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())}
                value={String(values[field.name] || "")}
                onChangeText={(value) => setValues({ ...values, [field.name]: value })}
              />
            ),
          )}
          <Button primary icon={Save} busy={busy} onPress={() => void fill()}>
            {t("files.saveCopy")}
          </Button>
        </Card>
      )}
      <ErrorNotice error={error} />
      <Text style={[s.small, { marginTop: 15 }]}>
        {t("files.added", { date: dateLabel(f.createdAt) })}
        {f.parentId ? ` · ${t("files.filledCopy")}` : ""}
      </Text>
    </Sheet>
  );
}
