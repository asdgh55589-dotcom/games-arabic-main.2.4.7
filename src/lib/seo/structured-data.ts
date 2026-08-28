/**
 * structured-data.ts — JSON-LD schemas for Rich Snippets
 * يُستخدم لتحسين ظهور الموقع في نتائج بحث Google
 */

export function modJsonLd(mod: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: mod.name,
    description: mod.description || mod.summary || `تعريب ${mod.name} بالعربية`,
    applicationCategory: 'Game Mod',
    operatingSystem: mod.platform || 'Windows',
    url: `https://games-arabic.com/mod/${mod.slug}`,
    image: mod.thumbnailUrl || mod.imageUrl,
    author: {
      '@type': 'Person',
      name: mod.author?.username || 'Games Arabic',
    },
    ...(mod.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: mod.rating,
        ratingCount: mod.ratingsCount || mod.ratingCount || 0,
        bestRating: 5,
      },
    }),
    ...(mod.downloads && {
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'DownloadAction' },
        userInteractionCount: mod.downloads,
      },
    }),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    datePublished: mod.createdAt,
    dateModified: mod.updatedAt,
  }
}

export function gameJsonLd(game: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: game.description || game.tagline || `لعبة ${game.name} مع تعريبات عربية`,
    gamePlatform: game.platform,
    url: `https://games-arabic.com/games/${game.slug}`,
    image: game.imageUrl || game.thumbnailUrl || game.bannerUrl,
    author: {
      '@type': 'Organization',
      name: 'Games Arabic',
    },
    ...(game.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: game.rating,
        ratingCount: game.ratingCount || 0,
        bestRating: 5,
      },
    }),
  }
}

export function profileJsonLd(user: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: user.username,
    url: `https://games-arabic.com/profile/${user.username}`,
    image: user.avatarUrl,
    description: user.bio || `ملف ${user.username} على Games Arabic - تعريبات ونشاط وإنجازات`,
    ...(user.joinedAt && {
      memberSince: user.joinedAt,
    }),
  }
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Games Arabic',
    url: 'https://games-arabic.com',
    logo: 'https://games-arabic.com/logo.png',
    description: 'أكبر منصة عربية لتعريب الألعاب',
    sameAs: ['https://twitter.com/GamesArabic'],
  }
}
