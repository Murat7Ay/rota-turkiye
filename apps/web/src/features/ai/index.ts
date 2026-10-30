// İsteğe bağlı yapay zekâ özellikleri (kendi Anthropic anahtarınla ya da OpenAI uyumlu bir uçla). Uygulama bunlarsız tam çalışır.
export { AiSettingsCard } from "./AiSettingsCard";
export { FreeTextTripInput, type FreeTextTripInputProps } from "./FreeTextTripInput";
export { GuideChat, type GuideChatProps } from "./GuideChat";
export { NarrationButton, type NarrationButtonProps } from "./NarrationButton";
export { RepairExplainButton, type RepairExplainButtonProps } from "./RepairExplainButton";
export { useAiConfig, getAiConfig, saveAiConfig, clearAiKey, loadAiConfig, AI_CONFIG_KEY, type AiConfig } from "./useAiConfig";
export { buildGuideContext, type GuideContext } from "./core";
