const paths = {
  clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  dashboard: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z M8 14h2 M14 14h2 M8 18h2",
  chart: "M12 3a9 9 0 1 0 9 9h-9V3Z M16 3.8A9 9 0 0 1 20.2 8H16V3.8Z",
  rules: "M4 6h16 M4 18h16 M4 12h16 M8 3v6 M16 9v6 M9 15v6",
  list: "M9 5h12 M9 12h12 M9 19h12 M3 5h1 M3 12h1 M3 19h1",
  shield: "m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z m-4 9 3 3 5-6",
  sun: "M12 3V1 M12 23v-2 M3 12H1 M23 12h-2 M5.6 5.6 4.2 4.2 M19.8 19.8l-1.4-1.4 M5.6 18.4l-1.4 1.4 M19.8 4.2l-1.4 1.4 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  moon: "M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z",
  chevron: "m9 5 7 7-7 7",
  settings: "M4 6h16 M4 18h16 M4 12h16 M8 3v6 M16 9v6 M9 15v6",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  refresh: "M20 7v5h-5 M4 17v-5h5 M6.3 6.3A8 8 0 0 1 20 12 M4 12a8 8 0 0 0 13.7 5.7",
  search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>;
}
