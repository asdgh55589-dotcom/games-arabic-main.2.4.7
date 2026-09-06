export type StudioLocale = 'ar' | 'en'
export type StudioDir = 'rtl' | 'ltr'

/** Grows with each migration commit — ar.ts and en.ts must satisfy it fully. */
export interface StudioDict {
  common: {
    brand: string
    unpublishedFallback: string
  }
  switcher: {
    label: string
    arabic: string
    english: string
  }
  nav: {
    dashboard: string
    myMods: string
    stats: string
    requests: string
    comments: string
    quickCreate: string
    inbox: string
    settings: string
    help: string
    search: string
    account: string
    billing: string
    notifications: string
    logout: string
  }
  header: {
    dashboard: string
  }
  cards: {
    totalViews: string
    totalDownloads: string
    comments: string
    publishedMods: string
    upThisMonth: string
    downThisMonth: string
    viewsLast30Days: string
    upThisPeriod: string
    downThisPeriod: string
    downloadsNeedFollowUp: string
    strongEngagement: string
    commentsBeatTargets: string
    steadyPerformance: string
    meetsGrowthExpectations: string
  }
  chart: {
    title: string
    totalLast3Months: string
    last3Months: string
    last30Days: string
    last7Days: string
    pickRange: string
    views: string
    downloads: string
    visitors: string
  }
  /** Status KEYS (never display raw) + their labels. Rows carry keys. */
  status: {
    publishedKey: string
    inProgressKey: string
    published: string
    inProgress: string
    notStarted: string
  }
  table: {
    dragToReorder: string
    selectAll: string
    selectRow: string
    name: string
    sectionType: string
    status: string
    target: string
    limit: string
    reviewer: string
    assignReviewer: string
    openMenu: string
    edit: string
    duplicate: string
    favorite: string
    remove: string
    savingItem: string
    saved: string
    saveError: string
    view: string
    chooseView: string
    sections: string
    pastPerformance: string
    keyPeople: string
    featuredDocs: string
    customizeColumns: string
    columnsShort: string
    addSection: string
    noResults: string
    selectedOf: string
    selectedRows: string
    rowsPerPage: string
    page: string
    pageOf: string
    firstPage: string
    prevPage: string
    nextPage: string
    lastPage: string
    visitorsLast6Months: string
    upThisMonth52: string
    drawerLorem: string
    typeLabel: string
    chooseType: string
    chooseStatus: string
    chooseReviewer: string
    submit: string
    done: string
  }
  meta: {
    suffix: string
  }
  newModPage: {
    metaTitle: string
  }
  editModPage: {
    metaTitle: string
  }
  modsPage: {
    title: string
    metaTitle: string
  }
  commentsPage: {
    title: string
    subtitle: string
    metaTitle: string
  }
  requestsPage: {
    title: string
    subtitle: string
    metaTitle: string
  }
  settingsPage: {
    title: string
    subtitle: string
    metaTitle: string
    profile: string
    bio: string
    noBio: string
    website: string
    editProfile: string
    notifications: string
    manageNotifPrefs: string
    openNotifSettings: string
  }
  statsPage: {
    title: string
    subtitle: string
    metaTitle: string
    empty: string
    views: string
    downloads: string
    rating: string
    comments: string
  }
}
