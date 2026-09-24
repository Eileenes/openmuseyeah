import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Interface language.
 *
 * Hand-rolled rather than pulling in a library: the surface is small, and a
 * dependency would have to be installed and versioned for every platform.
 *
 * English is the source of truth. A key missing from another dictionary falls
 * back to English and then to the key itself, so a partial translation degrades
 * into readable English instead of blanks or raw identifiers.
 */
export type Language = "en" | "zh";

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
];

export const en: Record<string, string> = {
  "nav.chat": "Chat",
  "nav.activity": "Tasks",
  "nav.goals": "Goals",
  "nav.apps": "Settings",
  "nav.settings.language": "Language",

  "screen.activity.title": "Tasks",
  "screen.goals.title": "Goals",
  "screen.apps.title": "Settings",
  "screen.files.title": "Files",

  "status.saved": "Saved.",

  // Shared
  "common.notCheckedYet": "Not checked yet",
  "common.pages": "{count} pages",
  "common.page": "{count} page",
  "common.done": "Done",
  "common.loading": "Loading…",
  "common.edit": "Edit",
  "common.pause": "Pause",
  "common.resume": "Resume",

  // Workspace
  "workspace.title": "Your workspace",

  // Home

  // Mail

  // Calendar

  // Review

  // Files
  "files.import": "Import PDF",
  "files.unreadable": "The selected file could not be read. Please choose it again.",
  "files.importFailed": "Could not import this PDF.",
  "files.cardLabel": "DOCUMENT",
  "files.detail": "{count} pages · {size} KB · {source}",
  "files.empty": "Your documents live here",
  "files.emptyDetail":
    "Import a PDF or open a mail attachment to read, fill supported form fields, and share a copy.",
  "files.shareUnavailable": "Sharing is not available on this device.",
  "files.openDownload": "Open / download",
  "files.saveShare": "Save or share",
  "files.fillForm": "Fill this form",
  "files.fillForm.detail":
    "Add your details below. Saving creates a new copy and keeps the original intact.",
  "files.unsupportedField": "{name} · this field type is not supported",
  "files.saveCopy": "Save filled copy",
  "files.added": "Added {date}",
  "files.filledCopy": "filled copy",

  // Browser

  // Activity
  "activity.review.empty": "You’re all caught up",

  // Connections

  // Apps
  "apps.agent.title": "Your agent",
  "apps.agent.name": "Name",
  "apps.avatar.label": "{name} avatar",
  "apps.avatar.sky": "Sky",
  "apps.avatar.sand": "Sand",
  "apps.avatar.lilac": "Lilac",
  "apps.tone.warm": "Warm",
  "apps.tone.concise": "Concise",
  "apps.tone.thoughtful": "Thoughtful",
  "apps.showUpdates": "Show background updates in chat",
  "apps.savePreferences": "Save preferences",
  "apps.memory.title": "Memory",
  "apps.memory.remember": "Remember something about me",
  "apps.memory.placeholder": "I prefer morning meetings",
  "apps.memory.save": "Remember",
  "apps.memory.field": "Memory",
  "apps.memory.saveCorrection": "Save correction",
  "apps.memory.forget": "Forget",

  // Agent
  "agent.status.unavailable": "Agent updates unavailable. {error}",
  "agent.status.reconnect": "Reconnect agent",
  "agent.task.open": "Open task: {title}",
  "agent.task.view": "View task",
  "agent.task.steps": "{done}/{total} steps",
  "agent.task.reviewRequested": "Review requested",
  "agent.task.inputNeeded": "Your input is needed",
  "agent.task.title": "Task",
  "agent.task.loadingProgress": "Loading saved progress…",
  "agent.task.retry": "Retry task",
  "agent.task.cancel": "Cancel task",
  "agent.task.detailNeeded": "A detail from you will help",
  "agent.task.answer": "Your answer",
  "agent.task.answer.placeholder": "Add the missing details…",
  "agent.task.formFields": "Form field values",
  "agent.task.fields": "Fields (JSON: field name to value)",
  "agent.task.continue": "Continue task",
  "agent.task.plan": "Plan",
  "agent.task.sources": "Sources",
  "agent.task.timeline": "Timeline",
  "agent.task.timeline.empty": "The worker will record each step here.",
  "agent.task.fieldsError": "Form fields must be a JSON object with text or true/false values.",
  "agent.task.fieldsProvided": "Provided the requested fields.",
  "agent.activity.all": "All",
  "agent.activity.inProgress": "In progress",
  "agent.activity.finished": "Finished",
  "agent.activity.empty": "A place for the work",
  "agent.activity.emptyDetail":
    "Delegate a task in Chat. Its plan, progress and results stay here.",
  "agent.evidence.openSource": "Open source",
  "agent.evidence.viewFile": "View file",
  "agent.artifact.showSummary": "Show summary",
  "agent.artifact.explore": "Explore full result",
  "agent.finance.open": "Open finance tracker: {title}",
  "agent.finance.readFrom": "Read from your imported transactions.",
  "agent.finance.count": "{count} transactions, categorized and summarized.",
  "agent.finance.income": "Income",
  "agent.finance.spending": "Spending",
  "agent.finance.remaining": "Remaining",
  "agent.finance.sourceCurrency": "source currency",
  "agent.finance.title": "Finance tracker",
  "agent.finance.detail": "Spending, savings, and a plan for what’s next.",
  "agent.finance.where": "Where your money went",
  "agent.finance.note": "Amounts use your source currency. This summary covers the imported dates.",
  "agent.finance.goalSaved": "Your savings goal is saved in Goals.",
  "agent.finance.goalLabel": "Turn this into a savings goal",
  "agent.finance.goalPlaceholder": "What would you like to save for?",
  "agent.finance.createGoal": "Create savings goal",
  "agent.finance.hideTransactions": "Hide transactions",
  "agent.finance.viewTransactions": "View transactions",
  "agent.finance.first100": "Showing the first 100 transactions. The totals include every row.",
  "agent.delegate.title": "Hand over an outcome",
  "agent.delegate.subtitle": "Vesper saves a plan and keeps working on the server.",
  "agent.delegate.kind.plan": "Plan",
  "agent.delegate.kind.document": "Document",
  "agent.delegate.kind.finance": "Finance",
  "agent.delegate.kind.general": "General task",
  "agent.delegate.what": "What would you like done?",
  "agent.delegate.placeholder.finance": "Summarize my spending and suggest a savings plan",
  "agent.delegate.placeholder.plan": "Make a practical plan for my week",
  "agent.delegate.csv": "Transaction CSV",
  "agent.delegate.tryExample": "Try example transactions",
  "agent.delegate.amountNote":
    "Positive amounts are expenses; negative amounts are income. Imported data only. No bank connection is implied.",
  "agent.delegate.generalNote":
    "General tasks and plans require a configured model. Document jobs, page watches and spending summaries have guided workflows.",
  "agent.delegate.submit": "Delegate task",
  "agent.goals.open": "Open goal: {title}",
  "agent.goals.empty": "Big plans start with one small step.",
  "agent.goals.create": "Create a goal",
  "agent.goals.category.health": "Health",
  "agent.goals.category.relationships": "Relationships",
  "agent.goals.category.finances": "Finances",
  "agent.goals.category.other": "Something else",
  "agent.goals.field.title": "Your goal",
  "agent.goals.field.title.placeholder": "Build a three-month emergency fund",
  "agent.goals.field.success": "What does success look like?",
  "agent.goals.field.milestones": "Milestones (one per line)",
  "agent.goals.milestones": "{done} of {total} milestones",
  "agent.goals.complete": "Complete goal",
  "agent.goals.planNext": "Plan next steps",
  "agent.notifications.title": "Notifications",
  "agent.notifications.subtitle": "Results and decisions that need your attention.",
  "agent.notifications.new": "New",
  "agent.notifications.read": "Read",
  "agent.notifications.markRead": "Mark read",
  "agent.notifications.emptyDetail":
    "Results, meaningful changes and requests for your input will appear here.",

  // Chat
  "chat.tool.task": "Task",
  "chat.tool.agentProgress": "Agent progress",
  "chat.tool.goal": "Goal",
  "chat.tool.memory": "Memory",
  "chat.saving": "Saving {name}…",
  "chat.waitingServer": "Waiting for the server.",
  "chat.openWorkspace": "Open the workspace to see the saved result.",
  "chat.view": "View {name}",
  "chat.loadFailed":
    "Could not load conversation. Your saved messages have not been changed. {error}",
  "chat.notReady": "The conversation is not ready yet.",
  "chat.saveFailed": "Conversation could not be saved: {error}",
  "chat.stopFailed": "Could not stop response: {error}",
  "chat.retryLoad": "Retry loading conversation",
  "chat.empty.headline": "A little help. A lot more room for life.",
  "chat.reply.stopReading": "Stop reading this reply",
  "chat.reply.readAloud": "Read this reply aloud",
  "chat.reply.stop": "Stop",
  "chat.reply.read": "Read aloud",
  "chat.results.show": "Recent results",
  "chat.results.hide": "Hide recent results",
  "chat.working": "Agent is working",
  "chat.retryResponse": "Retry response",
  "chat.latest": "Latest messages",
  "chat.retrySave": "Retry saving conversation",
  "chat.queue.hold": "Messages on hold",
  "chat.queue.upNext": "Up next",
  "chat.queue.keepOpen": "Keep the app open until sent",
  "chat.queue.remove": "Remove queued message: {text}",
  "chat.queue.send": "Send queued messages",
  "chat.attach.title": "Add a document",
  "chat.attach.empty": "Import a PDF in Files to use it in a conversation.",
  "chat.attach.remove": "Remove attachment: {name}",
  "chat.attach.label": "Attach a document",
  "chat.input.label": "Message Vesper",
  "chat.input.connecting": "Connecting…",
  "chat.input.unavailable": "Conversation unavailable",
  "chat.input.loading": "Loading conversation…",
  "chat.input.placeholder": "Message…",
  "chat.speech.off": "Stop reading replies aloud",
  "chat.speech.on": "Read replies aloud",
  "chat.send.stop": "Stop reply",
  "chat.send.send": "Send message",

  // Voice
  "voice.provider.stub": "Offline",
  "voice.provider.openai": "OpenAI",
  "voice.note.sttProvider": "Speech to text now uses {provider}.",
  "voice.note.ttsProvider": "Speech now uses {provider}.",
  "voice.keyStored": "Key encrypted and stored on the server.",
  "voice.test.sttOk": "Speech to text: ok ({provider})",
  "voice.test.sttError": "Speech to text: {error}",
  "voice.test.ttsOk": "Speech: ok ({provider}, {bytes} bytes)",
  "voice.test.ttsError": "Speech: {error}",
  "voice.modelId": "Model id",
  "voice.modelId.placeholder": "e.g. gpt-4o-mini, claude-sonnet-4-5, gemini-2.5-flash",
  "voice.baseUrl": "Base URL (optional)",
  "voice.baseUrl.placeholder": "Blank for the official endpoint; set for compatible services",
  "voice.enterKey": "API key",
  "voice.test.llmOk": "Chat model: ok ({model})",
  "voice.test.llmError": "Chat model: {error}",
  "voice.stt": "Speech to text",
  "voice.stt.model": "Transcription model",
  "voice.stt.language": "Spoken language",
  "voice.stt.language.placeholder": "zh, en, or blank to detect",
  "voice.tts": "Spoken replies",
  "voice.tts.model": "Speech model",
  "voice.tts.voice": "Voice",
  "voice.tts.speed": "Speed",
  "voice.speakReplies": "Read replies aloud",
  "voice.credential.stored": "Stored on the server as {masked}",
  "voice.replaceKey": "Replace key",
  "voice.save": "Save",
  "voice.test": "Test providers",

  // Threads
  "thread.mainChat": "Main chat",
  "thread.mainChat.detail": "Your ongoing conversation",
  "thread.mainChat.saved": "Saved in this workspace",
  "thread.retryMain": "Retry main chat",
  "thread.newSide": "New side chat",
  "thread.sideChats": "Side chats",
  "thread.showActive": "Show active",
  "thread.archived": "Archived",
  "thread.retryConversations": "Retry conversations",
  "thread.sideChat": "Side chat {index}",
  "thread.openInApp": "Open in this app",
  "thread.openConversation": "Open conversation: {name}",
  "thread.untitled": "Untitled conversation",
  "thread.renameLabel": "Conversation name",
  "thread.saveName": "Save name",
  "thread.rename": "Rename",
  "thread.restore": "Restore",
  "thread.archive": "Archive",
  "thread.empty.archived": "No archived conversations.",
  "thread.empty": "Keep a separate topic here. Your main chat is always available.",
  "thread.loadMore": "Load more conversations",
  "thread.delegate": "Delegate task",
  "thread.apps": "Apps & settings",
  "thread.refresh": "Refresh workspace",
  "chat.suggestion.plan": "Plan my week",
  "chat.suggestion.delegate": "Take a task off my plate",
  "common.back": "Back",
  "agent.goals.new": "New goal",
  "voice.provider.custom": "Custom",
  "voice.model.title": "Model",
  "voice.baseUrl.required": "Base URL (required)",
  "voice.baseUrl.customPlaceholder":
    "An OpenAI-compatible endpoint, e.g. https://api.example.com/v1",
  "voice.section.open": "Voice settings",
  "voice.section.close": "Hide voice settings",
};

export const zh: Record<string, string> = {
  "nav.chat": "聊天",
  "nav.activity": "任务",
  "nav.goals": "目标",
  "nav.apps": "设置",
  "nav.settings.language": "语言",

  "screen.activity.title": "任务",
  "screen.goals.title": "目标",
  "screen.apps.title": "设置",
  "screen.files.title": "文件",

  "status.saved": "已保存。",

  // Shared
  "common.notCheckedYet": "尚未检查",
  "common.pages": "{count} 页",
  "common.page": "{count} 页",
  "common.done": "完成",
  "common.loading": "加载中…",
  "common.edit": "编辑",
  "common.pause": "暂停",
  "common.resume": "继续",

  // Workspace
  "workspace.title": "你的工作区",

  // Home

  // Mail

  // Calendar

  // Review

  // Files
  "files.import": "导入 PDF",
  "files.unreadable": "无法读取所选文件，请重新选择。",
  "files.importFailed": "无法导入这个 PDF。",
  "files.cardLabel": "文档",
  "files.detail": "{count} 页 · {size} KB · {source}",
  "files.empty": "文档都在这里",
  "files.emptyDetail": "导入 PDF 或打开邮件附件，即可阅读、填写支持的字段并分享副本。",
  "files.shareUnavailable": "此设备不支持分享。",
  "files.openDownload": "打开 / 下载",
  "files.saveShare": "保存或分享",
  "files.fillForm": "填写此表单",
  "files.fillForm.detail": "在下方填写信息。保存会生成副本，原件保持不变。",
  "files.unsupportedField": "{name} · 不支持此字段类型",
  "files.saveCopy": "保存填写副本",
  "files.added": "添加于 {date}",
  "files.filledCopy": "填写副本",

  // Browser

  // Activity
  "activity.review.empty": "都处理完了",

  // Connections

  // Apps
  "apps.agent.title": "你的助手",
  "apps.agent.name": "名称",
  "apps.avatar.label": "{name}头像",
  "apps.avatar.sky": "天空",
  "apps.avatar.sand": "沙色",
  "apps.avatar.lilac": "淡紫",
  "apps.tone.warm": "温和",
  "apps.tone.concise": "简洁",
  "apps.tone.thoughtful": "周到",
  "apps.showUpdates": "在聊天中显示后台更新",
  "apps.savePreferences": "保存偏好",
  "apps.memory.title": "记忆",
  "apps.memory.remember": "记住关于我的一些事",
  "apps.memory.placeholder": "我更喜欢早上开会",
  "apps.memory.save": "记住",
  "apps.memory.field": "记忆",
  "apps.memory.saveCorrection": "保存修改",
  "apps.memory.forget": "遗忘",

  // Agent
  "agent.status.unavailable": "无法获取助手更新。{error}",
  "agent.status.reconnect": "重新连接助手",
  "agent.task.open": "打开任务：{title}",
  "agent.task.view": "查看任务",
  "agent.task.steps": "{done}/{total} 步",
  "agent.task.reviewRequested": "等待确认",
  "agent.task.inputNeeded": "需要你补充信息",
  "agent.task.title": "任务",
  "agent.task.loadingProgress": "正在加载已保存的进度…",
  "agent.task.retry": "重试任务",
  "agent.task.cancel": "取消任务",
  "agent.task.detailNeeded": "还需要你补充一点信息",
  "agent.task.answer": "你的回答",
  "agent.task.answer.placeholder": "补充缺失的信息…",
  "agent.task.formFields": "表单字段值",
  "agent.task.fields": "字段（JSON：字段名对应值）",
  "agent.task.continue": "继续任务",
  "agent.task.plan": "计划",
  "agent.task.sources": "来源",
  "agent.task.timeline": "时间线",
  "agent.task.timeline.empty": "工作进程会把每一步记录在这里。",
  "agent.task.fieldsError": "表单字段必须是 JSON 对象，值为文本或 true/false。",
  "agent.task.fieldsProvided": "已提供所需字段。",
  "agent.activity.all": "全部",
  "agent.activity.inProgress": "进行中",
  "agent.activity.finished": "已完成",
  "agent.activity.empty": "给工作一个去处",
  "agent.activity.emptyDetail": "在聊天里交办任务，它的计划、进度和结果都会留在这里。",
  "agent.evidence.openSource": "查看来源",
  "agent.evidence.viewFile": "查看文件",
  "agent.artifact.showSummary": "只看摘要",
  "agent.artifact.explore": "查看完整结果",
  "agent.finance.open": "打开财务追踪：{title}",
  "agent.finance.readFrom": "来自你导入的交易记录。",
  "agent.finance.count": "已归类并汇总 {count} 笔交易。",
  "agent.finance.income": "收入",
  "agent.finance.spending": "支出",
  "agent.finance.remaining": "结余",
  "agent.finance.sourceCurrency": "原始币种",
  "agent.finance.title": "财务追踪",
  "agent.finance.detail": "支出、储蓄，以及下一步的打算。",
  "agent.finance.where": "钱花在了哪里",
  "agent.finance.note": "金额按原始币种显示，汇总涵盖导入的日期范围。",
  "agent.finance.goalSaved": "储蓄目标已保存在「目标」中。",
  "agent.finance.goalLabel": "把它变成储蓄目标",
  "agent.finance.goalPlaceholder": "想为什么存钱？",
  "agent.finance.createGoal": "创建储蓄目标",
  "agent.finance.hideTransactions": "收起交易",
  "agent.finance.viewTransactions": "查看交易",
  "agent.finance.first100": "仅显示前 100 笔交易，合计包含全部记录。",
  "agent.delegate.title": "交办一件事",
  "agent.delegate.subtitle": "Vesper 会保存计划，并在服务器上继续推进。",
  "agent.delegate.kind.plan": "计划",
  "agent.delegate.kind.document": "文档",
  "agent.delegate.kind.finance": "财务",
  "agent.delegate.kind.general": "通用任务",
  "agent.delegate.what": "想让我做什么？",
  "agent.delegate.placeholder.finance": "汇总我的支出，并给出一份储蓄计划",
  "agent.delegate.placeholder.plan": "为我这一周做个可行的计划",
  "agent.delegate.csv": "交易 CSV",
  "agent.delegate.tryExample": "试试示例交易",
  "agent.delegate.amountNote": "正数为支出，负数为收入。仅使用导入的数据，不涉及银行连接。",
  "agent.delegate.generalNote":
    "通用任务和计划需要先配置模型。文档任务、页面监控和支出汇总有引导式流程。",
  "agent.delegate.submit": "交办任务",
  "agent.goals.open": "打开目标：{title}",
  "agent.goals.empty": "大计划都从一小步开始。",
  "agent.goals.create": "创建目标",
  "agent.goals.category.health": "健康",
  "agent.goals.category.relationships": "人际关系",
  "agent.goals.category.finances": "财务",
  "agent.goals.category.other": "其他",
  "agent.goals.field.title": "你的目标",
  "agent.goals.field.title.placeholder": "存够三个月的应急金",
  "agent.goals.field.success": "怎样算达成？",
  "agent.goals.field.milestones": "里程碑（每行一个）",
  "agent.goals.milestones": "里程碑 {done}/{total}",
  "agent.goals.complete": "完成目标",
  "agent.goals.planNext": "规划下一步",
  "agent.notifications.title": "通知",
  "agent.notifications.subtitle": "需要你关注的结果与决定。",
  "agent.notifications.new": "新",
  "agent.notifications.read": "已读",
  "agent.notifications.markRead": "标记已读",
  "agent.notifications.emptyDetail": "结果、重要变化和需要你补充的信息都会出现在这里。",

  // Chat
  "chat.tool.task": "任务",
  "chat.tool.agentProgress": "助手进度",
  "chat.tool.goal": "目标",
  "chat.tool.memory": "记忆",
  "chat.saving": "正在保存{name}…",
  "chat.waitingServer": "正在等待服务器。",
  "chat.openWorkspace": "打开工作区查看保存的结果。",
  "chat.view": "查看{name}",
  "chat.loadFailed": "无法加载会话，你已保存的消息没有改动。{error}",
  "chat.notReady": "会话还没准备好。",
  "chat.saveFailed": "会话无法保存：{error}",
  "chat.stopFailed": "无法停止回复：{error}",
  "chat.retryLoad": "重新加载会话",
  "chat.empty.headline": "少一点忙乱，多一点生活。",
  "chat.reply.stopReading": "停止朗读这条回复",
  "chat.reply.readAloud": "朗读这条回复",
  "chat.reply.stop": "停止",
  "chat.reply.read": "朗读",
  "chat.results.show": "最近结果",
  "chat.results.hide": "收起最近结果",
  "chat.working": "助手正在工作",
  "chat.retryResponse": "重试回复",
  "chat.latest": "最新消息",
  "chat.retrySave": "重试保存会话",
  "chat.queue.hold": "消息已暂缓",
  "chat.queue.upNext": "接下来",
  "chat.queue.keepOpen": "发送前请保持应用打开",
  "chat.queue.remove": "移除排队的消息：{text}",
  "chat.queue.send": "发送排队消息",
  "chat.attach.title": "添加文档",
  "chat.attach.empty": "先在「文件」里导入 PDF，就能在对话中使用。",
  "chat.attach.remove": "移除附件：{name}",
  "chat.attach.label": "添加文档",
  "chat.input.label": "给 Vesper 发消息",
  "chat.input.connecting": "连接中…",
  "chat.input.unavailable": "会话不可用",
  "chat.input.loading": "正在加载会话…",
  "chat.input.placeholder": "发消息…",
  "chat.speech.off": "停止朗读回复",
  "chat.speech.on": "朗读回复",
  "chat.send.stop": "停止回复",
  "chat.send.send": "发送消息",

  // Voice
  "voice.provider.stub": "离线",
  "voice.provider.openai": "OpenAI",
  "voice.note.sttProvider": "语音转文字已改用 {provider}。",
  "voice.note.ttsProvider": "语音播报已改用 {provider}。",
  "voice.keyStored": "密钥已加密并保存在服务器上。",
  "voice.test.sttOk": "语音转文字：正常（{provider}）",
  "voice.test.sttError": "语音转文字：{error}",
  "voice.test.ttsOk": "语音播报：正常（{provider}，{bytes} 字节）",
  "voice.test.ttsError": "语音播报：{error}",
  "voice.modelId": "模型 ID",
  "voice.modelId.placeholder": "例如 gpt-4o-mini、claude-sonnet-4-5、gemini-2.5-flash",
  "voice.baseUrl": "Base URL（可选）",
  "voice.baseUrl.placeholder": "留空使用官方地址；兼容服务（如 DeepSeek）请填写",
  "voice.enterKey": "API 密钥",
  "voice.test.llmOk": "对话模型：正常（{model}）",
  "voice.test.llmError": "对话模型：{error}",
  "voice.stt": "语音转文字",
  "voice.stt.model": "转写模型",
  "voice.stt.language": "口语语言",
  "voice.stt.language.placeholder": "zh、en，留空则自动识别",
  "voice.tts": "语音播报",
  "voice.tts.model": "语音模型",
  "voice.tts.voice": "音色",
  "voice.tts.speed": "语速",
  "voice.speakReplies": "朗读回复",
  "voice.credential.stored": "已保存在服务器上：{masked}",
  "voice.replaceKey": "替换密钥",
  "voice.save": "保存",
  "voice.test": "测试提供方",

  // Threads
  "thread.mainChat": "主聊天",
  "thread.mainChat.detail": "你正在进行的对话",
  "thread.mainChat.saved": "保存在此工作区",
  "thread.retryMain": "重试主聊天",
  "thread.newSide": "新建侧边聊天",
  "thread.sideChats": "侧边聊天",
  "thread.showActive": "显示进行中",
  "thread.archived": "已归档",
  "thread.retryConversations": "重试会话",
  "thread.sideChat": "侧边聊天 {index}",
  "thread.openInApp": "在此应用中打开",
  "thread.openConversation": "打开会话：{name}",
  "thread.untitled": "未命名会话",
  "thread.renameLabel": "会话名称",
  "thread.saveName": "保存名称",
  "thread.rename": "重命名",
  "thread.restore": "恢复",
  "thread.archive": "归档",
  "thread.empty.archived": "没有已归档的会话。",
  "thread.empty": "在这里放独立的话题，主聊天始终可用。",
  "thread.loadMore": "加载更多会话",
  "thread.delegate": "交办任务",
  "thread.apps": "应用与设置",
  "thread.refresh": "刷新工作区",
  "chat.suggestion.plan": "帮我规划这周",
  "chat.suggestion.delegate": "帮我处理一件事",
  "common.back": "返回",
  "agent.goals.new": "新目标",
  "voice.provider.custom": "自定义",
  "voice.model.title": "模型",
  "voice.baseUrl.required": "Base URL（必填）",
  "voice.baseUrl.customPlaceholder": "OpenAI 兼容地址，例如 https://api.example.com/v1",
  "voice.section.open": "语音设置",
  "voice.section.close": "收起语音设置",
};

const dictionaries: Record<Language, Record<string, string>> = { en, zh };

const STORAGE_KEY = "vesper.language";

/**
 * The device's language decides the first run, so a Chinese phone opens in
 * Chinese without anyone hunting for a setting.
 */
function detectLanguage(): Language {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // Storage can be unavailable; fall through to the device locale.
  }
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    if (locale.toLowerCase().startsWith("zh")) return "zh";
  } catch {
    // No Intl: English is a safe default.
  }
  return "en";
}

interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageValue>({
  language: "en",
  setLanguage: () => undefined,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLanguage);
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, language);
    } catch {
      // Persistence is a convenience here; the session still switches.
    }
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  const { language } = useLanguage();
  const t = useCallback(
    (
      key: string,
      vars?: Record<string, string | number>,
      /** Used when the key exists in no dictionary; replaces writing a key per string. */
      fallback?: string,
    ) => {
      const template = dictionaries[language][key] ?? en[key] ?? fallback ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
        template,
      );
    },
    [language],
  );
  return { t, language };
}
