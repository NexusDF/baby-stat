import { DateTime } from 'luxon'

export const ZONES = [
  { id: 'Europe/Kaliningrad', label: 'Калининград' },
  { id: 'Europe/Moscow', label: 'Москва' },
  { id: 'Europe/Samara', label: 'Самара' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург' },
  { id: 'Asia/Omsk', label: 'Омск' },
  { id: 'Asia/Novosibirsk', label: 'Новосибирск' },
  { id: 'Asia/Krasnoyarsk', label: 'Красноярск' },
  { id: 'Asia/Irkutsk', label: 'Иркутск' },
  { id: 'Asia/Yakutsk', label: 'Якутск' },
  { id: 'Asia/Vladivostok', label: 'Владивосток' },
  { id: 'Asia/Magadan', label: 'Магадан' },
  { id: 'Asia/Kamchatka', label: 'Камчатка' },
]

const ALIASES = {
  'санкт-петербург': 'Europe/Moscow',
  петербург: 'Europe/Moscow',
  спб: 'Europe/Moscow',
  питер: 'Europe/Moscow',
  казань: 'Europe/Moscow',
  'нижний новгород': 'Europe/Moscow',
  сочи: 'Europe/Moscow',
  краснодар: 'Europe/Moscow',
  воронеж: 'Europe/Moscow',
  уфа: 'Asia/Yekaterinburg',
  пермь: 'Asia/Yekaterinburg',
  тюмень: 'Asia/Yekaterinburg',
  барнаул: 'Asia/Krasnoyarsk',
  хабаровск: 'Asia/Vladivostok',
}

function norm(value) {
  return String(value || '').trim().toLowerCase().replaceAll('ё', 'е')
}

export function zoneLabel(id) {
  return ZONES.find((zone) => zone.id === id)?.label || id
}

export function matchZone(text) {
  const name = norm(text)
  if (!name) return null
  if (ALIASES[name]) return ALIASES[name]
  for (const zone of ZONES) {
    if (norm(zone.label) === name || norm(zone.id) === name) return zone.id
  }
  if (name.includes('/') && DateTime.now().setZone(text.trim()).isValid) return text.trim()
  return null
}
