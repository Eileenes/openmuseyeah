import {
  Bell,
  ChevronRight,
  FileText,
  Lightbulb,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Target,
  Users,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Artifact } from "../../../packages/domain/src";
import type {
  AgentArtifact,
  AgentMemory,
  AgentTask,
  Evidence,
  Goal,
  RunEvent,
} from "../../../packages/domain/src/agent";
import { useAgentWorkspace } from "./agent-workspace";
import { LANGUAGES, useLanguage, useTranslation } from "./i18n";
import {
  Button,
  Card,
  CheckRow,
  Chip,
  colors,
  Empty,
  ErrorNotice,
  Field,
  LinkRow,
  Mascot,
  resultSummary,
  SectionHeading,
  Sheet,
  s,
} from "./ui";
import { VoiceSettings } from "./voice-settings";
import { useWorkspace } from "./workspace";

export function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
function stamp(value: string | undefined, notChecked: string) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : notChecked;
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
function activeTask(task: AgentTask) {
  return !["succeeded", "failed", "cancelled"].includes(task.status);
}
export function AgentStatus() {
  const { t } = useTranslation();
  const { data, error, refresh } = useAgentWorkspace();
  if (data?.worker.running && !error) return null;
  return (
    <View style={{ gap: 8 }}>
      <ErrorNotice error={error ? t("agent.status.unavailable", { error }) : ""} />
      {error && (
        <Button small onPress={() => void refresh().catch(() => {})}>
          {t("agent.status.reconnect")}
        </Button>
      )}
      {!data && !error && <ActivityIndicator color={colors.blueDark} />}
    </View>
  );
}
export function TaskCard({
  task,
  compact = false,
  onOpen,
}: {
  task: AgentTask;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const { open } = useWorkspace();
  const done = task.plan.filter((step) => step.status === "succeeded").length;
  const next = task.plan.find((step) => ["running", "waiting"].includes(step.status));
  const waiting = ["waiting_input", "waiting_approval"].includes(task.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("agent.task.open", { title: task.title })}
      onPress={() => {
        onOpen?.();
        open({ type: "task", taskId: task.id });
      }}
    >
      <Card
        style={{
          padding: compact ? 15 : 20,
          gap: 11,
          borderRadius: 22,
          backgroundColor: "#F0F1F2",
        }}
      >
        <View style={[s.row, { gap: 10 }]}>
          <View
            style={[
              s.iconBox,
              { width: 34, height: 34, backgroundColor: waiting ? colors.orange : colors.sky },
            ]}
          >
            <ListChecks size={18} color={colors.blueDark} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.heading}>{task.title}</Text>
            <Text style={s.small}>
              {statusLabel(task.status)}
              {task.plan.length
                ? ` · ${t("agent.task.steps", { done, total: task.plan.length })}`
                : ""}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.muted} />
        </View>
        {!!task.plan.length && (
          <View style={{ height: 4, backgroundColor: colors.line, borderRadius: 4 }}>
            <View
              style={{
                height: 4,
                width: `${Math.round((done / task.plan.length) * 100)}%`,
                backgroundColor: "#6AAEE0",
                borderRadius: 4,
              }}
            />
          </View>
        )}
        {(task.question || task.result || task.error || next?.title) && (
          <Text numberOfLines={compact ? 2 : 4} style={s.muted}>
            {task.question || task.error || resultSummary(task.result || next?.title || "")}
          </Text>
        )}
        {waiting && (
          <Text style={[s.small, { color: colors.blueDark, fontWeight: "600" }]}>
            {t(
              task.status === "waiting_approval"
                ? "agent.task.reviewRequested"
                : "agent.task.inputNeeded",
            )}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}
export function ChatWork() {
  const { data } = useAgentWorkspace();
  const tasks = [...(data?.tasks || [])]
    .filter(activeTask)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 2);
  if (!tasks.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {tasks.map((task) => (
        <TaskCard task={task} key={task.id} compact />
      ))}
    </View>
  );
}
export function AgentActivityScreen() {
  const { t } = useTranslation();
  const { data } = useAgentWorkspace();
  const [filter, setFilter] = useState("All");
  const tasks = [...(data?.tasks || [])]
    .filter(
      (task) =>
        filter === "All" || (filter === "In progress" ? activeTask(task) : !activeTask(task)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <View style={{ gap: 20 }}>
      <AgentStatus />
      <View style={[s.row, { gap: 8 }]}>
        {(
          [
            ["All", "agent.activity.all"],
            ["In progress", "agent.activity.inProgress"],
            ["Finished", "agent.activity.finished"],
          ] as const
        ).map(([item, labelKey]) => (
          <Button key={item} small primary={filter === item} onPress={() => setFilter(item)}>
            {t(labelKey)}
          </Button>
        ))}
      </View>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
      {!tasks.length && (
        <Empty
          icon={ListChecks}
          title={t("agent.activity.empty")}
          detail={t("agent.activity.emptyDetail")}
        />
      )}
    </View>
  );
}
export function EvidenceList({ items }: { items: Evidence[] }) {
  const { t } = useTranslation();
  const { workspace, open } = useWorkspace();
  const [error, setError] = useState("");
  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => (
        <View
          key={item.id}
          style={{ borderLeftWidth: 2, borderLeftColor: colors.blue, paddingLeft: 12, gap: 4 }}
        >
          <Text style={[s.small, { color: colors.text, fontWeight: "600" }]}>{item.title}</Text>
          <Text selectable style={s.small}>
            {item.excerpt}
          </Text>
          {item.url && /^https?:\/\//i.test(item.url) && (
            <Button
              small
              onPress={() =>
                void Linking.openURL(item.url || "").catch((e) => setError(errorText(e)))
              }
            >
              {t("agent.evidence.openSource")}
            </Button>
          )}
          {item.kind === "file" && workspace.files.some((file) => file.id === item.id) && (
            <Button
              small
              onPress={() => {
                const file = workspace.files.find((f) => f.id === item.id);
                if (file) open({ type: "file", file });
              }}
            >
              {t("agent.evidence.viewFile")}
            </Button>
          )}
        </View>
      ))}
      <ErrorNotice error={error} />
    </View>
  );
}
export function TaskDetail({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { api, close, open } = useWorkspace();
  const { data, mutate } = useAgentWorkspace();
  const [detail, setDetail] = useState<{
    task: AgentTask;
    events: RunEvent[];
    artifacts: AgentArtifact[];
    files: Artifact[];
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [fieldJson, setFieldJson] = useState("");
  const [showFieldJson, setShowFieldJson] = useState(false);
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const task = data?.tasks.find((item) => item.id === taskId) || detail?.task;
  useEffect(() => {
    let active = true;
    void api
      .request<{
        task: AgentTask;
        events: RunEvent[];
        artifacts: AgentArtifact[];
        files: Artifact[];
      }>(`/api/agent/tasks/${taskId}`)
      .then((result) => {
        if (active) {
          setDetail(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [api, taskId, task?.updatedAt]);
  async function act(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await mutate(`/tasks/${taskId}/${path}`, body);
      if (path === "input") {
        setAnswer("");
        setFields({});
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function submitInput() {
    try {
      let parsed: Record<string, string | boolean> = fields;
      if (fieldJson.trim()) {
        const raw: unknown = JSON.parse(fieldJson);
        if (
          !raw ||
          typeof raw !== "object" ||
          Array.isArray(raw) ||
          Object.values(raw).some(
            (value) => typeof value !== "string" && typeof value !== "boolean",
          )
        )
          throw new Error(t("agent.task.fieldsError"));
        parsed = raw as Record<string, string | boolean>;
      }
      await act("input", {
        answer: answer.trim() || t("agent.task.fieldsProvided"),
        fields: parsed,
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  const missing = Array.isArray(task?.state.missingFields) ? task.state.missingFields : [];
  const fieldNames = missing
    .map((field) =>
      typeof field === "string"
        ? field
        : typeof field === "object" && field && "name" in field
          ? String(field.name)
          : "",
    )
    .filter(Boolean);
  return (
    <Sheet
      title={task?.title || t("agent.task.title")}
      subtitle={
        task
          ? `${statusLabel(task.status)} · ${stamp(task.updatedAt, t("common.notCheckedYet"))}`
          : t("agent.task.loadingProgress")
      }
      onClose={close}
    >
      <ErrorNotice error={error} />
      {!task ? (
        <ActivityIndicator color={colors.blueDark} />
      ) : (
        <View style={{ gap: 20 }}>
          <Text selectable style={s.text}>
            {task.prompt}
          </Text>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            {["queued", "running", "scheduled", "waiting_input", "waiting_approval"].includes(
              task.status,
            ) && (
              <Button
                small
                icon={Pause}
                busy={busy}
                onPress={() => void act("control", { action: "pause" })}
              >
                {t("common.pause")}
              </Button>
            )}
            {task.status === "paused" && (
              <Button
                small
                icon={Play}
                busy={busy}
                onPress={() => void act("control", { action: "resume" })}
              >
                {t("common.resume")}
              </Button>
            )}
            {task.status === "failed" && (
              <Button
                small
                icon={RefreshCw}
                busy={busy}
                onPress={() => void act("control", { action: "retry" })}
              >
                {t("agent.task.retry")}
              </Button>
            )}
            {activeTask(task) && (
              <Button
                small
                danger
                icon={X}
                busy={busy}
                onPress={() => void act("control", { action: "cancel" })}
              >
                {t("agent.task.cancel")}
              </Button>
            )}
          </View>
          {task.status === "waiting_input" && (
            <Card style={{ backgroundColor: colors.sky, gap: 10 }}>
              <Text style={s.heading}>{task.question || t("agent.task.detailNeeded")}</Text>
              {fieldNames.map((name) =>
                missing.some(
                  (f) => typeof f === "object" && f && f.name === name && f.type === "checkbox",
                ) ? (
                  <CheckRow
                    key={name}
                    label={name.replace(/_/g, " ")}
                    checked={Boolean(fields[name])}
                    onPress={() => setFields((current) => ({ ...current, [name]: !current[name] }))}
                  />
                ) : (
                  <Field
                    key={name}
                    label={name.replace(/_/g, " ")}
                    value={String(fields[name] ?? "")}
                    onChangeText={(value) =>
                      setFields((current) => ({ ...current, [name]: value }))
                    }
                  />
                ),
              )}
              {!fieldNames.length && (
                <Field
                  label={t("agent.task.answer")}
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  placeholder={t("agent.task.answer.placeholder")}
                />
              )}
              {task.kind === "document" && !fieldNames.length && (
                <>
                  <Button small onPress={() => setShowFieldJson(!showFieldJson)}>
                    {t("agent.task.formFields")}
                  </Button>
                  {showFieldJson && (
                    <Field
                      label={t("agent.task.fields")}
                      value={fieldJson}
                      onChangeText={setFieldJson}
                      multiline
                      autoCapitalize="none"
                      placeholder={'{"full_name":"Your name","consent":true}'}
                    />
                  )}
                </>
              )}
              <Button
                primary
                busy={busy}
                disabled={!answer.trim() && !Object.keys(fields).length && !fieldJson.trim()}
                onPress={() => void submitInput()}
              >
                {t("agent.task.continue")}
              </Button>
            </Card>
          )}
          {!!task.plan.length && (
            <Card style={{ gap: 15 }}>
              <Text style={s.heading}>{t("agent.task.plan")}</Text>
              {task.plan.map((step, index) => (
                <View key={step.id} style={[s.row, { gap: 10, alignItems: "flex-start" }]}>
                  <Text
                    style={[
                      s.text,
                      { color: step.status === "succeeded" ? colors.blueDark : colors.muted },
                    ]}
                  >
                    {step.status === "succeeded" ? "✓" : `${index + 1}.`}
                  </Text>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.text}>{step.title}</Text>
                    <Text style={s.small}>
                      {statusLabel(step.status)}
                      {step.detail ? ` · ${step.detail}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
          {task.result && (
            <Card style={{ backgroundColor: colors.green }}>
              <Text selectable style={s.text}>
                {resultSummary(task.result)}
              </Text>
            </Card>
          )}
          <ErrorNotice error={task.error ?? undefined} />
          {detail?.files?.map((file) => (
            <LinkRow
              key={file.id}
              title={file.name}
              detail={`${file.pageCount} pages · PDF`}
              icon={FileText}
              onPress={() => open({ type: "file", file })}
            />
          ))}
          {(
            data?.artifacts.filter((artifact) => artifact.taskId === taskId) ||
            detail?.artifacts ||
            []
          ).map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
          {!!task.evidence.length && (
            <View style={{ gap: 14 }}>
              <Text style={s.heading}>{t("agent.task.sources")}</Text>
              <EvidenceList items={task.evidence} />
            </View>
          )}
          <Text style={s.heading}>{t("agent.task.timeline")}</Text>
          {detail?.events.map((event) => (
            <View
              key={event.id}
              style={{ gap: 4, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: colors.line }}
            >
              <Text style={s.small}>
                {stamp(event.date, t("common.notCheckedYet"))} · {statusLabel(event.kind)}
              </Text>
              <Text style={s.text}>{event.title}</Text>
              <Text selectable style={s.muted}>
                {event.detail}
              </Text>
            </View>
          ))}
          {!detail?.events.length && <Text style={s.muted}>{t("agent.task.timeline.empty")}</Text>}
        </View>
      )}
    </Sheet>
  );
}
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function display(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : value === null
        ? "—"
        : JSON.stringify(value, null, 2) || "";
}
export function ArtifactCard({ artifact }: { artifact: AgentArtifact }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (artifact.kind === "finance") return <FinanceArtifact artifact={artifact} />;
  const rows = Object.entries(artifact.data);
  return (
    <Card style={{ gap: 13, backgroundColor: colors.card }}>
      <View style={s.between}>
        <Text style={s.heading}>{artifact.title}</Text>
        <Chip>{statusLabel(artifact.kind)}</Chip>
      </View>
      <Text selectable style={s.muted}>
        {artifact.summary}
      </Text>
      {(expanded ? rows : rows.slice(0, 4)).map(([key, value]) => (
        <View key={key} style={{ gap: 6 }}>
          <Text style={s.label}>{key.replace(/_/g, " ")}</Text>
          {Array.isArray(value) ? (
            value.slice(0, expanded ? 100 : 5).map((item) => {
              const row = record(item);
              return (
                <View
                  key={`${key}-${display(row?.id ?? item)}`}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                  }}
                >
                  <Text selectable style={s.text}>
                    {row
                      ? Object.entries(row)
                          .map(([name, val]) => `${name}: ${display(val)}`)
                          .join(" · ")
                      : display(item)}
                  </Text>
                </View>
              );
            })
          ) : record(value) ? (
            Object.entries(record(value) || {}).map(([name, val]) => (
              <View key={name} style={s.between}>
                <Text style={s.muted}>{name}</Text>
                <Text selectable style={s.text}>
                  {display(val)}
                </Text>
              </View>
            ))
          ) : (
            <Text selectable style={[s.text, { fontSize: typeof value === "number" ? 24 : 14 }]}>
              {display(value)}
            </Text>
          )}
        </View>
      ))}
      <Button small onPress={() => setExpanded(!expanded)}>
        {t(expanded ? "agent.artifact.showSummary" : "agent.artifact.explore")}
      </Button>
    </Card>
  );
}
function FinanceArtifact({ artifact }: { artifact: AgentArtifact }) {
  const { t } = useTranslation();
  const [details, setDetails] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { mutate } = useAgentWorkspace();
  const [goalTitle, setGoalTitle] = useState("");
  const [goalSaved, setGoalSaved] = useState(false);
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalError, setGoalError] = useState("");
  const saveGoal = async () => {
    setGoalBusy(true);
    setGoalError("");
    try {
      await mutate("/goals", {
        title: goalTitle.trim(),
        category: "Finances",
        description: `Inspired by ${artifact.title}: ${artifact.summary}`,
        milestones: ["Choose a savings target", "Review spending each week"],
      });
      setGoalSaved(true);
    } catch (error) {
      setGoalError(errorText(error));
    } finally {
      setGoalBusy(false);
    }
  };
  const amount = (value: unknown) =>
    Number(value ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const categories = Array.isArray(artifact.data.categories) ? artifact.data.categories : [];
  const transactions = Array.isArray(artifact.data.transactions) ? artifact.data.transactions : [];
  const spending = Number(artifact.data.spending) || 1;
  const period = record(artifact.data.period);
  return (
    <Card
      style={{ gap: 12, padding: 10, backgroundColor: "#EEEEF0", maxWidth: 440, width: "100%" }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("agent.finance.open", { title: artifact.title })}
        accessibilityState={{ expanded: details }}
        onPress={() => setDetails(!details)}
      >
        <View
          style={{
            minHeight: 200,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "#080B10",
            padding: 20,
          }}
        >
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 142 }}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="finance" x1="0" y1="0" x2="0.5" y2="1">
                  <Stop offset="0" stopColor="#281066" />
                  <Stop offset="0.5" stopColor="#163BBF" />
                  <Stop offset="1" stopColor="#148CE8" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#finance)" />
            </Svg>
          </View>
          <Text style={{ color: "#D4DCFC", fontSize: 11, lineHeight: 18, marginBottom: 20 }}>
            {t("agent.finance.readFrom")}
            {"\n"}
            {String(period?.from ?? "")} — {String(period?.to ?? "")}
            {"\n"}
            {t("agent.finance.count", { count: transactions.length })}
          </Text>
          <View style={[s.row, { gap: 7 }]}>
            {(
              [
                ["agent.finance.income", "income"],
                ["agent.finance.spending", "spending"],
                ["agent.finance.remaining", "saved"],
              ] as const
            ).map(([labelKey, key]) => (
              <View
                key={key}
                style={{ flex: 1, padding: 11, borderRadius: 12, backgroundColor: "#1D2025" }}
              >
                <Text style={{ color: "#A4A7AD", fontSize: 9 }}>{t(labelKey)}</Text>
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: key === "saved" ? "#58D3AE" : "#FFF",
                    marginTop: 5,
                  }}
                >
                  {amount(artifact.data[key])}
                </Text>
                <Text style={{ color: "#7E8289", fontSize: 8, marginTop: 4 }}>
                  {t("agent.finance.sourceCurrency")}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[s.row, { gap: 11, paddingHorizontal: 8, paddingTop: 13, paddingBottom: 4 }]}>
          <Text style={{ fontSize: 25 }}>💸</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.text, { fontWeight: "600" }]}>{t("agent.finance.title")}</Text>
            <Text style={s.small}>{t("agent.finance.detail")}</Text>
          </View>
          <ChevronRight size={17} color={colors.muted} />
        </View>
      </Pressable>
      {details && (
        <View style={{ gap: 16, padding: 10 }}>
          <Text style={s.label}>{t("agent.finance.where")}</Text>
          {categories.map((category) => {
            const row = record(category);
            if (!row) return null;
            return (
              <View key={String(row.name)} style={{ gap: 8 }}>
                <View style={s.between}>
                  <Text style={s.text}>{String(row.name)}</Text>
                  <Text style={s.text}>{amount(row.amount)}</Text>
                </View>
                <View style={{ height: 7, backgroundColor: "#DFE8EB", borderRadius: 8 }}>
                  <View
                    style={{
                      width: `${Math.min(100, (Number(row.amount) / spending) * 100)}%`,
                      height: 7,
                      backgroundColor: colors.blueDark,
                      borderRadius: 8,
                    }}
                  />
                </View>
              </View>
            );
          })}
          <Text style={s.small}>{t("agent.finance.note")}</Text>
          {goalSaved ? (
            <Text style={s.text}>{t("agent.finance.goalSaved")}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Field
                label={t("agent.finance.goalLabel")}
                value={goalTitle}
                onChangeText={setGoalTitle}
                placeholder={t("agent.finance.goalPlaceholder")}
              />
              <ErrorNotice error={goalError} />
              <Button
                small
                busy={goalBusy}
                disabled={!goalTitle.trim()}
                onPress={() => void saveGoal()}
              >
                {t("agent.finance.createGoal")}
              </Button>
            </View>
          )}
          <Button small onPress={() => setExpanded(!expanded)}>
            {t(expanded ? "agent.finance.hideTransactions" : "agent.finance.viewTransactions")}
          </Button>
          {expanded &&
            transactions.slice(0, 100).map((transaction) => {
              const row = record(transaction);
              return row ? (
                <View key={String(row.id ?? display(row))} style={s.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.text}>{String(row.description)}</Text>
                    <Text style={s.small}>
                      {String(row.date)} · {String(row.category)}
                    </Text>
                  </View>
                  <Text style={s.text}>{amount(row.amount)}</Text>
                </View>
              ) : null;
            })}
          {expanded && transactions.length > 100 && (
            <Text style={s.small}>{t("agent.finance.first100")}</Text>
          )}
        </View>
      )}
    </Card>
  );
}
export function DelegateSheet() {
  const { t } = useTranslation();
  const { workspace, close, open } = useWorkspace();
  const { delegate } = useAgentWorkspace();
  const [kind, setKind] = useState<AgentTask["kind"]>("plan");
  const [prompt, setPrompt] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const task = await delegate({
        prompt: prompt.trim(),
        kind,
        input: kind === "finance" ? { csv } : {},
      });
      open({ type: "task", taskId: task.id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={t("agent.delegate.title")}
      subtitle={t("agent.delegate.subtitle")}
      onClose={close}
    >
      <View style={[s.row, { flexWrap: "wrap", gap: 8, marginBottom: 20 }]}>
        {(["plan", "finance", "agent"] as const).map((item) => (
          <Button small primary={kind === item} key={item} onPress={() => setKind(item)}>
            {t(`agent.delegate.kind.${item}`)}
          </Button>
        ))}
      </View>
      <Field
        label={t("agent.delegate.what")}
        value={prompt}
        onChangeText={setPrompt}
        multiline
        placeholder={
          kind === "finance"
            ? t("agent.delegate.placeholder.finance")
            : t("agent.delegate.placeholder.plan")
        }
      />
      {kind === "finance" && (
        <>
          <Field
            label={t("agent.delegate.csv")}
            value={csv}
            onChangeText={setCsv}
            multiline
            autoCapitalize="none"
            placeholder={"date,description,amount,category\n2026-09-01,Groceries,54.20,Food"}
          />
          {workspace.mode === "sample" && (
            <Button
              onPress={() =>
                setCsv(
                  "date,description,amount,category\n2026-09-01,Salary,-4200,Income\n2026-09-02,Groceries,84.50,Food\n2026-09-03,Subscription,19.99,Subscriptions\n2026-09-04,Coffee,6.50,Food",
                )
              }
            >
              {t("agent.delegate.tryExample")}
            </Button>
          )}
          <Text style={[s.small, { marginVertical: 12 }]}>{t("agent.delegate.amountNote")}</Text>
        </>
      )}
      {kind === "agent" && !workspace.runtime.configured && (
        <Text style={[s.muted, { marginBottom: 16 }]}>{t("agent.delegate.generalNote")}</Text>
      )}
      <ErrorNotice error={error} />
      <Button
        primary
        busy={busy}
        disabled={!prompt.trim() || (kind === "finance" && !csv.trim())}
        onPress={() => void submit()}
      >
        {t("agent.delegate.submit")}
      </Button>
    </Sheet>
  );
}
export function GoalsScreen() {
  const { t } = useTranslation();
  const { data } = useAgentWorkspace();
  const [adding, setAdding] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string>();
  const goal = data?.goals.find((item) => item.id === selectedGoal);
  return (
    <View style={{ gap: 14 }}>
      <AgentStatus />
      <Button
        primary
        icon={Plus}
        style={{ alignSelf: "flex-start" }}
        onPress={() => setAdding(true)}
      >
        {t("agent.goals.new")}
      </Button>
      {data?.goals.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={t("agent.goals.open", { title: item.title })}
          onPress={() => setSelectedGoal(item.id)}
        >
          <Card style={{ ...s.row, gap: 12 }}>
            <Square
              size={21}
              color="#A7AAAC"
              fill={item.status === "completed" ? colors.green : "transparent"}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.text}>{item.title}</Text>
              <Text numberOfLines={2} style={s.muted}>
                {item.description || statusLabel(item.status)}
              </Text>
            </View>
            <ChevronRight size={18} color="#A3A6A8" />
          </Card>
        </Pressable>
      ))}
      {!data?.goals.length && <Empty icon={Target} title={t("agent.goals.empty")} />}
      {adding && (
        <Sheet title={t("agent.goals.create")} onClose={() => setAdding(false)}>
          <GoalForm onDone={() => setAdding(false)} />
        </Sheet>
      )}
      {goal && (
        <Sheet title={goal.title} onClose={() => setSelectedGoal(undefined)}>
          <GoalCard goal={goal} onOpenTask={() => setSelectedGoal(undefined)} />
        </Sheet>
      )}
    </View>
  );
}
const GOAL_CATEGORIES = [
  { name: "Health", labelKey: "agent.goals.category.health" },
  { name: "Relationships", labelKey: "agent.goals.category.relationships" },
  { name: "Finances", labelKey: "agent.goals.category.finances" },
  { name: "Something else", labelKey: "agent.goals.category.other" },
] as const;
function GoalForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { mutate } = useAgentWorkspace();
  const [category, setCategory] = useState<string>(GOAL_CATEGORIES[0].name);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await mutate("/goals", {
        title: title.trim(),
        category,
        description,
        milestones: milestones
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <View style={[s.row, { gap: 8, flexWrap: "wrap", marginBottom: 16 }]}>
        {GOAL_CATEGORIES.map((item) => (
          <Button
            key={item.name}
            small
            primary={category === item.name}
            onPress={() => setCategory(item.name)}
          >
            {t(item.labelKey)}
          </Button>
        ))}
      </View>
      <Field
        label={t("agent.goals.field.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("agent.goals.field.title.placeholder")}
      />
      <Field
        label={t("agent.goals.field.success")}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Field
        label={t("agent.goals.field.milestones")}
        value={milestones}
        onChangeText={setMilestones}
        multiline
      />
      <ErrorNotice error={error} />
      <Button primary disabled={!title.trim()} busy={busy} onPress={() => void save()}>
        {t("agent.goals.create")}
      </Button>
    </Card>
  );
}
function GoalCard({ goal, onOpenTask }: { goal: Goal; onOpenTask?: () => void }) {
  const { t } = useTranslation();
  const { data, mutate, delegate } = useAgentWorkspace();
  const { open } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = goal.milestones.filter((item) => item.done).length;
  async function update(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await mutate(`/goals/${goal.id}`, body);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function plan() {
    setBusy(true);
    setError("");
    try {
      const task = await delegate({
        title: `Plan: ${goal.title}`,
        prompt: `Create a practical plan for this goal: ${goal.title}. ${goal.description}`,
        kind: "plan",
        goalId: goal.id,
        input: {},
      });
      onOpenTask?.();
      open({ type: "task", taskId: task.id });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.between}>
        <Text style={[s.heading, { flex: 1 }]}>{goal.title}</Text>
        <Chip tint={goal.status === "completed" ? colors.green : colors.sky}>
          {statusLabel(goal.status)}
        </Chip>
      </View>
      <Text style={s.muted}>{goal.description}</Text>
      <Text style={s.small}>
        {t("agent.goals.milestones", { done, total: goal.milestones.length })}
      </Text>
      {goal.milestones.map((milestone) => (
        <CheckRow
          key={milestone.id}
          checked={milestone.done}
          label={milestone.title}
          onPress={() => {
            if (!busy)
              void update({
                milestones: goal.milestones.map((item) =>
                  item.id === milestone.id ? { ...item, done: !item.done } : item,
                ),
              });
          }}
        />
      ))}
      <ErrorNotice error={error} />
      <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Button
          small
          busy={busy}
          onPress={() => void update({ status: goal.status === "active" ? "paused" : "active" })}
        >
          {t(goal.status === "active" ? "common.pause" : "common.resume")}
        </Button>
        {goal.status !== "completed" && (
          <Button small busy={busy} onPress={() => void update({ status: "completed" })}>
            {t("agent.goals.complete")}
          </Button>
        )}
        <Button small primary busy={busy} onPress={() => void plan()}>
          {t("agent.goals.planNext")}
        </Button>
      </View>
      {data?.tasks
        .filter((task) => task.goalId === goal.id)
        .map((task) => (
          <TaskCard key={task.id} task={task} compact onOpen={onOpenTask} />
        ))}
    </Card>
  );
}
export function NotificationsSheet() {
  const { t } = useTranslation();
  const { data, mutate } = useAgentWorkspace();
  const { close, open } = useWorkspace();
  const [error, setError] = useState("");
  async function read(id: string, taskId?: string) {
    try {
      await mutate(`/notifications/${id}/read`, {});
      if (taskId) open({ type: "task", taskId });
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <Sheet
      title={t("agent.notifications.title")}
      subtitle={t("agent.notifications.subtitle")}
      onClose={close}
    >
      <View style={{ gap: 14 }}>
        <ErrorNotice error={error} />
        {data?.notifications.map((item) => (
          <Card
            key={item.id}
            style={{ gap: 8, backgroundColor: item.read ? colors.card : colors.sky }}
          >
            <View style={s.between}>
              <Text style={s.heading}>{item.title}</Text>
              {!item.read && <Chip>{t("agent.notifications.new")}</Chip>}
            </View>
            <Text style={s.muted}>{item.body}</Text>
            <Text style={s.small}>{stamp(item.createdAt, t("common.notCheckedYet"))}</Text>
            <Button small onPress={() => void read(item.id, item.taskId)}>
              {item.taskId
                ? t("agent.task.view")
                : t(item.read ? "agent.notifications.read" : "agent.notifications.markRead")}
            </Button>
          </Card>
        ))}
        {!data?.notifications.length && (
          <Empty
            icon={Bell}
            title={t("activity.review.empty")}
            detail={t("agent.notifications.emptyDetail")}
          />
        )}
      </View>
    </Sheet>
  );
}
export function AppsScreen() {
  const { navigate, api } = useWorkspace();
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguage();
  const { data, mutate } = useAgentWorkspace();
  const [expanded, setExpanded] = useState<"agent" | "memory">();
  const [name, setName] = useState(data?.identity.name || "Vesper");
  const [tone, setTone] = useState(data?.identity.tone || "warm");
  const [avatar, setAvatar] = useState(data?.identity.avatar || "sky");
  const [showChatUpdates, setShowChatUpdates] = useState(data?.identity.showChatUpdates !== false);
  const [memory, setMemory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data?.identity) {
      setName(data.identity.name);
      setTone(data.identity.tone);
      setAvatar(data.identity.avatar || "sky");
      setShowChatUpdates(data.identity.showChatUpdates !== false);
    }
  }, [
    data?.identity.name,
    data?.identity.tone,
    data?.identity.avatar,
    data?.identity.showChatUpdates,
  ]);
  async function save(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await mutate(path, body);
      if (path === "/memories") setMemory("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const toggle = (section: "agent" | "memory") =>
    setExpanded(expanded === section ? undefined : section);
  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 10 }}>
        <SectionHeading title={t("nav.settings.language")} />
        <View style={[s.row, { gap: 8 }]}>
          {LANGUAGES.map((item) => (
            <Button
              key={item.id}
              small
              primary={language === item.id}
              onPress={() => {
                setLanguage(item.id);
                void api.saveModelSettings({ ui: { language: item.id } });
              }}
            >
              {item.label}
            </Button>
          ))}
        </View>
      </Card>
      <AgentStatus />
      <VoiceSettings />
      <Card style={{ paddingVertical: 4 }}>
        <LinkRow icon={Users} title={t("apps.agent.title")} onPress={() => toggle("agent")} />
      </Card>
      {expanded === "agent" && (
        <Card style={{ gap: 10 }}>
          <View style={[s.row, { gap: 16, justifyContent: "center", marginBottom: 12 }]}>
            {(["sky", "sand", "lilac"] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityLabel={t("apps.avatar.label", { name: t(`apps.avatar.${item}`) })}
                accessibilityState={{ checked: avatar === item }}
                onPress={() => setAvatar(item)}
                style={{
                  padding: 7,
                  borderRadius: 24,
                  backgroundColor: avatar === item ? colors.sky : colors.canvas,
                }}
              >
                <Mascot size={62} variant={item} />
              </Pressable>
            ))}
          </View>
          <Field label={t("apps.agent.name")} value={name} onChangeText={setName} />
          <View style={[s.row, { gap: 8 }]}>
            {(["warm", "concise", "thoughtful"] as const).map((item) => (
              <Button key={item} small primary={tone === item} onPress={() => setTone(item)}>
                {t(`apps.tone.${item}`)}
              </Button>
            ))}
          </View>
          <CheckRow
            label={t("apps.showUpdates")}
            checked={showChatUpdates}
            onPress={() => setShowChatUpdates(!showChatUpdates)}
          />
          <Button
            busy={busy}
            disabled={!name.trim()}
            onPress={() =>
              void save("/identity", { name: name.trim(), tone, avatar, showChatUpdates })
            }
          >
            {t("apps.savePreferences")}
          </Button>
        </Card>
      )}
      <Card style={{ paddingVertical: 4 }}>
        <LinkRow icon={Lightbulb} title={t("apps.memory.title")} onPress={() => toggle("memory")} />
      </Card>
      {expanded === "memory" && (
        <Card style={{ gap: 12 }}>
          {data?.memories.map((item) => (
            <MemoryRow key={item.id} memory={item} />
          ))}
          <Field
            label={t("apps.memory.remember")}
            value={memory}
            onChangeText={setMemory}
            placeholder={t("apps.memory.placeholder")}
          />
          <Button
            busy={busy}
            disabled={!memory.trim()}
            onPress={() =>
              void save("/memories", { text: memory.trim(), source: "User added in Apps" })
            }
          >
            {t("apps.memory.save")}
          </Button>
        </Card>
      )}
      <Card style={{ paddingVertical: 4 }}>
        <LinkRow
          icon={FileText}
          title={t("screen.files.title")}
          onPress={() => navigate("files")}
        />
      </Card>
      <ErrorNotice error={error} />
    </View>
  );
}
function MemoryRow({ memory }: { memory: AgentMemory }) {
  const { t } = useTranslation();
  const { mutate } = useAgentWorkspace();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.text);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(forget: boolean) {
    setBusy(true);
    setError("");
    try {
      await mutate(`/memories/${memory.id}${forget ? "/forget" : ""}`, forget ? {} : { text });
      setEditing(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{ gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      {editing ? (
        <Field label={t("apps.memory.field")} value={text} onChangeText={setText} />
      ) : (
        <Text style={s.text}>{memory.text}</Text>
      )}
      <Text style={s.small}>
        {memory.source} · {stamp(memory.createdAt, t("common.notCheckedYet"))}
      </Text>
      <View style={[s.row, { gap: 8 }]}>
        {editing ? (
          <Button small busy={busy} disabled={!text.trim()} onPress={() => void act(false)}>
            {t("apps.memory.saveCorrection")}
          </Button>
        ) : (
          <Button small onPress={() => setEditing(true)}>
            {t("common.edit")}
          </Button>
        )}
        <Button small danger busy={busy} onPress={() => void act(true)}>
          {t("apps.memory.forget")}
        </Button>
      </View>
      <ErrorNotice error={error} />
    </View>
  );
}
