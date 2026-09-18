import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** The icon used when the dashboard is saved to an iPhone or iPad home screen. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 40,
        background: '#0f1117',
      }}
    >
      <div style={{ position: 'absolute', left: 38, bottom: 38, width: 25, height: 45, borderRadius: 7, background: '#14b8a6' }} />
      <div style={{ position: 'absolute', left: 77, bottom: 38, width: 25, height: 72, borderRadius: 7, background: '#2dd4bf' }} />
      <div style={{ position: 'absolute', left: 116, bottom: 38, width: 25, height: 100, borderRadius: 7, background: '#99f6e4' }} />
      <div style={{ position: 'absolute', left: 37, top: 36, width: 106, height: 11, borderRadius: 11, background: '#f8fafc', transform: 'rotate(-37deg)', transformOrigin: 'left center' }} />
      <div style={{ position: 'absolute', right: 35, top: 24, width: 35, height: 11, borderRadius: 11, background: '#f8fafc', transform: 'rotate(45deg)', transformOrigin: 'right center' }} />
      <div style={{ position: 'absolute', right: 24, top: 35, width: 11, height: 35, borderRadius: 11, background: '#f8fafc', transform: 'rotate(45deg)', transformOrigin: 'right top' }} />
    </div>,
    size,
  )
}
