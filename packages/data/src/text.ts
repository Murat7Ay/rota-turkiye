// Metin yardımcıları: Türkçe büyük/küçük harf ve aksan katlama.

const FOLD: Record<string, string> = {
  ı: "i",
  ş: "s",
  ç: "c",
  ğ: "g",
  ö: "o",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
  é: "e",
  è: "e",
  ë: "e",
  á: "a",
  à: "a",
  ä: "a",
  ó: "o",
  í: "i",
};

/**
 * Türkçe küçük harfe çevirip aksanları ASCII'ye katlar ("Çay Bahçesi" → "cay bahcesi").
 * Böylece kurallar düz ASCII regex ve \b sınırlarıyla yazılabilir.
 */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/[ıþşçğöüâîûéèëáàäóí]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Tekilleştirme anahtarı: katlanmış, noktalamasız, tek boşluklu ad */
export function normName(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** URL dostu kimlik: "Selçuk" → "selcuk" */
export function slug(s: string): string {
  return normName(s).replace(/ /g, "-");
}
