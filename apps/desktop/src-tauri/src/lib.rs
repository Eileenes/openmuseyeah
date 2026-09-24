/**
 * Vesper desktop shell.
 *
 * The interface is the same React Native Web bundle the browser build serves, so
 * there is no second UI to keep in step. This process owns the window and the
 * local API it starts alongside itself, and it tells the window which address
 * that API ended up on.
 */

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/** Holds the child process so it can be stopped when the window closes. */
struct Sidecar(Mutex<Option<Child>>);

/**
 * Asks the operating system for an unused port.
 *
 * A fixed port is not good enough for a desktop app: the chosen number is
 * commonly taken by something else, and the app would then start with no API at
 * all. There is a small race between releasing this listener and the server
 * binding it, which is the cost of not being able to hand the socket over.
 */
fn free_port() -> Option<u16> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").ok()?;
    let port = listener.local_addr().ok()?.port();
    drop(listener);
    Some(port)
}

struct Started {
    child: Option<Child>,
    url: String,
    token: String,
    access_key: String,
}

fn random_bytes(len: usize) -> std::io::Result<Vec<u8>> {
    let mut bytes = vec![0u8; len];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
    Ok(bytes)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |n, (i, b)| n | (*b as u32) << (16 - 8 * i));
        for i in 0..4 {
            out.push(if i <= chunk.len() {
                TABLE[(n >> (18 - 6 * i) & 63) as usize] as char
            } else {
                '='
            });
        }
    }
    out
}

/**
 * The key that encrypts provider API keys at rest. Created once and kept: a new
 * key on every launch would make every stored key unreadable.
 */
fn encryption_key(data: &Path) -> std::io::Result<String> {
    let path = data.join("encryption-key");
    if let Ok(existing) = std::fs::read_to_string(&path) {
        if !existing.trim().is_empty() {
            return Ok(existing.trim().to_string());
        }
    }
    let key = base64(&random_bytes(32)?);
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    std::io::Write::write_all(&mut options.open(&path)?, key.as_bytes())?;
    Ok(key)
}

/**
 * Starts the local API.
 *
 * `VESPER_SIDECAR_COMMAND` still wins when set, which is how the shell is
 * exercised during development. Otherwise the API bundled next to the app is
 * used, so a packaged build needs nothing else running.
 */
fn start(app: &tauri::AppHandle, port: u16) -> Started {
    let url = format!("http://127.0.0.1:{port}");
    /*
     * A per-launch secret shared with the API. The packaged window sends an
     * opaque origin, and the server accepts that only from a caller holding this
     * token — otherwise any sandboxed page on the web could reach the loopback
     * server that is meant for this app alone.
     */
    let (token, access_key) = match (random_bytes(24), random_bytes(24)) {
        (Ok(token), Ok(access)) => (hex(&token), hex(&access)),
        _ => {
            eprintln!("vesper: no system randomness");
            return Started { child: None, url, token: String::new(), access_key: String::new() };
        }
    };
    if let Ok(command) = std::env::var("VESPER_SIDECAR_COMMAND") {
        if !command.trim().is_empty() {
            println!("vesper: starting the local API from VESPER_SIDECAR_COMMAND");
            let child = Command::new("/bin/sh").arg("-c").arg(command).spawn().ok();
            return Started { child, url, token, access_key };
        }
    }

    let Some(dir) = sidecar_dir(app) else {
        eprintln!("vesper: no resource directory");
        return Started { child: None, url, token, access_key };
    };
    let node = dir.join("node");
    let entry = dir.join("server.js");
    if !node.exists() || !entry.exists() {
        eprintln!("vesper: no bundled API at {}", dir.display());
        return Started { child: None, url, token, access_key };
    }

    // Where the embedded database lives. Overridable so a deployment can place
    // it beside other data, and so the launch path can be exercised where the
    // platform default directory is not writable.
    // A subdirectory, so data from the earlier sample-only builds never appears
    // in the real workspace.
    let data = match std::env::var("VESPER_DATA_DIR") {
        Ok(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => match app.path().app_local_data_dir() {
            Ok(dir) => dir.join("workspace"),
            Err(error) => {
                eprintln!("vesper: no data directory: {error}");
                return Started { child: None, url, token, access_key };
            }
        },
    };
    if let Err(error) = std::fs::create_dir_all(&data) {
        eprintln!(
            "vesper: could not create the data directory {}: {error}",
            data.display()
        );
        return Started { child: None, url, token, access_key };
    }
    let encryption = match encryption_key(&data) {
        Ok(key) => key,
        Err(error) => {
            eprintln!("vesper: could not prepare the encryption key: {error}");
            return Started { child: None, url, token, access_key };
        }
    };

    /*
     * A real workspace with no model preset: chat stays unconfigured until a
     * provider and key are saved in Settings. Server environment keys are
     * cleared so nothing inherited from a shell silently takes over.
     */
    let child = match Command::new(&node)
        .arg(&entry)
        // PGlite resolves pglite.wasm and pglite.data from the working
        // directory, so the sidecar has to be started from inside itself.
        .current_dir(&dir)
        .env("HOST", "127.0.0.1")
        .env("PORT", port.to_string())
        .env("PUBLIC_API_URL", &url)
        .env("VESPER_SHELL_TOKEN", &token)
        .env("DATA_DIR", &data)
        .env("WORKSPACE_MODE", "live")
        .env("AGENT_BACKEND", "model")
        .env("OPENMUSE_ACCESS_KEY", &access_key)
        .env("TOKEN_ENCRYPTION_KEY", &encryption)
        .env_remove("MODEL")
        .env_remove("OPENAI_API_KEY")
        .env_remove("ANTHROPIC_API_KEY")
        .env_remove("GOOGLE_API_KEY")
        .env_remove("CPK_INTELLIGENCE_API_KEY")
        .spawn()
    {
        Ok(child) => {
            println!("vesper: local API listening on {port}");
            Some(child)
        }
        Err(error) => {
            eprintln!("vesper: could not start the local API: {error}");
            None
        }
    };
    Started { child, url, token, access_key }
}

fn sidecar_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().resource_dir().ok().map(|dir| dir.join("sidecar"))
}

fn stop(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<Sidecar>() else {
        return;
    };
    let Ok(mut guard) = state.0.lock() else {
        return;
    };
    if let Some(child) = guard.as_mut() {
        // A server that outlives its window keeps holding the port; kill and
        // reap so the next launch can bind again.
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let port = std::env::var("VESPER_SIDECAR_PORT")
                .ok()
                .and_then(|value| value.trim().parse().ok())
                .or_else(free_port)
                .unwrap_or(8787);
            let started = start(&handle, port);
            /*
             * The window is built here rather than declared in the config so the
             * address can be injected before the bundle runs — the interface
             * resolves its API base on first use, so setting it afterwards would
             * be too late.
             *
             * The port is chosen automatically, so this injection is not
             * optional: a random port the window cannot learn would leave the
             * app with no reachable API at all.
             *
             * Reverting this to a declared window was tried while investigating
             * a failure to observe the interface reach the API. It changed
             * nothing, so the injection was not the cause and was restored.
             */
            let json = |value: &str| serde_json::to_string(value).unwrap_or_else(|_| "null".into());
            let mut script = format!(
                "window.__VESPER_API_URL__ = {}; window.__VESPER_SHELL_TOKEN__ = {}; window.__VESPER_ACCESS_KEY__ = {};",
                json(&started.url),
                json(&started.token),
                json(&started.access_key)
            );
            /*
             * Diagnostic: proves whether scripts run inside the webview and can
             * reach the local API at all. Off unless asked for, because it would
             * otherwise make a request the interface never asked for.
             */
            if std::env::var("VESPER_DEBUG_BEACON").is_ok() {
                script.push_str(&format!(
                    "setTimeout(function(){{ \
                       var report = function (message) {{ \
                         try {{ fetch('http://127.0.0.1:8901/' + encodeURIComponent(message), {{mode:'no-cors'}}); }} catch (e) {{}} \
                       }}; \
                       report('readyState=' + document.readyState); \
                       report('tokenPresent=' + (window.__VESPER_SHELL_TOKEN__ ? 'yes' : 'no')); \
                       report('text=' + (document.body ? document.body.innerText.slice(0, 320) : 'no-body')); \
                       /*
                        * Issue exactly the request the interface issues, so a
                        * failure here is the interface's failure and not a
                        * property of a simpler probe.
                        */ \
                       fetch('http://127.0.0.1:{port}/api/session', {{ \
                         method: 'POST', \
                         headers: {{ 'Content-Type': 'application/json', 'X-Vesper-Shell': window.__VESPER_SHELL_TOKEN__ || '' }}, \
                         body: '{{}}' \
                       }}).then(function (r) {{ \
                         return r.text().then(function (t) {{ report('sessionHTTP=' + r.status + ' body=' + t.slice(0, 140)); }}); \
                       }}).catch(function (e) {{ report('sessionFAIL=' + e.name + ':' + e.message); }}); \
                     }}, 4000);"
                ));
            }
            app.manage(Sidecar(Mutex::new(started.child)));
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Vesper")
                .inner_size(1180.0, 820.0)
                .min_inner_size(460.0, 620.0)
                .initialization_script(&script)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to start Vesper")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop(app);
            }
        });
}
