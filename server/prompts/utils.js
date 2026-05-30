export function getLangStr(language) {
  return Array.isArray(language) ? language.join(" + ") : String(language ?? "");
}

export function fillTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, String(val ?? "")),
    template
  );
}
