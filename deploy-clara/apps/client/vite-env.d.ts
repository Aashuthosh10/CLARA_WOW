/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_UNIFIED_MODE?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_SOCKET_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

