/**
 * Timezone helpers for the scheduler (mirrors the web DateTimePicker math).
 * Everything is defensive: Hermes/older engines may lack
 * `supportedValuesOf` or full ICU, every helper falls back to device-zone
 * behavior instead of throwing.
 */

/**
 * Complete canonical IANA zone set (what `Intl.supportedValuesOf('timeZone')`
 * returns on a full engine). Hermes does not implement supportedValuesOf, so
 * the app must carry its own list, the old 29-entry fallback made the
 * scheduler's timezone picker feel "not full" on Android and older iOS.
 * Grouped by region; the picker also searches by city, so order is cosmetic.
 */
const CANONICAL_ZONES = [
  // Africa
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers',
  'Africa/Asmara', 'Africa/Bamako', 'Africa/Bangui', 'Africa/Banjul',
  'Africa/Bissau', 'Africa/Blantyre', 'Africa/Brazzaville', 'Africa/Bujumbura',
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Ceuta', 'Africa/Conakry',
  'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Douala',
  'Africa/El_Aaiun', 'Africa/Freetown', 'Africa/Gaborone', 'Africa/Harare',
  'Africa/Johannesburg', 'Africa/Juba', 'Africa/Kampala', 'Africa/Khartoum',
  'Africa/Kigali', 'Africa/Kinshasa', 'Africa/Lagos', 'Africa/Libreville',
  'Africa/Lome', 'Africa/Luanda', 'Africa/Lubumbashi', 'Africa/Lusaka',
  'Africa/Malabo', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane',
  'Africa/Mogadishu', 'Africa/Monrovia', 'Africa/Nairobi', 'Africa/Ndjamena',
  'Africa/Niamey', 'Africa/Nouakchott', 'Africa/Ouagadougou',
  'Africa/Porto-Novo', 'Africa/Sao_Tome', 'Africa/Tripoli', 'Africa/Tunis',
  'Africa/Windhoek',
  // America
  'America/Adak', 'America/Anchorage', 'America/Anguilla', 'America/Antigua',
  'America/Araguaina', 'America/Argentina/Buenos_Aires',
  'America/Argentina/Catamarca', 'America/Argentina/Cordoba',
  'America/Argentina/Jujuy', 'America/Argentina/La_Rioja',
  'America/Argentina/Mendoza', 'America/Argentina/Rio_Gallegos',
  'America/Argentina/Salta', 'America/Argentina/San_Juan',
  'America/Argentina/San_Luis', 'America/Argentina/Tucuman',
  'America/Argentina/Ushuaia', 'America/Aruba', 'America/Asuncion',
  'America/Atikokan', 'America/Bahia', 'America/Bahia_Banderas',
  'America/Barbados', 'America/Belem', 'America/Belize',
  'America/Blanc-Sablon', 'America/Boa_Vista', 'America/Bogota',
  'America/Boise', 'America/Cambridge_Bay', 'America/Campo_Grande',
  'America/Cancun', 'America/Caracas', 'America/Cayenne', 'America/Cayman',
  'America/Chicago', 'America/Chihuahua', 'America/Ciudad_Juarez',
  'America/Costa_Rica', 'America/Creston', 'America/Cuiaba',
  'America/Curacao', 'America/Danmarkshavn', 'America/Dawson',
  'America/Dawson_Creek', 'America/Denver', 'America/Detroit',
  'America/Dominica', 'America/Edmonton', 'America/Eirunepe',
  'America/El_Salvador', 'America/Fort_Nelson', 'America/Fortaleza',
  'America/Glace_Bay', 'America/Goose_Bay', 'America/Grand_Turk',
  'America/Grenada', 'America/Guadeloupe', 'America/Guatemala',
  'America/Guayaquil', 'America/Guyana', 'America/Halifax', 'America/Havana',
  'America/Hermosillo', 'America/Indiana/Indianapolis',
  'America/Indiana/Knox', 'America/Indiana/Marengo',
  'America/Indiana/Petersburg', 'America/Indiana/Tell_City',
  'America/Indiana/Vevay', 'America/Indiana/Vincennes',
  'America/Indiana/Winamac', 'America/Inuvik', 'America/Iqaluit',
  'America/Jamaica', 'America/Juneau', 'America/Kentucky/Louisville',
  'America/Kentucky/Monticello', 'America/Kralendijk', 'America/La_Paz',
  'America/Lima', 'America/Los_Angeles', 'America/Lower_Princes',
  'America/Maceio', 'America/Managua', 'America/Manaus', 'America/Marigot',
  'America/Martinique', 'America/Matamoros', 'America/Mazatlan',
  'America/Menominee', 'America/Merida', 'America/Metlakatla',
  'America/Mexico_City', 'America/Moncton', 'America/Monterrey',
  'America/Montevideo', 'America/Montserrat', 'America/Nassau',
  'America/New_York', 'America/Nome', 'America/Norfolk',
  'America/North_Dakota/Beulah', 'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem', 'America/Nuuk', 'America/Ojinaga',
  'America/Panama', 'America/Pangnirtung', 'America/Paramaribo',
  'America/Phoenix', 'America/Port-au-Prince', 'America/Port_of_Spain',
  'America/Porto_Velho', 'America/Puerto_Rico', 'America/Punta_Arenas',
  'America/Rankin_Inlet', 'America/Recife', 'America/Regina',
  'America/Resolute', 'America/Rio_Branco', 'America/Santiago',
  'America/Santo_Domingo', 'America/Sao_Paulo', 'America/Scoresbysund',
  'America/Simferopol', 'America/Sitka', 'America/St_Barthelemy',
  'America/St_Johns', 'America/St_Kitts', 'America/St_Lucia',
  'America/St_Thomas', 'America/St_Vincent', 'America/Swift_Current',
  'America/Tegucigalpa', 'America/Thule', 'America/Tijuana',
  'America/Toronto', 'America/Tortola', 'America/Vancouver',
  'America/Whitehorse', 'America/Winnipeg', 'America/Yakutat',
  'America/Yellowknife',
  // Antarctica
  'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/DumontDUrville',
  'Antarctica/Macquarie', 'Antarctica/Mawson', 'Antarctica/McMurdo',
  'Antarctica/Palmer', 'Antarctica/Rothera', 'Antarctica/Syowa',
  'Antarctica/Troll', 'Antarctica/Vostok',
  // Arctic
  'Arctic/Longyearbyen',
  // Asia
  'Asia/Aden', 'Asia/Almaty', 'Asia/Amman', 'Asia/Anadyr', 'Asia/Aqtau',
  'Asia/Aqtobe', 'Asia/Ashgabat', 'Asia/Atyrau', 'Asia/Baghdad',
  'Asia/Bahrain', 'Asia/Baku', 'Asia/Bangkok', 'Asia/Barnaul', 'Asia/Beirut',
  'Asia/Bishkek', 'Asia/Brunei', 'Asia/Chita', 'Asia/Colombo',
  'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dili', 'Asia/Dubai', 'Asia/Dushanbe',
  'Asia/Famagusta', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong', 'Asia/Hovd', 'Asia/Irkutsk', 'Asia/Jakarta',
  'Asia/Jayapura', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Kamchatka',
  'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Khandyga', 'Asia/Kolkata',
  'Asia/Krasnoyarsk', 'Asia/Kuala_Lumpur', 'Asia/Kuching', 'Asia/Kuwait',
  'Asia/Macau', 'Asia/Magadan', 'Asia/Makassar', 'Asia/Manila', 'Asia/Muscat',
  'Asia/Nicosia', 'Asia/Novokuznetsk', 'Asia/Novosibirsk', 'Asia/Omsk',
  'Asia/Oral', 'Asia/Phnom_Penh', 'Asia/Pontianak', 'Asia/Pyongyang',
  'Asia/Qatar', 'Asia/Qostanay', 'Asia/Qyzylorda', 'Asia/Riyadh',
  'Asia/Sakhalin', 'Asia/Samarkand', 'Asia/Seoul', 'Asia/Shanghai',
  'Asia/Singapore', 'Asia/Srednekolymsk', 'Asia/Taipei', 'Asia/Tashkent',
  'Asia/Tbilisi', 'Asia/Tehran', 'Asia/Thimphu', 'Asia/Tokyo', 'Asia/Tomsk',
  'Asia/Ulaanbaatar', 'Asia/Urumqi', 'Asia/Ust-Nera', 'Asia/Vientiane',
  'Asia/Vladivostok', 'Asia/Yakutsk', 'Asia/Yangon', 'Asia/Yekaterinburg',
  'Asia/Yerevan',
  // Atlantic
  'Atlantic/Azores', 'Atlantic/Bermuda', 'Atlantic/Canary',
  'Atlantic/Cape_Verde', 'Atlantic/Faroe', 'Atlantic/Madeira',
  'Atlantic/Reykjavik', 'Atlantic/South_Georgia', 'Atlantic/Stanley',
  // Australia
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill',
  'Australia/Darwin', 'Australia/Eucla', 'Australia/Hobart',
  'Australia/Lindeman', 'Australia/Lord_Howe', 'Australia/Melbourne',
  'Australia/Perth', 'Australia/Sydney',
  // Europe
  'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Astrakhan', 'Europe/Athens',
  'Europe/Belgrade', 'Europe/Berlin', 'Europe/Busingen', 'Europe/Chisinau',
  'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Gibraltar',
  'Europe/Guernsey', 'Europe/Helsinki', 'Europe/Isle_of_Man',
  'Europe/Istanbul', 'Europe/Jersey', 'Europe/Kaliningrad', 'Europe/Kirov',
  'Europe/Kyiv', 'Europe/Lisbon', 'Europe/Ljubljana', 'Europe/London',
  'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Mariehamn',
  'Europe/Minsk', 'Europe/Monaco', 'Europe/Moscow', 'Europe/Oslo',
  'Europe/Paris', 'Europe/Podgorica', 'Europe/Prague', 'Europe/Riga',
  'Europe/Rome', 'Europe/Samara', 'Europe/San_Marino', 'Europe/Sarajevo',
  'Europe/Saratov', 'Europe/Simferopol', 'Europe/Skopje', 'Europe/Sofia',
  'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane',
  'Europe/Ulyanovsk', 'Europe/Vaduz', 'Europe/Vatican', 'Europe/Vienna',
  'Europe/Vilnius', 'Europe/Volgograd', 'Europe/Warsaw', 'Europe/Zagreb',
  'Europe/Zurich',
  // Indian
  'Indian/Antananarivo', 'Indian/Chagos', 'Indian/Christmas',
  'Indian/Cocos', 'Indian/Comoro', 'Indian/Kerguelen', 'Indian/Mahe',
  'Indian/Maldives', 'Indian/Mauritius', 'Indian/Mayotte', 'Indian/Reunion',
  // Pacific
  'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Bougainville',
  'Pacific/Chatham', 'Pacific/Chuuk', 'Pacific/Easter', 'Pacific/Efate',
  'Pacific/Fakaofo', 'Pacific/Fiji', 'Pacific/Funafuti', 'Pacific/Galapagos',
  'Pacific/Gambier', 'Pacific/Guadalcanal', 'Pacific/Guam',
  'Pacific/Honolulu', 'Pacific/Kanton', 'Pacific/Kiritimati',
  'Pacific/Kosrae', 'Pacific/Kwajalein', 'Pacific/Majuro',
  'Pacific/Marquesas', 'Pacific/Midway', 'Pacific/Nauru', 'Pacific/Niue',
  'Pacific/Norfolk', 'Pacific/Noumea', 'Pacific/Pago_Pago', 'Pacific/Palau',
  'Pacific/Pitcairn', 'Pacific/Pohnpei', 'Pacific/Port_Moresby',
  'Pacific/Rarotonga', 'Pacific/Saipan', 'Pacific/Tahiti', 'Pacific/Tarawa',
  'Pacific/Tongatapu', 'Pacific/Wake',
  // Misc
  'Etc/GMT', 'Etc/UTC', 'UTC', 'GMT',
];

export function deviceZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

export function supportedZones(): string[] {
  // Union of whatever the engine knows and the canonical list, Hermes has
  // no supportedValuesOf, browsers do; either way every city is present.
  const set = new Set<string>(CANONICAL_ZONES);
  try {
    const list = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (list) for (const z of list) set.add(z);
  } catch {
    /* older engines */
  }
  return [...set].sort();
}

/** "America/New_York" → "New York". */
export function zoneLabel(tz: string): string {
  const city = tz.split('/').pop() ?? tz;
  return city.replace(/_/g, ' ');
}

/** Offset (ms) of `tz` at the given UTC instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - utcMs;
  } catch {
    return 0;
  }
}

/** "GMT+8", "GMT-5", "GMT+5:30". */
export function offsetLabel(tz: string, at = Date.now()): string {
  const off = tzOffsetMs(at, tz);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const h = Math.floor(abs / 3_600_000);
  const mm = Math.round((abs % 3_600_000) / 60_000);
  return `GMT${sign}${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
}

/**
 * UTC ms for wall time (y, m 1-12, d, minutes) in tz. The schedule picker
 * value is a wall reading in the selected zone, same re-anchor rule as web.
 */
export function zonedToUtcMs(y: number, m: number, d: number, minutes: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  return guess - tzOffsetMs(guess, tz);
}

/** "9:05 AM" for an instant rendered in tz. */
export function formatTimeInTz(ms: number, tz: string): string {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
    return s;
  } catch {
    const d = new Date(ms);
    const h24 = d.getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }
}
