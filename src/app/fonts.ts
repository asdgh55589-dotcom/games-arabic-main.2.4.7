import localFont from 'next/font/local'

export const cairo = localFont({
  src: [
    { path: '../../public/fonts/Cairo-Light.ttf', weight: '300', style: 'normal' },
    { path: '../../public/fonts/Cairo-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Cairo-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Cairo-Bold.ttf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Cairo-ExtraBold.ttf', weight: '800', style: 'normal' },
    { path: '../../public/fonts/Cairo-Black.ttf', weight: '900', style: 'normal' },
  ],
  display: 'swap',
  preload: true,
  variable: '--font-cairo',
})
