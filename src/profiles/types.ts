import { CommandMap } from "../plugin.js";

export interface PrinterProfile {
  /** Human-readable name for debugging */
  name: string;
  /** Supported code pages, used to validate charset attribute values */
  supportedCharsets: string[];
  commands: CommandMap;
}
