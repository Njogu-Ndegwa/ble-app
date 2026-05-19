/**
 * Utility for calling Android JSBridge handlers from the web app.
 * The bridge is only available when running inside the Oves Android WebView.
 */

declare global {
  interface Window {
    WebViewJavascriptBridge?: {
      callHandler(
        name: string,
        data: string,
        callback?: (response: string) => void
      ): void;
      registerHandler(
        name: string,
        handler: (data: string, callback: (response: string) => void) => void
      ): void;
    };
  }
}

export function isAndroidWebView(): boolean {
  return typeof window !== 'undefined' && !!window.WebViewJavascriptBridge;
}

function callBridge<T = unknown>(name: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!window.WebViewJavascriptBridge) {
      reject(new Error('Not in Android WebView'));
      return;
    }
    window.WebViewJavascriptBridge.callHandler(
      name,
      JSON.stringify(data),
      (responseStr) => {
        try {
          const response = JSON.parse(responseStr);
          // Bridge returns {respCode: "200", respDesc: "...", respData: ...}
          if (response.respCode === '200') {
            resolve(response.respData as T);
          } else {
            reject(new Error(response.respDesc || 'Bridge call failed'));
          }
        } catch {
          resolve(responseStr as unknown as T);
        }
      }
    );
  });
}

/**
 * Save a file to Android's Downloads directory via the JSBridge.
 * The base64 string may include a data URI prefix (e.g. "data:application/pdf;base64,...").
 * Returns the saved file path on success.
 */
export async function saveFileViaAndroid(
  base64: string,
  fileName: string,
): Promise<string> {
  return callBridge<string>('saveFile', { base64, fileName });
}
