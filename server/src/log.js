const DATE_TEXT = /\b\d{2}\.\d{2}\.\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g

export function redact(value) {
  return String(value ?? '').replace(DATE_TEXT, '[date]')
}

export const log = {
  info(message) {
    console.log(redact(message))
  },
  error(message) {
    console.error(redact(message))
  },
}
