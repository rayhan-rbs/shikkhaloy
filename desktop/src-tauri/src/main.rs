// 📁 desktop/src-tauri/src/main.rs — M15-A ডেস্কটপ-র‍্যাপার (মূল-কোডবেস-অস্পৃশ্য)
// জানালা = প্রোড-সাইট; বাইরের-ডোমেইন = সিস্টেম-ব্রাউজার; ডাবল-লঞ্চ = ফোকাস-বদল
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const APP_URL: &str = "https://shikkhaloy-kappa.vercel.app";
const APP_HOSTS: [&str; 1] = ["shikkhaloy-kappa.vercel.app"]; // নিজের-ডোমেইন-এলে-এখানে-যোগ

fn is_app_url(u: &tauri::Url) -> bool {
    u.host_str().map(|h| APP_HOSTS.contains(&h)).unwrap_or(false)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let url: tauri::Url = APP_URL.parse().expect("APP_URL ভুল");
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Shikkhaloy — শিক্ষার সম্পূর্ণ ডিজিটাল রূপ")
                .inner_size(1280.0, 820.0)
                .min_inner_size(960.0, 640.0)
                .resizable(true)
                .center()
                .initialization_script(
                    r#"(function () {
  document.addEventListener("click", function (e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === "A" && el.target === "_blank") {
        e.preventDefault();
        window.location.href = el.href;
        return;
      }
      el = el.parentElement;
    }
  }, true);
})();
"#,
                )
                .on_navigation(|u| {
                    if is_app_url(u) {
                        true
                    } else if u.scheme() == "http" || u.scheme() == "https" {
                        let _ = open::that(u.as_str());
                        false
                    } else {
                        false
                    }
                })
                .build()?;
            let _ = win.set_focus();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Shikkhaloy ডেস্কটপ চালু করা যায়নি");
}
