// ─────────────────────────────────────────────────────────────
// src/news-fetcher.js
// Pulls gold/macro news from RSS feeds and filters by keywords
// ─────────────────────────────────────────────────────────────
import RSSParser from 'rss-parser'

const parser = new RSSParser()

const FEEDS = [
  'https://feeds.reuters.com/reuters/businessNews',
  'https://www.investing.com/rss/news_301.rss',   // Investing.com gold
  'https://www.forexfactory.com/rss/news',
  'https://feeds.bloomberg.com/markets/news.rss',
]

const KEYWORDS = [
  'gold', 'XAU', 'XAUUSD',
  'Federal Reserve', 'Fed', 'Powell', 'FOMC',
  'inflation', 'CPI', 'PCE', 'NFP', 'nonfarm',
  'interest rate', 'rate cut', 'rate hike',
  'dollar', 'DXY', 'USD',
  'geopolit', 'war', 'conflict', 'sanction',
  'recession', 'safe haven', 'risk off',
  'treasury', 'yield', 'bond',
]

export async function fetchRelevantNews() {
  const all = []

  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url)
      const hits = feed.items.filter(item => {
        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase()
        return KEYWORDS.some(kw => text.includes(kw.toLowerCase()))
      }).slice(0, 3)
      all.push(...hits)
    } catch (_) { /* skip failed feed silently */ }
  }

  // Sort by date descending, return top 10
  return all
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 10)
}
