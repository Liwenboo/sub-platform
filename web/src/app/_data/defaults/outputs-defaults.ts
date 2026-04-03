import type {
  OutputNodeSortMode,
  OutputPublishNotice,
  OutputPublishStatus,
} from "../../_types/outputs-types";

export const OUTPUT_INITIAL_TOKEN = "demo_initial_token";
export const OUTPUT_INITIAL_GENERATED_AT = "--";
export const OUTPUT_DEFAULT_NAME_PLACEHOLDER = "我的订阅输出";

export const OUTPUT_DEFAULT_SORT_MODE: OutputNodeSortMode = "default";
export const OUTPUT_DEFAULT_PUBLISH_STATUS: OutputPublishStatus = "pending";
export const OUTPUT_DEFAULT_PUBLISH_NOTICE: OutputPublishNotice = "none";

export const OUTPUT_DEFAULT_EMOJI_ENABLED = true;
export const OUTPUT_DEFAULT_UDP_ENABLED = true;
export const OUTPUT_DEFAULT_TFO_ENABLED = false;
