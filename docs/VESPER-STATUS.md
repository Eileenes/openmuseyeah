# Vesper — 状态与交接

OpenMuse → Vesper 的改造。本文档只记录**实际跑过并观察到结果**的事。
每条「已完成」都附了**当初是怎么验证的**；无法验证的单独列出，不混进完成项。

> **最新：桌面端已打通（实测），形象已换成 Q 版熊猫。**

## 桌面端连接问题 —— 已解决

**两个独立原因叠加，缺一不可：**

**1. 打包窗口的 origin 是不透明的 `null`**，而 API 白名单按名字匹配 → 403。
实测确认发送的正是 `Origin: null`。修法：壳每次启动生成随机令牌，同时交给 sidecar（环境变量）与页面（注入 `__VESPER_SHELL_TOKEN__`），服务端只对持令牌的 `null` 来源放行 —— **其他页面的 `null` 依然 403**。预检 OPTIONS 额外放行：浏览器不会在预检里带自定义头，且预检不执行任何动作。

**2. 内置 API 约需 2 秒才就绪，而窗口几乎立刻加载。**
实测 `API first answered 2.08s after launch`。App 在挂载时（几百毫秒内）调用 `/api/session`，那时服务还没监听 → 连接被拒 → 停在连接页。**这是最初就存在、被现象 1 掩盖的原因。**
修法：启动期重试（20 × 400ms）；手动填了密钥则不重试。

**只修 (1) 不够 —— (2) 才是让界面永远进不去的那个。**

**关键诊断手法**：让注入脚本**发出与 App 完全相同的请求**并回报结果。探针 4 秒成功、App 0.5 秒失败，时间差直接指向竞态 —— 在此之前我猜过注入没生效、Rust 建窗回归、前端产物损坏，**全是错的**。

---

## 一句话

语音 v1、统一模型配置层、品牌替换、桌面端（含内置 API）**已完成并有实测证据**。
剩下的事**要么需要你的凭据，要么需要真实设备，要么被本机环境排除**。

---

## 已完成并实测

### P0 品牌替换
| 内容 | 验证方式 |
| --- | --- |
| 原创矢量形象（五端通用） | 浏览器实测渲染；修掉 CSS 绘制层级 bug（定位元素盖住流内 SVG） |
| 配色变体 | 修掉渐变 id 冲突（三色头像会全取第一色），改用 `useId()` |
| 应用改名 | 服务端身份、界面文案、`app.json`、原生工程 Info.plist |
| 图标全平台 | `build-icons.mjs` 单一矢量源 → PNG / .icns / .ico |

### P1 语音 v1 + 模型配置层
| 内容 | 验证方式 |
| --- | --- |
| 按住说话 → STT → 草稿 | 浏览器实测按钮与上传链路（multipart 与裸字节两条路都通） |
| 回复自动朗读 | 实测触发 `/api/voice/speak`、签名 URL 被播放器取走、无播放错误 |
| 单条重播 + 静音开关 | 实测播放结束后按钮正确复原 |
| LLM/STT/TTS 统一配置层 | 4 项解析测试 + 浏览器实测设置面板与 Save |
| 密钥加密存储 | AES-256-GCM；测试断言明文不出现在存储与响应中 |

修掉的 bug：`PUT` 与 `GET /api/settings/models` 返回结构不一致（点 Save 会崩，只有真点界面才暴露）。

### P2 流式
| 内容 | 验证方式 |
| --- | --- |
| 分句切分 | 14 项测试（小数/域名不误切、短句前并） |
| 分句流式 TTS | 实测一条回复切成 3 句、3 次合成、逐句播放 |
| 重复朗读修复 | 同一回复会以两个 message id 到达；句级跨 id 去重，实测 6 次 → 3 次 |
| 流式识别（服务端） | 会话生命周期实测：音频累积 40000→60000 字节、结束即失效、415/401/404 正确 |
| 分块推送节流 | 7 项测试 |
| 免提 VAD 判定 | 8 项测试（含"麦克风卡住需静音后才恢复"——测试抓出的真实缺陷） |

### P3 桌面端
| 内容 | 验证方式 |
| --- | --- |
| Tauri 壳 | Rust 编译 2m24s，产出 `Vesper.app`（含 sidecar 共 134MB） |
| 与 API 打通 | `lsappinfo` 抓到 `"Vesper Networking"` 与 API 的 ESTABLISHED 连接（第 9 轮） |
| 内置 API | 实测：App 启动后自建数据目录（PGlite + 签名密钥）、API 响应健康检查 |
| 退出清理 | 实测：杀 App 后内置 API 停止、端口释放 |
| 运行时 API 地址 | 浏览器实测：注入 `__VESPER_API_URL__` 后请求改打注入地址 |
| 自动选端口 | 实测选到 57462/57616/57871/58041，sidecar 均正常服务 |
| sidecar 打包 | `build-sidecar.sh` 产出 129MB（Node 108MB + 应用 21MB） |

修掉的 bug：API 用 origin 白名单拒绝了桌面壳自己的来源（403），桌面包能加载但每个请求被拒。已加入默认白名单，并加测试保证白名单**保持闭合**（不含通配符）。

### P4 原生工程
| 内容 | 验证方式 |
| --- | --- |
| iOS 工程 | `expo prebuild` 生成 `Vesper.xcworkspace`；`NSMicrophoneUsageDescription` 存在（缺则 iOS 直接崩溃） |
| iOS 依赖 | `pod install` 完成：91 依赖 / 90 pods |
| Android 工程 | `android/` 生成；`AndroidManifest.xml` 含 `RECORD_AUDIO` |
| EAS 配置 | `apps/mobile/eas.json` 三档 profile，JSON 合法 |

---

## 已实现，但在此环境无法验证

**这些代码通过类型检查，部分逻辑有单元测试，但没有运行时证据。**

- 真实麦克风采集（本机无音频输入设备）
- 打断（按麦克风停止播放）
- 原生播放
- 客户端流式识别接线 / 免提 VAD 接线（**尚未接线**）
- **真实 App 内 UI ↔ 内置 API 的对接 —— 37 轮已定位到前端侧**：加了一个仅在 `VESPER_DEBUG_BEACON=1` 时启用的诊断信标（注入脚本里一个延迟 3 秒的 `fetch` 到内置 API）。实测**信标成功连接**（WebKit Networking 进程 → 127.0.0.1:8799，抓到 18 次采样）。**这证明**：注入脚本在 webview 里**确实执行**、webview **能访问本地 API**、注入机制整条链**是通的**。因此故障被隔离到**前端产物在桌面 webview 里的加载/启动**——而不是壳、注入、端口或沙箱。**下一步怀疑**：`index.html` 引用的 `/_expo/static/js/web/index-*.js` 是**以 / 开头的绝对路径**，需确认 Tauri 的资源协议能否在 `tauri://localhost` 下正确提供它；验证方法是把信标目标换成一个会记录请求路径的本地小服务，让 webview 报告它实际观察到的状态。
- （36 轮记录）此前缩小范围：webview 能正常初始化（用 `CFFIXED_USER_HOME` 绕开缓存权限后实测）、前端产物完整（`dist/web/index.html` 引用的 4.9MB bundle 存在，且**确实含运行期地址代码**）、sidecar 在监听 —— 但页面仍不发起任何 API 请求。已排除：窗口创建方式（受控回退验证）、webview 初始化、产物缺失。**剩余嫌疑**：页面在 webview 内执行失败（无法截图或看 devtools，故不能进一步定位）。

---

## 环境限制（每条都有证据，不是推测）

| 限制 | 证据 |
| --- | --- |
| 无法截屏 GUI 窗口 | 所有窗口名为空、`onScreen=false` —— 缺「屏幕录制」权限的典型特征 |
| 无法用 AppleScript 查询窗口 | `-10004 权限违例` |
| 沙箱阻止跨进程派生 | `ps` 被拒；Xcode 无法 spawn `AssetCatalogSimulatorAgent`（**已用 `danger-full-access` 重试，错误不变 → 排除沙箱因素，是本机 CoreSimulator 问题**） |
| WebKit 无法建缓存目录 → **已用 `CFFIXED_USER_HOME` 绕过** | 从沙箱 shell 运行 App 时报 `~/Library/Caches/app.vesper.desktop/WebKit/...` Operation not permitted。**36 轮找到绕法**：设 `CFFIXED_USER_HOME` 指向工作区内目录，CoreFoundation 会改用它作为 home，WebKit 缓存随之落进工作区 —— 权限报错消失，webview 完整初始化（实测三个 WebKit 进程 + 写入 312K 缓存）。**这个技巧对后续调试有用，记在这里。** |
| 无法读回数据库验证 | App 无法优雅退出（Cmd+Q 需 AppleScript），PGlite 留下无法重开的状态 → `RuntimeError: unreachable` |
| 网络慢 | npm 约 24 KiB/s（曾据此改走本地复制而非下载） |

---

## 你需要做的三件事

**1. 看一眼桌面端（10 秒，能判定我唯一没验到的一环）**
```sh
open apps/desktop/src-tauri/target/release/bundle/macos/Vesper.app
```
界面能用 → 说明 UI 拿到了壳注入的地址（构建期默认值是 8787，而该端口被本机另一程序占用，所以界面能用就只可能是注入生效）。

**2. 验证语音全链路（唯一一次都没跑过的构建）**
```sh
cd apps/mobile && npx expo run:ios
```
依赖已装好，不需要再处理。这一条能验掉全部「零运行时证据」的代码。
顺带确认 VAD 阈值：`packages/voice/src/utterance.ts` 的 `speechThreshold: 0.02` 是纸面初值，真机大概率要按设备调。

**3. 出可安装的包（需要你的 Expo 账号）**
```sh
npx eas-cli login && npx eas-cli build --profile preview --platform ios
```
我不代你登录，也不上传你的代码。

---

## 检查基线

| 检查 | 结果 |
| --- | --- |
| `pnpm lint` | ✅ 146 文件 |
| `pnpm typecheck` | ✅（含 `apps/mobile`，走 `.native` 分支） |
| 新增测试 | stream 14 · streaming 6 · push-scheduler 7 · utterance 8 · model-settings 4 · voice 18 · config 5 |
| `pnpm test` 全量 | ✅ 仅剩一个**既有** flake：`computer-runner.test.ts` 的 Docker 用例在并行全量下 spawn 失败，**单独跑通过**，与本改造无关 |

---

## 改造中值得记录的教训

- **同时改两个变量就下结论**：我一度在代码注释与文档里写下「本项目 web 端不支持 SVG 渐变」，实际是我同时改了填充方式和层级、无法归因。后来专门做对照测试**推翻了它**并修正了那两处错误说明。
- **用 `-quiet` + `tail` 压制日志**：白跑一整轮才拿到真正的构建错误。改用 `grep error:` 后一次就抓到。
- **测试脚手架造成的假象**：用 `sh -c "sleep 600"` 测 sidecar 清理，得出"清理失败"的错误结论 —— 实际是杀掉 `sh` 不会带走 `sleep`；真实路径直接 spawn `node`，清理是对的。
- **同一类错误犯了两次**：新加构建产物目录时，只更新了 `.gitignore` 却忘了 `biome.json`（先是 Rust `target/` 被格式化 422 个文件，后是 8.6MB 的 `server.js` 触发告警）。
- **回退了一次改动又恢复**：怀疑「Rust 建窗」导致回归，受控回退后结果不变 → 排除该怀疑，恢复注入。注释里保留了这段经过，避免他人重试。
