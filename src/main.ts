/// <reference types="tampermonkey" />
// @ts-nocheck

import { bootstrapApp } from "./app";

(() => {
  window.onload = () => {
    bootstrapApp().catch((e) =>
      console.error("Overlay Pro bootstrap failed", e),
    );
  };
})();

