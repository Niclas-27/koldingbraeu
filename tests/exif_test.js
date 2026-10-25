// Test für lib/bilder.js Bilder.exifDatum() – liest das Aufnahmedatum aus einem minimalen, selbstgebauten
// JPEG+Exif-Puffer (kein echtes Bild, nur die Marker-Struktur, die der Parser braucht).
// Aufruf: node tests/exif_test.js
require("../lib/bilder.js");
let fehler = 0;
const ok = (name, bed, info = "") => { console.log((bed ? "  ok    " : "  FEHLT ") + name + (info ? "  (" + info + ")" : "")); if (!bed) fehler++; };

/* Baut ein minimales JPEG: SOI, APP1 mit Exif/TIFF (IFD0 → Exif-Sub-IFD → DateTimeOriginal), EOI. */
function jpegMitDatum(datumStr) {
  const str = Buffer.from(datumStr + "\0", "ascii"); // "YYYY:MM:DD HH:MM:SS\0" – 20 Byte
  const ifd0 = Buffer.alloc(2 + 12 + 4);
  ifd0.writeUInt16LE(1, 0);                       // 1 Eintrag
  ifd0.writeUInt16LE(0x8769, 2);                  // Tag: Exif-IFD-Zeiger
  ifd0.writeUInt16LE(4, 4);                       // Typ: LONG
  ifd0.writeUInt32LE(1, 6);                       // Anzahl: 1
  ifd0.writeUInt32LE(8 + ifd0.length, 10);         // Wert: Offset der Exif-Sub-IFD
  ifd0.writeUInt32LE(0, 14);                      // keine weitere IFD

  const exifIfdOffset = 8 + ifd0.length, stringOffset = exifIfdOffset + 18;
  const exifIfd = Buffer.alloc(18);
  exifIfd.writeUInt16LE(1, 0);                    // 1 Eintrag
  exifIfd.writeUInt16LE(0x9003, 2);                // Tag: DateTimeOriginal
  exifIfd.writeUInt16LE(2, 4);                     // Typ: ASCII
  exifIfd.writeUInt32LE(str.length, 6);            // Anzahl Zeichen (inkl. \0)
  exifIfd.writeUInt32LE(stringOffset, 10);         // Wert: Offset der Zeichenkette
  // (kein "nächste IFD"-Feld nötig, wird nicht gelesen)

  const tiff = Buffer.alloc(8);
  tiff.write("II", 0, "ascii"); tiff.writeUInt16LE(0x002A, 2); tiff.writeUInt32LE(8, 4);

  const exifHeader = Buffer.from("Exif\0\0", "ascii");
  const app1Daten = Buffer.concat([exifHeader, tiff, ifd0, exifIfd, str]);
  const app1Laenge = Buffer.alloc(2); app1Laenge.writeUInt16LE(app1Daten.length + 2, 0);

  const soi = Buffer.from([0xFF, 0xD8]);
  const app1Marker = Buffer.from([0xFF, 0xE1]);
  const eoi = Buffer.from([0xFF, 0xD9]);
  return Buffer.concat([soi, app1Marker, app1Laenge, app1Daten, eoi]);
}

(async () => {
  console.log("Exif-Datum lesen");
  const datei1 = new File([jpegMitDatum("2026:03:12 08:30:00")], "foto.jpg", { type: "image/jpeg" });
  ok("DateTimeOriginal wird gelesen", await Bilder.exifDatum(datei1) === "2026-03-12");

  const ohneExif = new File([Buffer.from([0xFF, 0xD8, 0xFF, 0xD9])], "leer.jpg", { type: "image/jpeg" });
  ok("JPEG ohne Exif liefert null", await Bilder.exifDatum(ohneExif) === null);

  const keinJpeg = new File([Buffer.from("keine bilddatei")], "text.txt", { type: "text/plain" });
  ok("Keine JPEG-Datei liefert null", await Bilder.exifDatum(keinJpeg) === null);

  const kaputt = new File([Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, 0xFF, 0xFF])], "kaputt.jpg", { type: "image/jpeg" });
  ok("Kaputtes Exif-Segment wirft nicht, liefert null", await Bilder.exifDatum(kaputt) === null);

  console.log(fehler ? `\n${fehler} Fehler.` : "\nAlles grün.");
  process.exit(fehler ? 1 : 0);
})();
