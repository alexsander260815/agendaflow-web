"use client";

import { useEffect } from "react";

/**
 * Conecta a Capacitor (app iOS) quando o site está rodando dentro do
 * app embrulhado — no navegador normal isso não faz nada.
 */
export default function NativeAppBridge() {
  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0a1628" });

        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // Fora do app nativo (ou plugin indisponível) — segue normalmente.
      }
    })();
  }, []);

  return null;
}
