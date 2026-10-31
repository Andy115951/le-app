import { useFonts } from "expo-font";

export function useLedgerFonts() {
  return useFonts({
    LedgerSongti: require("../assets/fonts/LedgerSongti.ttf"),
    LedgerNumbers: require("../assets/fonts/LedgerNumbers.ttf"),
  });
}
