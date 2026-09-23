/**
 * Vesper desktop shell.
 *
 * The interface is the same React Native Web bundle the browser build serves, so
 * there is no second UI to keep in step. This process owns the window and the
 * local API it starts alongside itself, and it tells the window which address
 * that API ended up on.
 */

use std::path::PathBuf;
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
    let token = format!(
        "{:x}{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0),
        std::process::id()
    );
    if let Ok(command) = std::env::var("VESPER_SIDECAR_COMMAND") {
        if !command.trim().is_empty() {
            println!("vesper: starting the local API from VESPER_SIDECAR_COMMAND");
            let child = Command::new("/bin/sh").arg("-c").arg(command).spawn().ok();
            return Started { child, url, token };
        }
    }

    let Some(dir) = sidecar_dir(app) else {
        eprintln!("vesper: no resource directory");
        return Started { child: None, url, token };
    };
    let node = dir.join("node");
    let entry = dir.join("server.js");
    if !node.exists() || !entry.exists() {
        eprintln!("vesper: no bundled API at {}", dir.display());
        return Started { child: None, url, token };
    }

    // Where the embedded database lives. Overridable so a deployment can place
    // it beside other data, and so the launch path can be exercised where the
    // platform default directory is not writable.
    let data = match std::env::var("VESPER_DATA_DIR") {
        Ok(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => match app.path().app_local_data_dir() {
            Ok(dir) => dir,
            Err(error) => {
                eprintln!("vesper: no data directory: {error}");
                return Started { child: None, url, token };
            }
        },
    };
    if let Err(error) = std::fs::create_dir_all(&data) {
        eprintln!(
            "vesper: could not create the data directory {}: {error}",
            data.display()
        );
        return Started { child: None, url, token };
    }

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
        .env("WORKSPACE_MODE", "sample")
        .env("AGENT_BACKEND", "sample")
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
    Started { child, url, token }
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
            let mut script = format!(
                "window.__VESPER_API_URL__ = {}; window.__VESPER_SHELL_TOKEN__ = {};",
                serde_json::to_string(&started.url).unwrap_or_else(|_| "null".into()),
                serde_json::to_string(&started.token).unwrap_or_else(|_| "null".into())
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
                       report('text=' + (document.body ? document.body.innerText.slice(0, 400) : 'no-body')); \
                       report('scripts=' + document.scripts.length); \
                       var tag = document.querySelector('script[src]'); \
                       report('firstScript=' + (tag ? tag.getAttribute('src') : 'none')); \
                       if (tag) {{ \
                         fetch(tag.src).then(function (r) {{ report('bundleHTTP=' + r.status); }}) \
                                     .catch(function (e) {{ report('bundleFAIL=' + e); }}); \
                       }} \
                       try {{ fetch('http://127.0.0.1:{port}/api/health', {{mode:'no-cors'}}); report('apiReachable'); }} catch (e) {{ report('apiFail=' + e); }} \
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
