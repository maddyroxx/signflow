'use client'

import React from 'react'

interface SignFlowLogoProps {
  size?: number
  className?: string
  showText?: boolean
  withBadge?: boolean
}

export function SignFlowLogo({
  size = 40,
  className = '',
  showText = false,
  withBadge = false,
}: SignFlowLogoProps) {
  return (
    <div className={`signflow-brand-lockup ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
      <div
        className="signflow-logo-container"
        style={{
          width: size,
          height: size,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: Math.round(size * 0.28),
          background: 'linear-gradient(135deg, #6C4CE8 0%, #4B35A8 50%, #24A875 100%)',
          boxShadow: '0 4px 16px -2px rgba(108, 76, 232, 0.35), 0 2px 6px rgba(36, 168, 117, 0.2)',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
        }}
      >
        {/* Subtle glass reflection sheen */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '45%',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 100%)',
            borderTopLeftRadius: Math.round(size * 0.28),
            borderTopRightRadius: Math.round(size * 0.28),
            pointerEvents: 'none',
          }}
        />

        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Fluid Flow Wave Ribbon behind palm */}
          <path
            d="M2.5 12.8C5.2 10.5 8.5 10.2 11.5 12.5C14.5 14.8 18 15 21.5 12.2"
            stroke="#A7F3D0"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="0.5 0"
            opacity="0.9"
          />
          <path
            d="M3 16.5C5.8 14.5 9 14.4 12 16.2C15 18 18.2 18 21 15.8"
            stroke="#6EE7B7"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Expressive signing hand silhouette */}
          <path
            d="M18 11V6C18 4.89543 17.1046 4 16 4C14.8954 4 14 4.89543 14 6V10M14 6C14 4.89543 13.1046 4 12 4C10.8954 4 10 4.89543 10 6V11M10 6C10 4.89543 9.10457 4 8 4C6.89543 4 6 4.89543 6 6V13C6 16.866 9.13401 20 13 20H14C17.3137 20 20 17.3137 20 14V10C20 8.89543 19.1046 8 18 8C16.8954 8 16 8.89543 16 10"
            stroke="#FFFFFF"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Energy / Flow Pulse Dot */}
          <circle cx="19.5" cy="5.5" r="1.5" fill="#34D399" />
        </svg>
      </div>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                fontSize: `${size * 0.44}px`,
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                color: 'var(--main-text, #202238)',
              }}
            >
              SIGN
              <span
                style={{
                  background: 'linear-gradient(135deg, #6C4CE8 0%, #24A875 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                FLOW
              </span>
            </span>
            {withBadge && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--soft-green, #E8F7EF)',
                  color: 'var(--fresh-green, #24A875)',
                  letterSpacing: '0.04em',
                }}
              >
                ISL 3D
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--secondary-text, #72758A)',
              fontWeight: 500,
              marginTop: '1px',
            }}
          >
            Indian Sign Language, flowing seamlessly.
          </span>
        </div>
      )}
    </div>
  )
}
