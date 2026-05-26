const BASE = 'https://ws.audioscrobbler.com/2.0/'

export async function fetchDayScrobbles(dateStr) {
  const API_KEY  = process.env.LASTFM_API_KEY
  const USERNAME = process.env.LASTFM_USERNAME
  const [year, month, day] = dateStr.split('-').map(Number)
  const from = Math.floor(new Date(year, month - 1, day, 0, 0, 0).getTime() / 1000)
  const to   = Math.floor(new Date(year, month - 1, day, 23, 59, 59).getTime() / 1000)

  const scrobbles = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const params = new URLSearchParams({
      method: 'user.getRecentTracks',
      user: USERNAME,
      api_key: API_KEY,
      format: 'json',
      from: String(from),
      to: String(to),
      limit: '200',
      page: String(page),
      extended: '0'
    })

    const res = await fetch(`${BASE}?${params}`)
    if (!res.ok) throw new Error(`Last.fm error: ${res.status}`)
    const data = await res.json()

    if (data.error) throw new Error(`Last.fm: ${data.message}`)

    const rawTracks = data.recenttracks?.track
    const tracksArr = !rawTracks
      ? []
      : Array.isArray(rawTracks) ? rawTracks : [rawTracks]

    totalPages = parseInt(data.recenttracks?.['@attr']?.totalPages ?? '1', 10)

    for (const t of tracksArr) {
      if (t['@attr']?.nowplaying) continue
      scrobbles.push({
        timestamp: parseInt(t.date?.uts ?? '0', 10),
        track:     t.name,
        artist:    t.artist?.['#text'] ?? t.artist,
        album:     t.album?.['#text'] ?? null,
        mbid:      t.mbid || null
      })
    }
    page++
  }

  scrobbles.sort((a, b) => a.timestamp - b.timestamp)
  return scrobbles
}

/**
 * One-shot bulk fetch of the user's historical listening: top artists,
 * tracks, and albums (overall, top 1000 of each). Used to pre-populate
 * seen_* tables so years of Last.fm history don't all flag as "new".
 */
export async function backfillFromLastfm() {
  const API_KEY  = process.env.LASTFM_API_KEY
  const USERNAME = process.env.LASTFM_USERNAME

  async function fetchTop(method) {
    const params = new URLSearchParams({
      method,
      user: USERNAME,
      api_key: API_KEY,
      format: 'json',
      period: 'overall',
      limit: '1000',
    })
    const res = await fetch(`${BASE}?${params}`)
    if (!res.ok) throw new Error(`Last.fm error: ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(`Last.fm: ${data.message}`)
    return data
  }

  const [artistsData, tracksData, albumsData] = await Promise.all([
    fetchTop('user.getTopArtists'),
    fetchTop('user.getTopTracks'),
    fetchTop('user.getTopAlbums'),
  ])

  const artistName = a => (typeof a === 'string' ? a : a?.name ?? a?.['#text'] ?? '')

  const artists = (artistsData.topartists?.artist ?? []).map(a => a.name).filter(Boolean)
  const tracks  = (tracksData.toptracks?.track ?? []).map(t => ({
    name:   t.name,
    artist: artistName(t.artist),
  })).filter(t => t.name && t.artist)
  const albums  = (albumsData.topalbums?.album ?? []).map(a => ({
    name:   a.name,
    artist: artistName(a.artist),
  })).filter(a => a.name && a.artist)

  return { artists, tracks, albums }
}

/**
 * Count consecutive loops: if the same track repeats back-to-back,
 * collapse them into one entry with a play_count > 1.
 */
export function collapseLoops(scrobbles) {
  const collapsed = []
  for (const s of scrobbles) {
    const prev = collapsed[collapsed.length - 1]
    if (prev && prev.track === s.track && prev.artist === s.artist) {
      prev.play_count++
      prev.last_ts = s.timestamp
    } else {
      collapsed.push({ ...s, play_count: 1, last_ts: s.timestamp })
    }
  }
  return collapsed
}

/**
 * Build daily stats from a collapsed scrobble list.
 */
export function buildDayStats(scrobbles, collapsed) {
  // Top track
  const trackCounts = {}
  for (const s of scrobbles) {
    const key = `${s.track}|||${s.artist}`
    trackCounts[key] = (trackCounts[key] || 0) + 1
  }
  const topEntry = Object.entries(trackCounts).sort((a, b) => b[1] - a[1])[0]
  const [topTrackName, topTrackArtist] = topEntry ? topEntry[0].split('|||') : ['—', '—']
  const topTrackCount = topEntry?.[1] ?? 0

  // Peak hour
  const hourCounts = Array(24).fill(0)
  for (const s of scrobbles) {
    const h = new Date(s.timestamp * 1000).getHours()
    hourCounts[h]++
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

  // Unique counts
  const uniqueTracks  = new Set(scrobbles.map(s => `${s.track}|||${s.artist}`)).size
  const uniqueArtists = new Set(scrobbles.map(s => s.artist)).size
  const uniqueAlbums  = new Set(scrobbles.filter(s => s.album).map(s => `${s.album}|||${s.artist}`)).size

  // Top album
  const albumCounts = {}
  for (const s of scrobbles) {
    if (!s.album) continue
    const key = `${s.album}|||${s.artist}`
    albumCounts[key] = (albumCounts[key] || 0) + 1
  }
  const topAlbumEntry = Object.entries(albumCounts).sort((a, b) => b[1] - a[1])[0]
  const [topAlbumName, topAlbumArtist] = topAlbumEntry ? topAlbumEntry[0].split('|||') : ['—', '—']

  return {
    total_scrobbles: scrobbles.length,
    unique_tracks:   uniqueTracks,
    unique_artists:  uniqueArtists,
    unique_albums:   uniqueAlbums,
    top_track:       topTrackName,
    top_track_artist: topTrackArtist,
    top_track_count: topTrackCount,
    top_album:       topAlbumName,
    top_album_artist: topAlbumArtist,
    peak_hour:       peakHour,
  }
}

// Format peak hour as "9am", "2pm", etc.
export function formatHour(h) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}