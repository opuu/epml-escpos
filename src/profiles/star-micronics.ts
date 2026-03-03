import { PrinterProfile } from "./types";
import { StandardEpsonProfile } from "./standard-epson";

// A sample custom profile for Star Micronics printers
// Many commands are similar, but some specific hardware commands differ.
export const StarMicronicsProfile: PrinterProfile = {
  ...StandardEpsonProfile,
  commands: {
    ...StandardEpsonProfile.commands,
    initialization: [0x1b, 0x40], // Often same as Epson
    hardware: {
      ...StandardEpsonProfile.commands.hardware,
      cut: {
        full: [0x1b, 0x64, 0x02], // Star full cut
        partial: [0x1b, 0x64, 0x03], // Star partial cut
      },
    },
  },
};
