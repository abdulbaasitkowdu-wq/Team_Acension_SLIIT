const timestamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

/** Always UTC, and says so: investigators compare times across sites. */
export const formatTimestamp = (value: string) => `${timestamp.format(new Date(value))} UTC`

export const formatCount = (value: number) => value.toLocaleString('en-US')

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`
