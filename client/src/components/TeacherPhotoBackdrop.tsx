/** Decorative backdrop behind ustaz portrait: komuz silhouette + ak kalpak motifs */
export function TeacherPhotoBackdrop() {
  const uid = "teacher-photo-bg";

  return (
    <div className="teacher-photo-backdrop" aria-hidden>
      <div className="teacher-photo-backdrop-glow" />

      <svg
        className="teacher-photo-komuz"
        viewBox="0 0 120 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M58 8c-6 0-11 4-12 10l-4 28c-14 6-24 22-28 40-5 24 2 48 16 68 6 8 14 14 24 16 1 10 8 18 18 18 10 0 18-8 18-18 0-6-2-12-8-16 14-8 22-24 26-42 4-22-4-44-20-58l-6-36c-1-6-6-10-12-10h-2zm2 22l3 32c-12 6-20 18-22 34-3 16 4 32 18 40-10 3-18 12-20 24 6-12 18-20 32-20s26 8 32 20c-2-12-10-21-20-24 14-8 21-24 18-40-2-16-10-28-22-34l3-32c4 4 6 10 5 16-1 8-6 14-12 18 3-10 3-20 0-30 4 5 6 11 5 17-1 6-5 11-10 14 4-12 4-26 0-38z"
          fill="currentColor"
        />
        <path
          d="M56 44v188M60 44v188M64 44v188"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.35"
        />
        <ellipse cx="60" cy="228" rx="22" ry="8" fill="currentColor" opacity="0.2" />
      </svg>

      <svg
        className="teacher-photo-kalpak-pattern"
        viewBox="0 0 200 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`${uid}-stripes`}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-12)"
          >
            <rect width="7" height="14" fill="currentColor" opacity="0.14" />
          </pattern>
          <pattern
            id={`${uid}-dots`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="10" r="1.2" fill="currentColor" opacity="0.18" />
          </pattern>
        </defs>

        <rect width="200" height="280" fill={`url(#${uid}-stripes)`} />
        <rect width="200" height="280" fill={`url(#${uid}-dots)`} />

        <path
          d="M20 36c24-14 52-14 76 0M148 28c18 10 28 26 30 46"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.28"
        />
        <path
          d="M28 248c32 16 68 16 100 0M156 210c12 14 12 34 0 48"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.24"
        />

        <ellipse
          cx="100"
          cy="140"
          rx="54"
          ry="62"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.22"
        />
        <ellipse
          cx="100"
          cy="140"
          rx="38"
          ry="44"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.16"
        />

        <path
          d="M72 128c10-10 24-10 34 0s24 10 34 0M64 156c14 12 32 12 46 0s32-12 46 0"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.26"
        />
        <path
          d="M88 78l12-16 12 16M88 202l12 16 12-16M100 62v24M100 194v24"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.3"
        />
        <path
          d="M100 98l8 8-8 8-8-8zM100 166l8 8-8 8-8-8z"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.24"
        />
      </svg>
    </div>
  );
}
