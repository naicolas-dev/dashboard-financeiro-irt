# PWA Review Report

**URL:** http://example.com
**Date:** 2026-02-04 12:40 UTC
**Overall Score:** 3/160 (2%) — Grade: F (Not a Functional PWA)

## Score Overview

```
Overall: [█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 3/160
```

| Category | Score | Bar |
|----------|-------|-----|
| Manifest Compliance | 0/20 (0%) | `[░░░░░░░░░░] 0/20` |
| Advanced Manifest | 0/15 (0%) | `[░░░░░░░░░░] 0/15` |
| Service Worker & Caching | 0/28 (0%) | `[░░░░░░░░░░] 0/28` |
| Offline Capability | 0/12 (0%) | `[░░░░░░░░░░] 0/12` |
| Installability | 0/13 (0%) | `[░░░░░░░░░░] 0/13` |
| Security | 0/16 (0%) | `[░░░░░░░░░░] 0/16` |
| Performance Signals | 3/14 (21%) | `[██░░░░░░░░] 3/14` |
| UX & Accessibility | 0/17 (0%) | `[░░░░░░░░░░] 0/17` |
| SEO & Discoverability | 0/7 (0%) | `[░░░░░░░░░░] 0/7` |
| PWA Advanced | 0/17 (0%) | `[░░░░░░░░░░] 0/17` |
| iOS Compatibility | 0/1 (0%) | `[░░░░░░░░░░] 0/1` |

## Critical Findings

These issues **block** PWA functionality or installability:

- **[Manifest]** No manifest.json found
  - PWA requires a valid web app manifest
- **[Service Worker]** No service worker registration in HTML
- **[Service Worker]** No service worker found
- **[Installability]** No <link rel='manifest'> in HTML
- **[Installability]** Not HTTPS — install blocked
- **[Security]** Not HTTPS — all PWA features require secure origin
- **[Security]** 3 mixed content references (http://)
  - Blocked by browsers, breaks SW
- **[Performance]** 3 render-blocking scripts
- **[Performance]** Missing viewport meta tag
- **[UX & A11y]** No responsive viewport

## Warnings

These items need improvement:

- **[Offline]** No offline fallback page
- **[Offline]** No app shell caching detected
- **[Offline]** No offline/online state indicator
- **[Offline]** No update prompt shown to user
- **[Offline]** No graceful update flow
- **[Installability]** No SW fetch handler — may block install
- **[Installability]** No apple-touch-icon — generic iOS icon
- **[Installability]** No beforeinstallprompt handling
- **[Installability]** No custom install UI
- **[Security]** No CSP meta tag detected
  - CSP via HTTP header is preferred and not detectable from HTML alone.
- **[Security]** 3 external resources without SRI
- **[Security]** No COOP/COEP headers
- **[Security]** No Referrer-Policy
- **[Performance]** No async/defer
- **[Performance]** No resource hints
- **[Performance]** No LCP optimization
- **[Performance]** No CLS prevention (images missing dimensions)
- **[Performance]** No critical CSS inlined
- **[UX & A11y]** No semantic HTML landmarks
- **[UX & A11y]** No ARIA attributes
- **[UX & A11y]** Missing lang on <html>
- **[UX & A11y]** No <meta name='theme-color'>
- **[UX & A11y]** No focus indicators
- **[UX & A11y]** No skip to main content link
- **[UX & A11y]** No viewport-fit=cover — iPhone notch/Dynamic Island not handled
- **[UX & A11y]** No safe area CSS — fixed elements may be obscured
- **[UX & A11y]** No touch event handlers — iOS PWA buttons may not respond
- **[iOS Compatibility]** Missing apple-mobile-web-app-capable
- **[iOS Compatibility]** Missing apple-mobile-web-app-status-bar-style
- **[iOS Compatibility]** Missing mobile-web-app-capable

## Notes

- **[Advanced Manifest]** Skipped — no manifest available
- **[Advanced Manifest]** No iOS splash screens configured
- **[Offline]** No static asset caching in SW
- **[Installability]** No custom install prompt (browser default)
- **[UX & A11y]** No iOS status bar styling

## iOS/Safari Specific Notes

This site has **no iOS PWA support**:
- No safe area handling — content will be obscured by notch/Dynamic Island
- No touch event optimizations — buttons may fail to respond in PWA mode
- No splash screens — users see blank white screen on launch
- No iOS meta tags — won't behave as a native-like app

## Prioritized Recommendations

### High Priority (Blockers)

1. **No manifest.json found** (Manifest)
   - PWA requires a valid web app manifest
   - **How to fix:** Create a `manifest.json` and add `<link rel="manifest" href="/manifest.json">` in your HTML `<head>`.
2. **No service worker registration in HTML** (Service Worker)
   - **How to fix:** Register a service worker:
```js
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```
3. **No service worker found** (Service Worker)
   - **How to fix:** Register a service worker:
```js
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```
4. **No <link rel='manifest'> in HTML** (Installability)
   - **How to fix:** Add `<link rel="manifest" href="/manifest.json">` in `<head>`.
5. **Not HTTPS — install blocked** (Installability)
   - **How to fix:** Serve your site over HTTPS. Use Let's Encrypt for free TLS certificates.
6. **Not HTTPS — all PWA features require secure origin** (Security)
   - **How to fix:** Serve your site over HTTPS. Use Let's Encrypt for free TLS certificates.
7. **3 mixed content references (http://)** (Security)
   - Blocked by browsers, breaks SW
   - **How to fix:** Replace all `http://` references with `https://` in src, href, and action attributes.
8. **3 render-blocking scripts** (Performance)
   - **How to fix:** Add `async`, `defer`, or `type="module"` to `<script>` tags in `<head>`.
9. **Missing viewport meta tag** (Performance)
   - **How to fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1">` in `<head>`.
10. **No responsive viewport** (UX & A11y)
   - **How to fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in `<head>`.

### Medium Priority (Improvements)

1. **No offline fallback page** (Offline)
   - **How to fix:** Cache an offline page and serve on fetch fail:
```js
.catch(() => caches.match("/offline.html"))
```
2. **No app shell caching detected** (Offline)
3. **No offline/online state indicator** (Offline)
   - **How to fix:** Detect offline state:
```js
window.addEventListener("offline", () => showBanner("You are offline"));
window.addEventListener("online", () => hideBanner());
```
4. **No update prompt shown to user** (Offline)
   - **How to fix:** Show update notification when SW updates:
```js
registration.addEventListener('updatefound', () => {
  showNotification('New version available! Click to update.');
});
```
5. **No SW fetch handler — may block install** (Installability)
   - **How to fix:** Add fetch handler:
```js
self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```
6. **No apple-touch-icon — generic iOS icon** (Installability)
   - **How to fix:** Add `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180×180px).
7. **No beforeinstallprompt handling** (Installability)
   - **How to fix:** Add install prompt handler:
```js
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});
```
8. **No CSP meta tag detected** (Security)
   - **How to fix:** Add CSP meta tag:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
```
Or better: set via HTTP header.
9. **3 external resources without SRI** (Security)
   - **How to fix:** Add integrity to external scripts:
```html
<script src="https://cdn.example.com/lib.js"
  integrity="sha384-..." crossorigin="anonymous"></script>
```
Generate hashes at https://www.srihash.org/
10. **No async/defer** (Performance)
   - **How to fix:** Add `async`, `defer`, or `type="module"` to `<script>` tags in `<head>`.
11. **No resource hints** (Performance)
   - **How to fix:** Add resource hints:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preload" href="/critical.css" as="style">
```
12. **No semantic HTML landmarks** (UX & A11y)
   - **How to fix:** Use semantic elements: `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`, `<section>`.
13. **No ARIA attributes** (UX & A11y)
   - **How to fix:** Add ARIA: `role="navigation"`, `aria-label="..."`, `aria-hidden="true"` where needed.
14. **Missing lang on <html>** (UX & A11y)
   - **How to fix:** Add language: `<html lang="en">` (use your BCP-47 language code).
15. **No <meta name='theme-color'>** (UX & A11y)
   - **How to fix:** Add `<meta name="theme-color" content="#your-color">` in `<head>`. Separate from manifest theme_color.
16. **No focus indicators** (UX & A11y)
   - **How to fix:** Ensure `:focus` styles are visible. Don't use `outline: none` without providing alternative focus styles.
17. **No skip to main content link** (UX & A11y)
   - **How to fix:** Add skip link as first focusable element:
```html
<a href="#main" class="skip-link">Skip to main content</a>
```
18. **No viewport-fit=cover** (UX & A11y - iOS)
   - **How to fix:** Update viewport meta for safe area access:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
19. **No safe area CSS** (UX & A11y - iOS)
   - **How to fix:** Add safe area padding to fixed/sticky elements:
```css
.fixed-header {
  padding-top: env(safe-area-inset-top);
}
.fixed-footer {
  padding-bottom: env(safe-area-inset-bottom);
}
```
20. **No iOS meta tags** (iOS Compatibility)
   - **How to fix:** Add iOS-specific meta tags:
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
```

### Quick Wins

These fixes take less than 5 minutes each:

1. No manifest.json found → Create a `manifest.json` and add `<link rel="manifest" href="/manifest.json">` in your HTML `<head>`.
2. No <link rel='manifest'> in HTML → Add `<link rel="manifest" href="/manifest.json">` in `<head>`.
3. Not HTTPS — install blocked → Serve your site over HTTPS. Use Let's Encrypt for free TLS certificates.
4. Not HTTPS — all PWA features require secure origin → Serve your site over HTTPS. Use Let's Encrypt for free TLS certificates.
5. 3 mixed content references (http://) → Replace all `http://` references with `https://` in src, href, and action attributes.

## Reference Links

- **Installability**: https://web.dev/learn/pwa/installation/
- **Manifest**: https://web.dev/add-manifest/
- **Offline**: https://web.dev/learn/pwa/offline-data/
- **Performance**: https://web.dev/learn/performance/
- **Security**: https://web.dev/articles/csp
- **Service Worker**: https://web.dev/learn/pwa/service-workers/
- **UX & A11y**: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices
- **PWA Checklist**: https://web.dev/articles/pwa-checklist
- **Lighthouse**: https://developer.chrome.com/docs/lighthouse
- **iOS Safe Areas**: https://webkit.org/blog/7929/designing-websites-for-iphone-x/

---
*Generated by PWA Review Skill v5.0.0*
