// 프로토타입(HTML)의 사이드바 아이콘을 그대로 포팅.
const common = {
  className: "ico",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
} as const;

export const NAV_ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 14h4" />
    </svg>
  ),
  "/dashboard/products": (
    <svg {...common}>
      <path d="M20 7H4M20 7l-2 12H6L4 7M9 11h6" />
    </svg>
  ),
  "/dashboard/boxes": (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
    </svg>
  ),
  "/dashboard/destinations": (
    <svg {...common}>
      <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  "/dashboard/orders": (
    <svg {...common}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
    </svg>
  ),
  "/dashboard/history": (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 3.5" />
    </svg>
  ),
  "/dashboard/receiving": (
    <svg {...common}>
      <path d="M4 4h16v6H4zM4 14h16v6H4M8 7h4M8 17h4" />
    </svg>
  ),
  "/dashboard/stats": (
    <svg {...common}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
    </svg>
  ),
  "/dashboard/users": (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  ),
};
