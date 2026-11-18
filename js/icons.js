// İnce çizgili ikon seti (24×24, currentColor)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14"/><path d="M9 7h7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  moon: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  heart: '<path d="M12 20.5s-7.6-4.5-9.4-9.2C1.3 7.9 3.4 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.5 0 5.6 3.4 4.3 6.8-1.8 4.7-9.4 9.2-9.4 9.2z"/>',
  lock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  pin: '<path d="M12 21.5s7-6 7-11.5a7 7 0 0 0-14 0c0 5.5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8L16 9.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  ticket: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z"/><path d="M14.5 6v2.5M14.5 11v2M14.5 15.5V18"/>',
  flower: '<circle cx="12" cy="8" r="2.2"/><path d="M12 5.8C12 3 15.5 2.5 15 5s-3 3-3 3m0-2.2C12 3 8.5 2.5 9 5s3 3 3 3m2.2 0c2.8 0 3.3 3.5.8 3s-3-3-3-3m-2.2 0c-2.8 0-3.3 3.5-.8 3s3-3 3-3"/><path d="M12 10.5V21M12 17c-2.8 0-4.5-1.6-4.5-3.5 2.2 0 4.5 1 4.5 3.5zm0 0c2.8 0 4.5-1.6 4.5-3.5-2.2 0-4.5 1-4.5 3.5z"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 16.8v.2"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.5 5 7 4.5 7 6.5S10 8 12 8zm0 0c1.5-3 5-3.5 5-1.5S14 8 12 8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8"/><path d="M9 9.8v.2M15 9.8v.2"/>',
  jar: '<path d="M8.5 3h7v3h-7z"/><path d="M7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M12 17s-3-1.8-3-3.7c0-1 .8-1.7 1.6-1.7.6 0 1 .3 1.4.8.4-.5.8-.8 1.4-.8.8 0 1.6.7 1.6 1.7 0 1.9-3 3.7-3 3.7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  sparkle: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 15.5c.2 1.5 1 2.3 2.5 2.5-1.5.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
};
export const ic = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;

// ---------------------------------------------------------------- çiçekler
const stem = '<path d="M20 58V30" stroke="#86b892" stroke-width="2" stroke-linecap="round"/><path d="M20 47c-6.5-.5-9.5-4.5-9.5-8 5.5 0 8.5 3.5 9.5 8z" fill="#a6d1a9"/><path d="M20 41c5.5-.5 8-3.8 8-6.8-4.6 0-7.2 3-8 6.8z" fill="#b8dcb9"/>';
const SHAPES = {
  gul: `${stem}<circle cx="20" cy="21" r="10.5" fill="#e8728f"/><path d="M13.5 21a6.5 6.5 0 0 1 13 0M16 18.5a4 4 0 0 1 8 1M18.3 21.2a1.8 1.8 0 0 1 3.4 0M12 23.5c2 4 4.6 6 8 6s6-2 8-6" stroke="#b9415f" fill="none" stroke-width="1.3" stroke-linecap="round"/>`,
  lale: `${stem}<path d="M11.5 11c0 11 3.3 17 8.5 17s8.5-6 8.5-17l-4.3 4.5L20 9l-4.2 6.5z" fill="#f394b4"/><path d="M20 9l-4.2 6.5c.6 7 2 12.5 4.2 12.5" fill="#e97a9f"/>`,
  papatya: `${stem}${Array.from({ length: 10 }, (_, i) => `<ellipse cx="20" cy="11" rx="3" ry="7.2" fill="#fffdfb" stroke="#efd9e0" stroke-width=".8" transform="rotate(${i * 36} 20 20)"/>`).join('')}<circle cx="20" cy="20" r="4.4" fill="#f4c25b"/><circle cx="19" cy="19" r="1.4" fill="#f8d98f"/>`,
  lavanta: `<path d="M20 58V12" stroke="#86b892" stroke-width="2" stroke-linecap="round"/><path d="M20 50c-5 0-8-3-8-6 4 0 7 2.5 8 6z" fill="#a6d1a9"/>${[10, 15, 20, 25, 30].map((y, i) => `<ellipse cx="${17.2 + (i % 2) * .4}" cy="${y}" rx="2.6" ry="3.4" fill="${i % 2 ? '#a88bdc' : '#b9a2e6'}"/><ellipse cx="${22.8 - (i % 2) * .4}" cy="${y + 2}" rx="2.6" ry="3.4" fill="${i % 2 ? '#b9a2e6' : '#a88bdc'}"/>`).join('')}<ellipse cx="20" cy="7" rx="2.4" ry="3.2" fill="#c7b4ec"/>`,
  sakayik: `${stem}<circle cx="20" cy="21" r="12" fill="#f9c6d5"/><circle cx="14" cy="18" r="6" fill="#f7b3c8"/><circle cx="26" cy="18" r="6" fill="#f7b3c8"/><circle cx="20" cy="26" r="6.5" fill="#f5a6be"/><circle cx="20" cy="19" r="5.5" fill="#f08fae"/><circle cx="20" cy="19.5" r="2.4" fill="#e7769a"/>`,
  ortanca: `${stem}${[[14, 16], [20, 12], [26, 16], [12, 23], [20, 20], [28, 23], [16, 28], [24, 28]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><circle r="4.2" fill="${i % 3 ? '#b5c8f2' : '#c9b8ee'}"/><path d="M-2.3 0h4.6M0-2.3v4.6" stroke="#fff" stroke-width=".9" opacity=".7"/></g>`).join('')}`,
};
export const FLOWERS = [
  ['gul', 'Gül', 'Aşkla'], ['lale', 'Lale', 'Özlemle'], ['papatya', 'Papatya', 'Saf sevgiyle'],
  ['lavanta', 'Lavanta', 'Huzurla'], ['sakayik', 'Şakayık', 'Mutlulukla'], ['ortanca', 'Ortanca', 'Minnetle'],
];
export const flower = (kind, cls = '') => `<svg class="flower ${cls}" viewBox="0 0 40 60" aria-hidden="true">${SHAPES[kind] ?? SHAPES.gul}</svg>`;
