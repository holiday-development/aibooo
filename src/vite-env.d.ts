/// <reference types="vite/client" />

// Tauri global types
declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_INTERNALS__?: any;
    __TAURI_PLUGIN_INVOKE__?: any;
  }
}
