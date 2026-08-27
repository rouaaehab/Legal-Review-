// Real letterhead details for The Legal Review Sdn Bhd, used to render the
// invoice and delivery order print templates. The two source documents this
// was digitised from disagreed slightly on a couple of digits (unit number,
// postcode, phone extension) — this picks one consistent version so every
// printed document uses the same letterhead regardless of which one it is.
export const COMPANY = {
  name: 'The Legal Review Sdn Bhd',
  regNo: '201101033140 (961275-P)',
  addressLines: ['No 346A, Lorong Kedah (Block C),', 'Melawati Urban 1, Taman Melawati,', '53100 Kuala Lumpur'],
  phone: '+603 4108 3150',
  fax: '+603 4108 3337',
  email: 'admin2@malaysianlawreview.com',
  tagline: 'The Definitive Alternative',
}

// Brand accent blue used for the thick bar across the top of every printed
// document and the PARTICULARS table headers — kept as one constant so
// both stay visually consistent with each other.
export const BRAND_BLUE = '#3FB6E8'

export const EDITORIAL_BOARD: { name: string; title: string }[] = [
  { name: 'YABhg Tan Sri Datuk Seri Panglima Richard Malanjum,', title: 'Former Chief Justice of Malaysia.' },
  { name: 'YABhg Tun Md Raus Sharif,', title: 'Former Chief Justice of Malaysia.' },
  { name: 'YABhg Tun Arifin Zakaria,', title: 'Former Chief Justice of Malaysia.' },
  { name: "YABhg Tan Sri Dato' Seri Zulkefli Ahmad Makinudin,", title: 'Former President of the Court of Appeal.' },
  { name: 'YBhg Emeritus Professor Datuk Dr. Shad Saleem Faruqi,', title: "Tunku Abdul Rahman's Chair Holder, Faculty of Law, UM" },
]

// "Prepared by" title shown under the preparer's name on printed documents.
export const ROLE_TITLE: Record<string, string> = {
  admin: 'Admin Executive',
  employee: 'Executive',
}

export function formatRM(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
