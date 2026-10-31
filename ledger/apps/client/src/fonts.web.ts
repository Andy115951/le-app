import { useEffect, useState } from "react";

let loading: Promise<void> | undefined;
function loadFonts() {
  if (!loading) {
    loading = (async () => {
      const sources = [
        ["LedgerSongti", require("../assets/fonts/LedgerSongti.ttf")],
        ["LedgerNumbers", require("../assets/fonts/LedgerNumbers.ttf")],
      ];
      // Load bundled assets directly. Expo's stylesheet/FontFaceObserver path
      // times out in the release WKWebView even with a CSP-authorized sheet.
      const faces = await Promise.all(
        sources.map(([family, source]) =>
          new FontFace(family, `url(${JSON.stringify(source)})`, {
            // Single-face family alias; the font itself has real 600 outlines.
            weight: "normal",
            style: "normal",
            display: "swap",
          }).load(),
        ),
      );
      for (const face of faces) document.fonts.add(face);
    })();
  }
  return loading;
}

export function useLedgerFonts(): [boolean, Error | null] {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    void loadFonts().then(
      () => {
        if (active) setLoaded(true);
      },
      () => {
        if (active) setError(new Error("Bundled font loading failed"));
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return [loaded, error];
}
