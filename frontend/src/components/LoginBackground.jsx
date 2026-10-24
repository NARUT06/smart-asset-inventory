/* Shared decorative background for the login / 403 pages:
   blue corner waves + faint campus building illustration. */

const Waves = () => (
  <svg className="bg-waves" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M0 0 H400 C370 70 315 125 250 175 C175 233 90 268 0 330 Z" fill="#3d6fa8" opacity="0.9" />
    <path d="M0 0 H330 C300 55 255 100 200 140 C135 185 65 220 0 275 Z" fill="#7ba3d4" opacity="0.5" />
    <path d="M0 330 C95 282 175 250 252 195 C320 147 372 88 400 0" stroke="#7ba3d4" strokeWidth="1.5" fill="none" opacity="0.6" />
    <path d="M0 900 V755 C100 790 205 830 300 878 C372 914 412 958 432 1000 H0 Z" fill="#3d6fa8" opacity="0.85" />
    <path d="M0 900 V815 C90 842 180 875 262 915 C322 944 360 972 382 1000 H0 Z" fill="#7ba3d4" opacity="0.35" />
    <path d="M1440 900 V770 C1350 800 1260 840 1180 882 C1120 914 1075 958 1050 1000 H1440 Z" fill="#3d6fa8" opacity="0.85" />
    <path d="M1440 900 V820 C1360 845 1285 878 1215 918 C1160 950 1120 975 1098 1000 H1440 Z" fill="#7ba3d4" opacity="0.3" />
  </svg>
);

const CampusArt = () => (
  <svg className="campus" viewBox="0 0 640 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
    <ellipse cx="520" cy="130" rx="95" ry="38" fill="#dbe9f7" />
    <ellipse cx="435" cy="100" rx="62" ry="26" fill="#e8f1fa" />
    <ellipse cx="575" cy="170" rx="55" ry="22" fill="#e8f1fa" />

    {/* back-left building */}
    <rect x="205" y="345" width="120" height="305" rx="4" fill="#d6e5f6" stroke="#b8d0ea" strokeWidth="2" />
    <g fill="#eaf3fc" stroke="#c3d9ef" strokeWidth="1.4">
      <rect x="220" y="365" width="22" height="30" rx="2" />
      <rect x="252" y="365" width="22" height="30" rx="2" />
      <rect x="284" y="365" width="22" height="30" rx="2" />
      <rect x="220" y="410" width="22" height="30" rx="2" />
      <rect x="252" y="410" width="22" height="30" rx="2" />
      <rect x="284" y="410" width="22" height="30" rx="2" />
      <rect x="220" y="455" width="22" height="30" rx="2" />
      <rect x="252" y="455" width="22" height="30" rx="2" />
      <rect x="284" y="455" width="22" height="30" rx="2" />
    </g>

    {/* main building */}
    <rect x="330" y="270" width="235" height="380" rx="6" fill="#c3d9ef" stroke="#a8c4e3" strokeWidth="2" />
    <path d="M385 270 Q447 165 510 270 Z" fill="#b8d0ea" stroke="#a8c4e3" strokeWidth="2" />
    <rect x="437" y="185" width="20" height="55" fill="#a8c4e3" />
    <circle cx="447" cy="178" r="7" fill="#a8c4e3" />
    <g fill="#dceafa" stroke="#a8c4e3" strokeWidth="1.5">
      <rect x="350" y="300" width="30" height="38" rx="2" />
      <rect x="392" y="300" width="30" height="38" rx="2" />
      <rect x="475" y="300" width="30" height="38" rx="2" />
      <rect x="517" y="300" width="30" height="38" rx="2" />
      <rect x="350" y="352" width="30" height="38" rx="2" />
      <rect x="392" y="352" width="30" height="38" rx="2" />
      <rect x="475" y="352" width="30" height="38" rx="2" />
      <rect x="517" y="352" width="30" height="38" rx="2" />
      <rect x="350" y="404" width="30" height="38" rx="2" />
      <rect x="392" y="404" width="30" height="38" rx="2" />
      <rect x="475" y="404" width="30" height="38" rx="2" />
      <rect x="517" y="404" width="30" height="38" rx="2" />
    </g>
    <path d="M425 650 V565 Q447 538 470 565 V650 Z" fill="#a8c4e3" />

    {/* right small building */}
    <rect x="575" y="400" width="70" height="250" rx="4" fill="#d6e5f6" stroke="#b8d0ea" strokeWidth="2" />
    <g fill="#eaf3fc" stroke="#c3d9ef" strokeWidth="1.4">
      <rect x="587" y="418" width="18" height="26" rx="2" />
      <rect x="613" y="418" width="18" height="26" rx="2" />
      <rect x="587" y="458" width="18" height="26" rx="2" />
      <rect x="613" y="458" width="18" height="26" rx="2" />
      <rect x="587" y="498" width="18" height="26" rx="2" />
      <rect x="613" y="498" width="18" height="26" rx="2" />
    </g>

    {/* palm tree */}
    <path d="M130 650 Q137 560 143 495" stroke="#a8c4e3" strokeWidth="8" fill="none" strokeLinecap="round" />
    <path d="M143 495 Q110 462 78 474 Q115 488 143 512 Z" fill="#b8d0ea" />
    <path d="M143 495 Q176 458 210 468 Q172 488 145 512 Z" fill="#b8d0ea" />
    <path d="M143 495 Q140 452 158 425 Q150 465 146 502 Z" fill="#cfe0f3" />
    <path d="M143 495 Q104 506 82 534 Q115 516 140 508 Z" fill="#cfe0f3" />

    {/* ground */}
    <rect x="0" y="650" width="640" height="150" fill="#e3eefa" />
    <rect x="0" y="650" width="640" height="4" fill="#d0e1f4" />
  </svg>
);

export default function LoginBackground() {
  return (
    <div className="login-bg" aria-hidden="true">
      <Waves />
      <CampusArt />
    </div>
  );
}
