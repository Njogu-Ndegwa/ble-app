/**
 * Copy text reliably across desktop browsers and the Android companion
 * WebView. Returns true only when a copy mechanism reported success.
 * (Extracted pattern from rider/app/map/deepLinks.ts — migrate other
 * call sites opportunistically.)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const bridge = (window as any).WebViewJavascriptBridge;
  if (bridge?.callHandler) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        let settled = false;
        bridge.callHandler("copyToClipboard", text, (res: unknown) => {
          settled = true;
          resolve(res !== false);
        });
        setTimeout(() => {
          if (!settled) resolve(false);
        }, 400);
      });
      if (ok) return true;
    } catch (err) {
      console.warn("[clipboard] bridge copyToClipboard failed:", err);
    }
  }

  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[clipboard] navigator.clipboard.writeText failed:", err);
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    console.warn("[clipboard] execCommand copy fallback failed:", err);
    return false;
  }
}
