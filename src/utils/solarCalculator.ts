/**
 * Solar position calculator and DMS coordinate parser
 * Fully offline, standalone implementation for architectural sun studies.
 */

export interface SolarPosition {
  azimuth: number;  // in radians (clockwise from North, 0 to 2*PI)
  altitude: number; // in radians above horizon (-PI/2 to PI/2)
}

/**
 * Calculates the solar position (azimuth and altitude) for a given date, time, and coordinates.
 * 
 * References:
 * - Astronomical Algorithms (Jean Meeus)
 * - Standard solar position formulas based on Julian Days
 * 
 * @param date Local Date object (including target year, month, day, hour, minute)
 * @param latitude Latitude in decimal degrees (North is positive, South is negative)
 * @param longitude Longitude in decimal degrees (East is positive, West is negative)
 * @param timezoneOffsetHours UTC timezone offset (e.g. +8 for GMT+8, -5 for EST)
 */
export function computeSolarPosition(
  date: Date,
  latitude: number,
  longitude: number,
  timezoneOffsetHours: number
): SolarPosition {
  const degToRad = Math.PI / 180;

  // 1. Convert local date/time to UTC time
  // Since date is local, we get its absolute UTC timestamp
  const utcTimestamp = date.getTime();
  
  // Julian days since J2000.0 (January 1, 2000 12:00 UTC)
  // J2000 epoch timestamp is 946728000000 ms
  const msPerDay = 86400000;
  const j2000Epoch = Date.UTC(2000, 0, 1, 12, 0, 0);
  const julianDays = (utcTimestamp - j2000Epoch) / msPerDay;

  // 2. Solar coordinates (mean anomaly, ecliptic longitude, obliquity)
  // Mean longitude of the Sun
  const L = (280.460 + 0.9856474 * julianDays) % 360;
  // Mean anomaly of the Sun
  const g = ((357.528 + 0.9856003 * julianDays) % 360) * degToRad;
  // Ecliptic longitude
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * degToRad;
  // Obliquity of the ecliptic
  const epsilon = (23.439 - 0.0000004 * julianDays) * degToRad;

  // 3. Right Ascension (alpha) and Declination (delta)
  const num = Math.cos(epsilon) * Math.sin(lambda);
  const den = Math.cos(lambda);
  let alpha = Math.atan2(num, den);
  if (alpha < 0) alpha += 2 * Math.PI;

  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  // 4. Greenwich Mean Sidereal Time (GMST) in degrees
  const GMST = (280.46061837 + 360.98564736629 * julianDays) % 360;

  // Local Sidereal Time (LST)
  const LST = (GMST + longitude) * degToRad;

  // Hour Angle (H)
  let H = LST - alpha;
  // Normalize H to -PI to PI
  H = Math.atan2(Math.sin(H), Math.cos(H));

  const latRad = latitude * degToRad;

  // 5. Calculate Altitude (elevation angle above horizon)
  const sinAltitude = Math.sin(latRad) * Math.sin(delta) + Math.cos(latRad) * Math.cos(delta) * Math.cos(H);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));

  // 6. Calculate Azimuth (clockwise from North)
  const y = -Math.sin(H);
  const x = Math.tan(delta) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(H);
  let azimuth = Math.atan2(y, x);
  if (azimuth < 0) azimuth += 2 * Math.PI;

  return { azimuth, altitude };
}

/**
 * Parses coordinates supporting both Decimal Degrees and Degrees Minutes Seconds (DMS) format.
 * Examples:
 * - Decimal: "23.6959", "-23.5", "120.5346"
 * - DMS: "23°41'45\"N", "120°32'05\"E", "23d 41m 45s N", "23 41 45 S"
 * 
 * @param input String coordinate from input field
 * @returns parsed coordinate in decimal degrees, or null if invalid
 */
export function parseDMS(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try parsing directly as decimal first
  const decimalVal = Number(trimmed);
  if (!isNaN(decimalVal)) {
    return decimalVal;
  }

  // Regex to match Degrees, Minutes, Seconds (DMS)
  // Supports optional leading sign, spaces, unit characters (° d ' m " s), and trailing N/S/E/W
  const dmsRegex = /^\s*(-)?\s*(\d+)(?:[°d\s]+)(\d+)(?:['m\s]+)(\d+(?:\.\d+)?)(?:"|s|''|\s*)*(?:([NSEW]))?\s*$/i;
  const match = trimmed.match(dmsRegex);

  if (match) {
    const isNegative = !!match[1];
    const degrees = parseFloat(match[2]);
    const minutes = parseFloat(match[3]);
    const seconds = parseFloat(match[4]);
    const direction = match[5]?.toUpperCase();

    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (isNegative) {
      decimal = -decimal;
    }

    if (direction === 'S' || direction === 'W') {
      decimal = -Math.abs(decimal);
    } else if (direction === 'N' || direction === 'E') {
      decimal = Math.abs(decimal);
    }

    return decimal;
  }

  // Also support Degrees and Decimal Minutes (DM) format, e.g. "23° 41.75' N"
  const dmRegex = /^\s*(-)?\s*(\d+)(?:[°d\s]+)(\d+(?:\.\d+)?)(?:['m\s]*)*(?:([NSEW]))?\s*$/i;
  const matchDM = trimmed.match(dmRegex);
  if (matchDM) {
    const isNegative = !!matchDM[1];
    const degrees = parseFloat(matchDM[2]);
    const minutes = parseFloat(matchDM[3]);
    const direction = matchDM[4]?.toUpperCase();

    let decimal = degrees + minutes / 60;
    if (isNegative) {
      decimal = -decimal;
    }

    if (direction === 'S' || direction === 'W') {
      decimal = -Math.abs(decimal);
    } else if (direction === 'N' || direction === 'E') {
      decimal = Math.abs(decimal);
    }

    return decimal;
  }

  return null;
}

/**
 * Formats a decimal coordinate to standard DMS format for display.
 * E.g., 23.695833 -> 23°41'45"N
 */
export function formatToDMS(decimal: number, isLongitude: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.round((minutesNotTruncated - minutes) * 60);

  let direction = '';
  if (isLongitude) {
    direction = decimal >= 0 ? 'E' : 'W';
  } else {
    direction = decimal >= 0 ? 'N' : 'S';
  }

  return `${degrees}°${minutes}'${seconds}"${direction}`;
}
