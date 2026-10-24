// Shared client-side required-field checks (used with noValidate forms).
// Returns the labels of empty fields: [[value, label], ...] -> [label, ...]
export const empties = (fields) =>
  fields.filter(([v]) => v === '' || v === null || v === undefined).map(([, label]) => label);
