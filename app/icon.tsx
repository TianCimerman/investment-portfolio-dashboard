import { ImageResponse } from 'next/og'

export const size = { width: 128, height: 128 }
export const contentType = 'image/png'

/** The icon used by browser tabs and bookmarks. */
export default function Icon() {
  return new ImageResponse(<PortfolioMark />, size)
}

function PortfolioMark() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 28,
        background: '#0f1117',
      }}
    >
      <div style={{ position: 'absolute', left: 27, bottom: 27, width: 18, height: 32, borderRadius: 5, background: '#14b8a6' }} />
      <div style={{ position: 'absolute', left: 55, bottom: 27, width: 18, height: 51, borderRadius: 5, background: '#2dd4bf' }} />
      <div style={{ position: 'absolute', left: 83, bottom: 27, width: 18, height: 72, borderRadius: 5, background: '#99f6e4' }} />
      <div style={{ position: 'absolute', left: 26, top: 25, width: 75, height: 8, borderRadius: 8, background: '#f8fafc', transform: 'rotate(-37deg)', transformOrigin: 'left center' }} />
      <div style={{ position: 'absolute', right: 25, top: 17, width: 25, height: 8, borderRadius: 8, background: '#f8fafc', transform: 'rotate(45deg)', transformOrigin: 'right center' }} />
      <div style={{ position: 'absolute', right: 17, top: 25, width: 8, height: 25, borderRadius: 8, background: '#f8fafc', transform: 'rotate(45deg)', transformOrigin: 'right top' }} />
    </div>
  )
}
