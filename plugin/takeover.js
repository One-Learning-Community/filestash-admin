// Replaced by the admin_svelte plugin: starts the Svelte admin console in place
// of the built-in one. Remove the plugin to get the built-in admin back.
const PLUGIN = "admin_svelte";
const ref = (import.meta.url.match(/\/assets\/([^/]+)\/boot\//) || [])[1];
const root = new URL(`assets/${ref}/plugin/${PLUGIN}.zip/`, document.baseURI);

// the built-in admin's stylesheet and widgets
document.querySelectorAll('link[rel="stylesheet"]').forEach(($el) => $el.remove());
document.querySelectorAll("component-modal, component-notification").forEach(($el) => $el.remove());

// a fresh mount point, detached from the built-in admin's
const $app = document.createElement("div");
$app.id = "app";
document.getElementById("app").replaceWith($app);

const $css = document.createElement("link");
$css.rel = "stylesheet";
$css.href = new URL("admin/index.css", root).href;
document.head.appendChild($css);

// a script tag, not import(): the console finds its language files next to this src
const $js = document.createElement("script");
$js.type = "module";
$js.src = new URL("admin/index.js", root).href;
document.body.appendChild($js);

// never resolve, so the built-in admin's router never starts
await new Promise(() => {});
