// Mesin belajar NumQuest: generator soal, SRS (SM-2), status penguasaan, penyusun sesi.
// Murni — tanpa React, tanpa DOM. Bisa diuji langsung dengan node (lihat engine.test.mjs).

const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const gcd = (a, b) => (b ? gcd(b, a % b) : a)

export const fmt = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',')
export const parseNum = (s) => Number(String(s).replace(',', '.'))
export const today = () => Math.floor(Date.now() / 86400000)
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// pilihan ganda: jawaban + pengecoh dari pola kesalahan umum, bukan angka acak
const choices = (answer, ...distractors) => {
  const set = [answer]
  for (const d of distractors) if (!set.includes(d) && d != null) set.push(d)
  if (typeof answer === 'number') {
    while (set.length < 4) {
      const c = answer + pick([-2, -1, 1, 2, 10, -10])
      if (!set.includes(c)) set.push(c)
    }
  }
  return set.slice(0, 4).sort(() => Math.random() - 0.5)
}

// icon = nama ikon Feather (lihat src/Icon.jsx)
export const DOMAINS = {
  ns: { name: 'Nalar Angka', region: 'Menara Pengawas', icon: 'radio' },
  add: { name: 'Penjumlahan', region: 'Ladang', icon: 'sun' },
  sub: { name: 'Pengurangan', region: 'Tambang', icon: 'layers' },
  mul: { name: 'Perkalian', region: 'Barak', icon: 'shield' },
  div: { name: 'Pembagian', region: 'Bengkel', icon: 'tool' },
  frac: { name: 'Pecahan', region: 'Pasar', icon: 'shopping-bag' },
  dec: { name: 'Desimal', region: 'Perbendaharaan', icon: 'lock' },
  pct: { name: 'Persen', region: 'Akademi', icon: 'book-open' },
  est: { name: 'Perkiraan', region: 'Pos Pengintai', icon: 'compass' },
  real: { name: 'Dunia Nyata', region: 'Alun-alun', icon: 'home' },
  logic: { name: 'Logika & Pola', region: 'Menara Misteri', icon: 'cpu' },
}

export const LEVELS = {
  easy: { name: 'Dasar', title: 'Pembangun Fondasi', minDays: 14 },
  mid: { name: 'Menengah', title: 'Pembangun Keahlian', minDays: 21 },
  adv: { name: 'Mahir', title: 'Penguasa Angka', minDays: 21 },
}

// ---------------------------------------------------------------------------
// Daftar keterampilan. Tiap skill: roll() -> parameter, make(params) -> soal.
// Kunci kartu SRS = `${id}:${params}` sehingga soal bisa dibangun ulang persis
// (SRS per-fakta, bukan per-skill — 7x8 dijadwalkan terpisah dari 6x9).
// ---------------------------------------------------------------------------
export const SKILLS = [
  // ---------- DASAR ----------
  {
    id: 'ns-compare', name: 'Membandingkan angka', domain: 'ns', level: 'easy',
    roll: () => { const a = r(1, 99); let b = r(1, 99); if (b === a) b++; return [a, b] },
    make: ([a, b]) => ({
      text: 'Mana yang lebih besar?', display: `${a}   atau   ${b}`, answer: Math.max(a, b),
      choices: [a, b], hint: 'Bandingkan angka paling depan (puluhan) dulu.',
      why: [`${a} punya ${String(a).length} angka, ${b} punya ${String(b).length} angka.`,
        `Lihat puluhannya: ${Math.floor(a / 10)} vs ${Math.floor(b / 10)}.`,
        `Yang lebih besar: ${Math.max(a, b)}.`],
    }),
  },
  {
    id: 'ns-place', name: 'Nilai tempat', domain: 'ns', level: 'easy',
    roll: () => [r(100, 999), r(0, 2)],
    make: ([n, p]) => {
      const nama = ['satuan', 'puluhan', 'ratusan'][p]
      const ans = Math.floor(n / 10 ** p) % 10
      return {
        text: `Berapa angka ${nama} dari ${n}?`, answer: ans, choices: choices(ans, ...String(n).split('').map(Number)),
        hint: `Hitung dari kanan: satuan, puluhan, ratusan.`,
        why: [`${n} = ${Math.floor(n / 100)} ratusan + ${Math.floor(n / 10) % 10} puluhan + ${n % 10} satuan.`,
          `Jadi angka ${nama}-nya ${ans}.`],
      }
    },
  },
  {
    id: 'ns-seq', name: 'Pola bilangan', domain: 'ns', level: 'easy',
    roll: () => [r(1, 9), pick([2, 3, 5, 10])],
    make: ([s, step]) => ({
      text: 'Lanjutkan polanya:', display: `${s}, ${s + step}, ${s + 2 * step}, ?`,
      answer: s + 3 * step, hint: `Tiap langkah naik ${step}.`,
      why: [`Selisih tiap angka: ${step}.`, `${s + 2 * step} + ${step} = ${s + 3 * step}.`],
    }),
  },
  {
    id: 'add-1d', name: 'Tambah sampai 10', domain: 'add', level: 'easy',
    roll: () => { const a = r(1, 8); return [a, r(1, 10 - a)] },
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, choices: choices(a + b, a + b + 1, a + b - 1, a * b),
      visual: { type: 'count', a, b }, hint: `Mulai dari ${a}, lalu hitung maju ${b} langkah.`,
      why: [`Ambil ${a} benda.`, `Tambahkan ${b} benda lagi.`, `Totalnya ${a + b}.`],
    }),
  },
  {
    id: 'add-20', name: 'Tambah sampai 20', domain: 'add', level: 'easy',
    roll: () => { const a = r(5, 15); return [a, r(2, 20 - a)] },
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, hint: `Genapkan ke 10 dulu: ${a} + ${10 - (a % 10 || 10)} = ${a + (10 - (a % 10 || 10))}.`,
      why: [`Pecah ${b} agar ${a} jadi bulat: ${a} + ${10 - (a % 10)} = ${a + (10 - (a % 10))}.`,
        `Sisa ${b - (10 - (a % 10))} ditambahkan.`, `Hasil: ${a + b}.`],
    }),
  },
  {
    id: 'add-doubles', name: 'Bilangan kembar', domain: 'add', level: 'easy',
    roll: () => [r(2, 12)],
    make: ([a]) => ({
      text: `${a} + ${a} = ?`, answer: a * 2, choices: choices(a * 2, a * 2 + 1, a * 2 - 2, a * 2 + 2),
      hint: 'Dobel = kali dua.', why: [`${a} dua kali = ${a} × 2 = ${a * 2}.`],
    }),
  },
  {
    id: 'add-10', name: 'Tambah puluhan', domain: 'add', level: 'easy',
    roll: () => [r(11, 89), pick([10, 20, 30])],
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, hint: 'Satuannya tidak berubah, cukup tambah puluhannya.',
      why: [`Satuan ${a % 10} tetap.`, `Puluhan: ${Math.floor(a / 10)} + ${b / 10} = ${Math.floor(a / 10) + b / 10}.`, `Hasil: ${a + b}.`],
    }),
  },
  {
    id: 'sub-1d', name: 'Kurang sampai 10', domain: 'sub', level: 'easy',
    roll: () => { const a = r(3, 10); return [a, r(1, a)] },
    make: ([a, b]) => ({
      text: `${a} − ${b} = ?`, answer: a - b, choices: choices(a - b, a - b + 1, a - b - 1, a + b),
      visual: { type: 'count', a, b: -b }, hint: `Mulai dari ${a}, mundur ${b} langkah.`,
      why: [`Ambil ${a} benda.`, `Buang ${b} benda.`, `Sisa ${a - b}.`],
    }),
  },
  {
    id: 'sub-20', name: 'Kurang sampai 20', domain: 'sub', level: 'easy',
    roll: () => { const a = r(11, 20); return [a, r(2, a - 1)] },
    make: ([a, b]) => ({
      text: `${a} − ${b} = ?`, answer: a - b, hint: `Turun ke 10 dulu: ${a} − ${a - 10} = 10.`,
      why: [`${a} − ${a - 10} = 10.`, `Sisa dikurangi ${b - (a - 10)}.`, `Hasil: ${a - b}.`],
    }),
  },
  {
    id: 'mul-concept', name: 'Arti perkalian', domain: 'mul', level: 'easy',
    roll: () => [r(2, 5), r(2, 5)],
    make: ([g, p]) => ({
      text: `${g} kelompok, tiap kelompok berisi ${p}. Berapa totalnya?`, answer: g * p,
      choices: choices(g * p, g + p, g * p + p, g * p - p), visual: { type: 'groups', g, p },
      hint: `Sama dengan ${Array(g).fill(p).join(' + ')}.`,
      why: [`Perkalian = penjumlahan berulang.`, `${Array(g).fill(p).join(' + ')} = ${g * p}.`, `Jadi ${g} × ${p} = ${g * p}.`],
    }),
  },
  {
    id: 'mul-easy', name: 'Kali 1, 2, 5, 10', domain: 'mul', level: 'easy',
    roll: () => [r(2, 10), pick([1, 2, 5, 10])],
    make: ([a, b]) => ({
      text: `${a} × ${b} = ?`, answer: a * b, hint: b === 5 ? 'Kali 10 lalu bagi 2.' : b === 2 ? 'Sama dengan dobel.' : 'Tambahkan nol / tetap sama.',
      why: b === 5 ? [`${a} × 10 = ${a * 10}.`, `Bagi 2: ${a * 5}.`] : [`${a} × ${b} = ${a * b}.`],
    }),
  },
  {
    id: 'div-concept', name: 'Arti pembagian', domain: 'div', level: 'easy',
    roll: () => [r(2, 5), r(2, 6)],
    make: ([g, p]) => ({
      text: `${g * p} kue dibagi rata ke ${g} orang. Tiap orang dapat berapa?`, answer: p,
      choices: choices(p, p + 1, g, g * p), visual: { type: 'groups', g, p },
      hint: `Cari angka yang jika dikali ${g} hasilnya ${g * p}.`,
      why: [`Bagi rata = kelompokkan.`, `${g} × ? = ${g * p}`, `? = ${p}.`],
    }),
  },
  {
    id: 'div-easy', name: 'Bagi 1, 2, 5, 10', domain: 'div', level: 'easy',
    roll: () => [pick([2, 5, 10]), r(2, 10)],
    make: ([b, q]) => ({
      text: `${b * q} : ${b} = ?`, answer: q, hint: `Pikirkan: ${b} × ? = ${b * q}.`,
      why: [`Pembagian kebalikan perkalian.`, `${b} × ${q} = ${b * q}, jadi jawabannya ${q}.`],
    }),
  },
  {
    id: 'est-round10', name: 'Bulatkan ke puluhan', domain: 'est', level: 'easy',
    roll: () => [r(11, 99)],
    make: ([n]) => {
      const ans = Math.round(n / 10) * 10
      return {
        text: `${n} dibulatkan ke puluhan terdekat = ?`, answer: ans,
        choices: choices(ans, ans + 10, ans - 10, Math.floor(n / 10) * 10 + 5),
        hint: 'Satuan 5 ke atas dibulatkan naik.',
        why: [`Satuannya ${n % 10}.`, `${n % 10} ${n % 10 >= 5 ? '≥ 5 → naik' : '< 5 → turun'}.`, `Hasil: ${ans}.`],
      }
    },
  },

  // ---------- MENENGAH ----------
  {
    id: 'add-2d', name: 'Tambah 2 angka (tanpa simpan)', domain: 'add', level: 'mid',
    roll: () => {
      const a = r(11, 69)
      const maxTens = 8 - Math.floor(a / 10)  // puluhan b max, agar jumlah puluhan ≤ 9
      const maxOnes = 9 - (a % 10)            // satuan b max, agar jumlah satuan ≤ 9
      const bTens = maxTens > 0 ? r(1, maxTens) : 0
      const bOnes = maxOnes > 0 ? r(0, maxOnes) : 0
      const b = Math.max(10, bTens * 10 + bOnes)
      return [a, b]
    },
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, hint: 'Jumlahkan puluhan dulu, lalu satuan.',
      why: [`Puluhan: ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10} = ${Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10}.`,
        `Satuan: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.`, `Total: ${a + b}.`],
    }),
  },
  {
    id: 'add-2d-carry', name: 'Tambah 2 angka (menyimpan)', domain: 'add', level: 'mid',
    roll: () => { const a = r(15, 89); const b = r(15, 89); return [a, (a % 10) + (b % 10) < 10 ? b + (10 - ((a % 10) + (b % 10))) : b] },
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, hint: `Satuan: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)} → simpan 1 ke puluhan.`,
      why: [`Satuan: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}. Tulis ${((a % 10) + (b % 10)) % 10}, simpan 1.`,
        `Puluhan: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} + 1 = ${Math.floor(a / 10) + Math.floor(b / 10) + 1}.`,
        `Hasil: ${a + b}.`],
    }),
  },
  {
    id: 'add-3d', name: 'Tambah 3 angka', domain: 'add', level: 'mid',
    roll: () => [r(105, 899), r(105, 899)],
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, hint: 'Pecah: ratusan + puluhan + satuan.',
      why: [`${a} + ${b - (b % 100)} = ${a + b - (b % 100)}.`, `Lalu + ${b % 100} = ${a + b}.`],
    }),
  },
  {
    id: 'sub-2d', name: 'Kurang 2 angka', domain: 'sub', level: 'mid',
    roll: () => { const a = r(30, 99); return [a, r(10, a - 10)] },
    make: ([a, b]) => ({
      text: `${a} − ${b} = ?`, answer: a - b, hint: 'Kurangi puluhannya dulu.',
      why: [`${a} − ${Math.floor(b / 10) * 10} = ${a - Math.floor(b / 10) * 10}.`, `Lalu − ${b % 10} = ${a - b}.`],
    }),
  },
  {
    id: 'sub-2d-borrow', name: 'Kurang dengan meminjam', domain: 'sub', level: 'mid',
    roll: () => { let a = r(30, 98); if (a % 10 >= 8) a -= (a % 10 - 7); let b = r(10, a - 5); if (b % 10 <= a % 10) b = b - (b % 10) + Math.min(9, (a % 10) + r(1, 4)); return [a, Math.min(b, a - 1)] },
    make: ([a, b]) => ({
      text: `${a} − ${b} = ?`, answer: a - b, hint: `Satuan ${a % 10} lebih kecil dari ${b % 10} → pinjam 1 puluhan.`,
      why: [`Pinjam: ${a % 10} jadi ${(a % 10) + 10}.`, `${(a % 10) + 10} − ${b % 10} = ${(a % 10) + 10 - (b % 10)}.`,
        `Puluhan: ${Math.floor(a / 10) - 1} − ${Math.floor(b / 10)} = ${Math.floor(a / 10) - 1 - Math.floor(b / 10)}.`, `Hasil: ${a - b}.`],
    }),
  },
  {
    id: 'sub-3d', name: 'Kurang 3 angka', domain: 'sub', level: 'mid',
    roll: () => { const a = r(200, 950); return [a, r(105, a - 20)] },
    make: ([a, b]) => ({
      text: `${a} − ${b} = ?`, answer: a - b, hint: 'Bulatkan pengurangnya, lalu koreksi.',
      why: [`${a} − ${Math.round(b / 100) * 100} = ${a - Math.round(b / 100) * 100}.`,
        `Koreksi ${Math.round(b / 100) * 100 - b >= 0 ? '+' : '−'} ${Math.abs(Math.round(b / 100) * 100 - b)}.`, `Hasil: ${a - b}.`],
    }),
  },
  {
    id: 'mul-tables', name: 'Perkalian 3–12', domain: 'mul', level: 'mid',
    roll: () => [pick([3, 4, 6, 7, 8, 9, 11, 12]), r(2, 12)],
    make: ([a, b]) => ({
      text: `${a} × ${b} = ?`, answer: a * b,
      hint: a === 9 ? `Kali 10 lalu kurangi ${b}: ${10 * b} − ${b}.` : a === 4 ? 'Dobel dua kali.' : `${a - 1} × ${b} = ${(a - 1) * b}, tambah ${b}.`,
      why: a === 9 ? [`${b} × 10 = ${b * 10}.`, `Kurangi ${b}: ${b * 9}.`]
        : [`${a - 1} × ${b} = ${(a - 1) * b}.`, `Tambah satu ${b}: ${a * b}.`],
    }),
  },
  {
    id: 'mul-2dx1d', name: 'Kali 2 angka × 1 angka', domain: 'mul', level: 'mid',
    roll: () => [r(12, 49), r(3, 9)],
    make: ([a, b]) => ({
      text: `${a} × ${b} = ?`, answer: a * b, hint: `Pecah: (${Math.floor(a / 10) * 10} × ${b}) + (${a % 10} × ${b}).`,
      why: [`${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b}.`,
        `${a % 10} × ${b} = ${(a % 10) * b}.`, `Jumlahkan: ${a * b}.`],
    }),
  },
  {
    id: 'div-facts', name: 'Fakta pembagian', domain: 'div', level: 'mid',
    roll: () => [r(3, 12), r(2, 12)],
    make: ([b, q]) => ({
      text: `${b * q} : ${b} = ?`, answer: q, hint: `${b} × ? = ${b * q}.`,
      why: [`Kebalikan perkalian: ${b} × ${q} = ${b * q}.`, `Jadi ${b * q} : ${b} = ${q}.`],
    }),
  },
  {
    id: 'div-rem', name: 'Sisa pembagian', domain: 'div', level: 'mid',
    roll: () => { const b = r(3, 9); return [b, r(2, 9) * b + r(1, b - 1)] },
    make: ([b, a]) => ({
      text: `Berapa sisa dari ${a} : ${b}?`, answer: a % b, choices: choices(a % b, (a % b) + 1, b - (a % b), 0),
      hint: `Kelipatan ${b} terdekat di bawah ${a} adalah ${Math.floor(a / b) * b}.`,
      why: [`${b} × ${Math.floor(a / b)} = ${Math.floor(a / b) * b}.`, `${a} − ${Math.floor(a / b) * b} = ${a % b}.`],
    }),
  },
  {
    id: 'frac-compare', name: 'Bandingkan pecahan', domain: 'frac', level: 'mid',
    roll: () => [r(1, 5), r(2, 8), r(1, 5), r(2, 8)],
    make: ([a, b, c, d]) => {
      const [n1, d1] = [Math.min(a, b - 1) || 1, b]
      let [n2, d2] = [Math.min(c, d - 1) || 1, d]
      if (n1 / d1 === n2 / d2) d2 = d2 + 1 // dua pecahan harus beda nilai
      const big = n1 / d1 > n2 / d2 ? `${n1}/${d1}` : `${n2}/${d2}`
      return {
        text: 'Mana yang lebih besar?', display: `${n1}/${d1}   atau   ${n2}/${d2}`, answer: big,
        choices: [`${n1}/${d1}`, `${n2}/${d2}`], hint: 'Samakan penyebut, atau bandingkan dengan 1/2.',
        why: [`${n1}/${d1} = ${fmt(Math.round((n1 / d1) * 100) / 100)}`, `${n2}/${d2} = ${fmt(Math.round((n2 / d2) * 100) / 100)}`, `Lebih besar: ${big}.`],
      }
    },
  },
  {
    id: 'frac-add-same', name: 'Tambah pecahan sepenyebut', domain: 'frac', level: 'mid',
    roll: () => { const d = r(4, 10); return [r(1, d - 2), r(1, d - 2), d] },
    make: ([a, b, d]) => ({
      text: `${a}/${d} + ${b}/${d} = ?/${d}`, answer: a + b, choices: choices(a + b, a + b + 1, a * b, a + b + d),
      hint: 'Penyebut sama → cukup jumlahkan pembilangnya.',
      why: [`Penyebut tetap ${d}.`, `${a} + ${b} = ${a + b}.`, `Hasil: ${a + b}/${d}.`],
    }),
  },
  {
    id: 'dec-add', name: 'Tambah desimal', domain: 'dec', level: 'mid',
    roll: () => [r(11, 99), r(11, 99)],
    make: ([a, b]) => ({
      text: `${fmt(a / 10)} + ${fmt(b / 10)} = ?`, answer: (a + b) / 10, hint: 'Sejajarkan komanya.',
      why: [`Anggap ${a} + ${b} = ${a + b}.`, `Kembalikan satu angka di belakang koma: ${fmt((a + b) / 10)}.`],
    }),
  },
  {
    id: 'est-round100', name: 'Bulatkan ke ratusan', domain: 'est', level: 'mid',
    roll: () => [r(120, 990)],
    make: ([n]) => {
      const ans = Math.round(n / 100) * 100
      return {
        text: `${n} dibulatkan ke ratusan terdekat = ?`, answer: ans, choices: choices(ans, ans + 100, ans - 100, Math.round(n / 10) * 10),
        hint: 'Lihat angka puluhannya.',
        why: [`Puluhannya ${Math.floor(n / 10) % 10}.`, `${Math.floor(n / 10) % 10 >= 5 ? 'Naik' : 'Turun'} → ${ans}.`],
      }
    },
  },
  {
    id: 'money-change', name: 'Menghitung kembalian', domain: 'real', level: 'mid',
    roll: () => [pick([50, 100, 20]), r(11, 19)],
    make: ([pay, k]) => {
      const cost = k * 1000, bayar = pay * 1000
      return {
        text: `Belanja Rp${cost.toLocaleString('id-ID')}, bayar Rp${bayar.toLocaleString('id-ID')}. Kembaliannya berapa ribu?`,
        answer: pay - k, hint: `Hitung maju dari ${k} ke ${pay}.`,
        why: [`${pay} − ${k} = ${pay - k}.`, `Kembalian Rp${((pay - k) * 1000).toLocaleString('id-ID')}.`],
      }
    },
  },

  // ---------- MAHIR ----------
  {
    id: 'mul-2dx2d', name: 'Kali 2 angka × 2 angka', domain: 'mul', level: 'adv',
    roll: () => [r(12, 49), r(12, 39)],
    make: ([a, b]) => ({
      text: `${a} × ${b} = ?`, answer: a * b, hint: `Pecah ${b} jadi ${Math.floor(b / 10) * 10} + ${b % 10}.`,
      why: [`${a} × ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}.`,
        `${a} × ${b % 10} = ${a * (b % 10)}.`, `Jumlahkan: ${a * b}.`],
    }),
  },
  {
    id: 'div-2d', name: 'Bagi dengan 2 angka', domain: 'div', level: 'adv',
    roll: () => [r(11, 25), r(3, 19)],
    make: ([b, q]) => ({
      text: `${b * q} : ${b} = ?`, answer: q, hint: `Perkirakan dulu: ${b} × 10 = ${b * 10}.`,
      why: [`${b} × 10 = ${b * 10}.`, `Sisa ${b * q - b * 10} : ${b} = ${q - 10}.`, `Total ${q}.`],
    }),
  },
  {
    id: 'frac-add-diff', name: 'Tambah pecahan beda penyebut', domain: 'frac', level: 'adv',
    roll: () => [pick([2, 3, 4]), pick([3, 5, 6]), r(1, 2)],
    make: ([d1, d2, n1]) => {
      const num = n1 * d2 + 1 * d1, den = d1 * d2, g = gcd(num, den)
      const ans = `${num / g}/${den / g}`
      return {
        text: `${n1}/${d1} + 1/${d2} = ?`, answer: ans,
        choices: [ans, `${n1 + 1}/${d1 + d2}`, `${num}/${den + 1}`, `${num + 1}/${den}`].filter((v, i, s) => s.indexOf(v) === i).sort(() => Math.random() - 0.5),
        hint: `Samakan penyebut ke ${den}.`,
        why: [`Penyebut sama: ${den}.`, `${n1}/${d1} = ${n1 * d2}/${den}, 1/${d2} = ${d1}/${den}.`, `Jumlah: ${num}/${den} = ${ans}.`],
      }
    },
  },
  {
    id: 'frac-mul', name: 'Kali pecahan', domain: 'frac', level: 'adv',
    roll: () => [r(1, 4), r(2, 6), r(1, 4), r(2, 6)],
    make: ([a, b, c, d]) => {
      const num = a * c, den = b * d, g = gcd(num, den)
      const ans = `${num / g}/${den / g}`
      return {
        text: `${a}/${b} × ${c}/${d} = ?`, answer: ans,
        choices: [ans, `${num}/${den}`, `${a + c}/${b + d}`, `${a * d}/${b * c}`].filter((v, i, s) => s.indexOf(v) === i).sort(() => Math.random() - 0.5),
        hint: 'Kalikan atas dengan atas, bawah dengan bawah.',
        why: [`Pembilang: ${a} × ${c} = ${num}.`, `Penyebut: ${b} × ${d} = ${den}.`, `Sederhanakan: ${ans}.`],
      }
    },
  },
  {
    id: 'dec-mul', name: 'Kali desimal', domain: 'dec', level: 'adv',
    roll: () => [r(11, 99), r(2, 9)],
    make: ([a, b]) => ({
      text: `${fmt(a / 10)} × ${b} = ?`, answer: (a * b) / 10, hint: 'Abaikan koma dulu, pasang lagi di akhir.',
      why: [`${a} × ${b} = ${a * b}.`, `Ada 1 angka di belakang koma → ${fmt((a * b) / 10)}.`],
    }),
  },
  {
    id: 'pct-of', name: 'Persen dari angka', domain: 'pct', level: 'adv',
    roll: () => [pick([5, 10, 20, 25, 50]), r(4, 40) * 10],
    make: ([p, n]) => ({
      text: `${p}% dari ${n} = ?`, answer: (n * p) / 100,
      hint: p === 10 ? 'Bagi 10.' : p === 50 ? 'Bagi 2.' : p === 25 ? 'Bagi 4.' : `10% = ${n / 10}, lalu sesuaikan.`,
      why: [`10% dari ${n} = ${n / 10}.`, `${p}% = ${p / 10} × 10% = ${(n * p) / 100}.`],
    }),
  },
  {
    id: 'pct-change', name: 'Naik / turun persen', domain: 'pct', level: 'adv',
    roll: () => [r(4, 40) * 10, pick([10, 20, 25, 50]), r(0, 1)],
    make: ([n, p, up]) => {
      const delta = (n * p) / 100
      const ans = up ? n + delta : n - delta
      return {
        text: `${n} ${up ? 'naik' : 'turun'} ${p}% menjadi ?`, answer: ans, hint: `${p}% dari ${n} = ${delta}.`,
        why: [`${p}% dari ${n} = ${delta}.`, `${n} ${up ? '+' : '−'} ${delta} = ${ans}.`],
      }
    },
  },
  {
    id: 'pct-tip', name: 'Diskon & pajak', domain: 'real', level: 'adv',
    roll: () => [r(8, 40) * 5, pick([10, 20, 30])],
    make: ([k, p]) => {
      const harga = k * 1000, ans = k - (k * p) / 100
      return {
        text: `Harga Rp${harga.toLocaleString('id-ID')} diskon ${p}%. Bayar berapa ribu?`, answer: ans,
        hint: `Diskon ${p}% berarti bayar ${100 - p}%.`,
        why: [`Diskon: ${p}% × ${k} = ${(k * p) / 100}.`, `Bayar: ${k} − ${(k * p) / 100} = ${ans} ribu.`],
      }
    },
  },
  {
    id: 'mental-comp', name: 'Strategi kompensasi', domain: 'est', level: 'adv',
    roll: () => [r(30, 90), pick([19, 29, 39, 49])],
    make: ([a, b]) => ({
      text: `${a} + ${b} = ?`, answer: a + b, hint: `Anggap ${b + 1}, lalu kurangi 1.`,
      why: [`${a} + ${b + 1} = ${a + b + 1}.`, `Kurangi 1: ${a + b}.`],
    }),
  },
  {
    id: 'est-multi', name: 'Perkiraan bertingkat', domain: 'est', level: 'adv',
    roll: () => [r(18, 49), r(18, 49)],
    make: ([a, b]) => {
      const exact = a * b, ans = Math.round(exact / 100) * 100
      return {
        text: `Kira-kira ${a} × ${b} paling dekat ke?`, answer: ans,
        choices: choices(ans, ans + 200, ans - 200, ans + 500), hint: 'Bulatkan kedua angka dulu.',
        why: [`≈ ${Math.round(a / 10) * 10} × ${Math.round(b / 10) * 10} = ${Math.round(a / 10) * 10 * Math.round(b / 10) * 10}.`,
          `Nilai sebenarnya ${exact} → paling dekat ${ans}.`],
      }
    },
  },
  {
    id: 'word-budget', name: 'Soal cerita anggaran', domain: 'real', level: 'adv',
    roll: () => { const n = r(3,6); const h = r(10,30); return [n, h, n * h + r(10, 200)] },
    make: ([n, harga, budget]) => ({
      text: `Kamu punya Rp${(budget * 1000).toLocaleString('id-ID')}. Beli ${n} barang seharga Rp${(harga * 1000).toLocaleString('id-ID')} per barang. Sisa berapa ribu?`,
      answer: budget - n * harga, hint: `Total belanja: ${n} × ${harga}.`,
      why: [`${n} × ${harga} = ${n * harga} ribu.`, `${budget} − ${n * harga} = ${budget - n * harga} ribu.`],
    }),
  },

  // ---------- ragam tambahan ----------
  {
    id: 'ns-count-back', name: 'Menghitung mundur', domain: 'ns', level: 'easy',
    roll: () => [r(20, 60), pick([2, 3, 5, 10])],
    make: ([s, step]) => ({
      text: 'Lanjutkan mundur:', display: `${s}, ${s - step}, ${s - 2 * step}, ?`,
      answer: s - 3 * step, hint: `Tiap langkah turun ${step}.`,
      why: [`Selisihnya ${step}, arahnya turun.`, `${s - 2 * step} − ${step} = ${s - 3 * step}.`],
    }),
  },
  {
    id: 'word-easy', name: 'Soal cerita sederhana', domain: 'real', level: 'easy',
    roll: () => [r(3, 9), r(2, 8), r(0, 1)],
    make: ([a, b, plus]) => ({
      text: plus
        ? `Di dompetmu ada ${a} lembar uang. Kamu dapat ${b} lembar lagi. Sekarang ada berapa?`
        : `Kamu punya ${a + b} kursi. ${b} kursi dipakai. Berapa kursi kosong?`,
      answer: plus ? a + b : a, choices: choices(plus ? a + b : a, a + b + 1, Math.abs(a - b), a * b),
      hint: plus ? 'Bertambah berarti dijumlah.' : 'Dipakai berarti dikurangi.',
      why: plus ? [`${a} + ${b} = ${a + b}.`] : [`${a + b} − ${b} = ${a}.`],
    }),
  },
  {
    id: 'est-about', name: 'Kira-kira berapa', domain: 'est', level: 'easy',
    roll: () => [r(12, 48), r(12, 48)],
    make: ([a, b]) => {
      const ans = Math.round((a + b) / 10) * 10
      return {
        text: `Kira-kira ${a} + ${b} paling dekat ke?`, answer: ans,
        choices: choices(ans, ans + 20, ans - 20, ans + 10), hint: 'Bulatkan dulu ke puluhan terdekat.',
        why: [`≈ ${Math.round(a / 10) * 10} + ${Math.round(b / 10) * 10} = ${Math.round(a / 10) * 10 + Math.round(b / 10) * 10}.`,
          `Nilai sebenarnya ${a + b} → paling dekat ${ans}.`],
      }
    },
  },
  {
    id: 'frac-of-number', name: 'Pecahan dari angka', domain: 'frac', level: 'mid',
    roll: () => [pick([2, 3, 4, 5]), r(3, 12)],
    make: ([d, q]) => ({
      text: `1/${d} dari ${d * q} = ?`, answer: q, hint: `Bagi ${d * q} dengan ${d}.`,
      why: [`1/${d} artinya dibagi ${d}.`, `${d * q} : ${d} = ${q}.`],
    }),
  },
  {
    id: 'time-calc', name: 'Menghitung waktu', domain: 'real', level: 'mid',
    roll: () => [r(6, 19), pick([0, 15, 30, 45]), r(1, 3), pick([15, 30, 45])],
    make: ([h, m, dh, dm]) => {
      const tot = h * 60 + m + dh * 60 + dm
      const jam = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}.${String(x % 60).padStart(2, '0')}`
      const ans = jam(tot)
      return {
        text: `Berangkat jam ${jam(h * 60 + m)}, perjalanan ${dh} jam ${dm} menit. Sampai jam berapa?`,
        answer: ans,
        choices: [ans, jam(tot + 60), jam(tot - 60), jam(tot + 15)].filter((v, i, s) => s.indexOf(v) === i),
        hint: `Tambah ${dh} jam dulu, baru ${dm} menit.`,
        why: [`${jam(h * 60 + m)} + ${dh} jam = ${jam(h * 60 + m + dh * 60)}.`, `+ ${dm} menit = ${ans}.`],
      }
    },
  },
  {
    id: 'word-mid', name: 'Soal cerita belanja', domain: 'real', level: 'mid',
    roll: () => [r(3, 9), r(4, 15), r(2, 6)],
    make: ([n, harga, extra]) => ({
      text: `Beli ${n} barang seharga Rp${(harga * 1000).toLocaleString('id-ID')} per barang, ditambah ongkir Rp${(extra * 1000).toLocaleString('id-ID')}. Total berapa ribu?`,
      answer: n * harga + extra, hint: `Hitung ${n} × ${harga} dulu, baru tambah ongkir.`,
      why: [`${n} × ${harga} = ${n * harga}.`, `${n * harga} + ${extra} = ${n * harga + extra} ribu.`],
    }),
  },
  {
    id: 'dec-div', name: 'Bagi desimal', domain: 'dec', level: 'adv',
    roll: () => [r(2, 9), r(11, 60)],
    make: ([b, a]) => ({
      text: `${fmt((a * b) / 10)} : ${b} = ?`, answer: a / 10, hint: 'Abaikan koma, bagi, lalu pasang koma lagi.',
      why: [`${a * b} : ${b} = ${a}.`, `Ada 1 angka di belakang koma → ${fmt(a / 10)}.`],
    }),
  },
  {
    id: 'frac-div', name: 'Bagi pecahan', domain: 'frac', level: 'adv',
    roll: () => [r(1, 4), r(2, 6), r(1, 4), r(2, 6)],
    make: ([a, b, c, d]) => {
      const num = a * d, den = b * c, gg = gcd(num, den)
      const ans = `${num / gg}/${den / gg}`
      return {
        text: `${a}/${b} : ${c}/${d} = ?`, answer: ans,
        choices: [ans, `${a * c}/${b * d}`, `${num}/${den}`, `${a + c}/${b + d}`].filter((v, i, s) => s.indexOf(v) === i).sort(() => Math.random() - 0.5),
        hint: 'Bagi pecahan = kali kebalikannya.',
        why: [`Balik yang kedua: ${c}/${d} jadi ${d}/${c}.`, `${a}/${b} × ${d}/${c} = ${num}/${den}.`, `Sederhanakan: ${ans}.`],
      }
    },
  },
  {
    id: 'pct-reverse', name: 'Mencari angka asal', domain: 'pct', level: 'adv',
    roll: () => [pick([10, 20, 25, 50]), r(2, 20)],
    make: ([p, k]) => {
      const total = (k * 100) / p
      return {
        text: `${p}% dari sebuah angka adalah ${k}. Angka itu berapa?`, answer: total,
        hint: `Kalau ${p}% = ${k}, maka 100% = ${k} × ${100 / p}.`,
        why: [`${p}% = ${k}.`, `100% = ${k} × ${100 / p} = ${total}.`],
      }
    },
  },
  {
    id: 'unit-price', name: 'Harga satuan', domain: 'real', level: 'adv',
    roll: () => [r(2, 8), r(3, 15)],
    make: ([n, per]) => ({
      text: `${n} barang harganya Rp${(n * per * 1000).toLocaleString('id-ID')}. Harga satuannya berapa ribu?`,
      answer: per, hint: `Bagi total dengan ${n}.`,
      why: [`${n * per} : ${n} = ${per}.`, `Harga satuan Rp${(per * 1000).toLocaleString('id-ID')}.`],
    }),
  },
  {
    id: 'ratio', name: 'Perbandingan', domain: 'est', level: 'adv',
    roll: () => [r(1, 4), r(2, 6), r(2, 9)],
    make: ([a, b, k]) => {
      const total = (a + b) * k
      return {
        text: `Uang Rp${(total * 1000).toLocaleString('id-ID')} dibagi dengan perbandingan ${a} : ${b}. Bagian yang kecil berapa ribu?`,
        answer: Math.min(a, b) * k, hint: `Total bagian = ${a} + ${b} = ${a + b}.`,
        why: [`${a + b} bagian = ${total}.`, `1 bagian = ${k}.`, `Bagian kecil = ${Math.min(a, b)} × ${k} = ${Math.min(a, b) * k}.`],
      }
    },
  },

  // ---------- Trik hitung cepat (bikin nagih!) ----------
  {
    id: 'trick-mul11', name: 'Triks kilat ×11', domain: 'mul', level: 'mid',
    roll: () => [r(12, 89)],
    make: ([n]) => {
      const ans = n * 11
      return {
        text: `${n} × 11 = ? (coba hitung cepat!)`, answer: ans,
        hint: `Pisahin ${String(n)[0]} dan ${String(n)[1]}, tengahnya jumlahin: ${String(n)[0]}+${String(n)[1]}=${Number(String(n)[0]) + Number(String(n)[1])}.`,
        why: [`${String(n)[0]} + ${String(n)[1]} = ${Number(String(n)[0]) + Number(String(n)[1])}.`, `Hasil: ${String(n)[0]}${Number(String(n)[0]) + Number(String(n)[1])}${String(n)[1]} = ${ans}${n % 10 >= 2 && Number(String(n)[0]) + Number(String(n)[1]) >= 10 ? ' (simpan 1 ke depan)' : ''}.`],
      }
    },
  },
  {
    id: 'trick-sq5', name: 'Kuadrat ujung 5', domain: 'mul', level: 'mid',
    roll: () => [r(1, 9)],
    make: ([a]) => {
      const n = a * 10 + 5, ans = n * n
      return {
        text: `${n}² = ? (ada triknya lho)`, answer: ans,
        hint: `Puluhan × (puluhan+1) = ${a}×${a + 1}=${a * (a + 1)}, lalu tempel 25.`,
        why: [`${a} × ${a + 1} = ${a * (a + 1)}.`, `Tempelkan 25 di belakang → ${ans}.`, `Trik ini selalu berhasil untuk angka akhiran 5!`],
      }
    },
  },
  {
    id: 'trick-mul9', name: 'Pola jari ×9', domain: 'mul', level: 'easy',
    roll: () => [r(2, 9)],
    make: ([b]) => ({
      text: `9 × ${b} = ?`, answer: 9 * b,
      hint: `Tekuk jari ke-${b}. Kiri = puluhan, kanan = satuan.`,
      why: [`Jari kiri yang tertekuk: ${b - 1} → puluhan.`, `Jari kanan: ${10 - b} → satuan.`, `Hasil: ${9 * b}.`],
    }),
  },
  {
    id: 'num-riddle', name: 'Tebak angkaku', domain: 'ns', level: 'mid',
    roll: () => {
      const n = r(5, 30)
      const ops = [
        { desc: `dikali 2 lalu ditambah 4 hasilnya ${n * 2 + 4}`, ans: n, rev: (x) => (x * 2 + 4) },
        { desc: `dikali 3 lalu dikurang 6 hasilnya ${n * 3 - 6}`, ans: n, rev: (x) => (x * 3 - 6) },
        { desc: `ditambah 8 lalu dikali 2 hasilnya ${(n + 8) * 2}`, ans: n, rev: (x) => ((x + 8) * 2) },
        { desc: `dikurang 5 lalu dikali 4 hasilnya ${(n - 5) * 4}`, ans: n, rev: (x) => ((x - 5) * 4) },
      ]
      return [pick(ops)]
    },
    make: ([op]) => ({
      text: `Aku mikirin sebuah angka. Kalau ${op.desc}. Angka berapa itu?`, answer: op.ans,
      hint: 'Kerjakan kebalikannya (invers). Mulai dari hasil akhir, balik langkahnya.',
      why: [`Balik langkah terakhir dulu.`, `Lalu balik langkah pertama.`, `Angkaku: ${op.ans}. Cek: ${op.desc.replace('hasilnya', '= ' + op.rev(op.ans))}. ✓`],
    }),
  },
  {
    id: 'order-ops', name: 'Urutan hitung', domain: 'est', level: 'adv',
    roll: () => {
      const a = r(2, 9), b = r(2, 5), c = r(3, 8)
      const ans = a + b * c
      return [a, b, c]
    },
    make: ([a, b, c]) => ({
      text: `${a} + ${b} × ${c} = ? (hati-hati urutannya!)`, answer: a + b * c,
      choices: choices(a + b * c, (a + b) * c, a * (b + c), a + b + c),
      hint: 'Kali dulu, baru tambah! Perkalian lebih kuat dari penjumlahan.',
      why: [`${b} × ${c} = ${b * c} (kerjakan dulu).`, `Lalu ${a} + ${b * c} = ${a + b * c}.`, `Kalau asal kiri-ke-kanan: (${a}+${b})×${c}=${(a+b)*c} — itu SALAH.`],
    }),
  },
  {
    id: 'factor-find', name: 'Cari faktor', domain: 'mul', level: 'adv',
    roll: () => {
      const a = r(4, 12), b = r(2, 8)
      if (a === b) return [a, b + 1]
      return [a, b]
    },
    make: ([a, b]) => {
      const product = a * b
      return {
        text: `${product} = ? × ?  (cari dua angka yang hasil kalinya ${product}, keduanya > 1)`,
        answer: Math.min(a, b),
        hint: `Coba bagi ${product} dengan 2, 3, 4, ... sampai ketemu yang pas.`,
        why: [`${product} : 2 = ${product / 2} → ${product % 2 === 0 ? 'pas!' : 'tidak pas'}.`, `Faktor ketemu: ${Math.min(a, b)} × ${Math.max(a, b)} = ${product}.`],
      }
    },
  },
  {
    id: 'even-odd-puzzle', name: 'Teka-teki ganjil-genap', domain: 'logic', level: 'easy',
    roll: () => {
      const n = r(10, 50)
      const op = pick(['sum', 'diff'])
      return [n, op]
    },
    make: ([n, op]) => {
      const isEven = n % 2 === 0
      return {
        text: `${n} adalah bilangan ${isEven ? 'genap' : 'ganjil'}. Kalau ${isEven ? 'dikurangi 1' : 'ditambah 1'}, jadi apa?`,
        answer: isEven ? n - 1 : n + 1,
        hint: `${isEven ? 'Genap dikurang 1 = ganjil.' : 'Ganjil ditambah 1 = genap.'}`,
        why: [`${n} ${isEven ? 'genap' : 'ganjil'}.`, `${isEven ? 'Kurang 1' : 'Tambah 1'}: ${isEven ? n - 1 : n + 1} (${isEven ? 'ganjil' : 'genap'}).`],
      }
    },
  },

  // ---------- Jalur AI: rata-rata & peluang (dipakai model belajar) ----------
  {
    id: 'avg-simple', name: 'Rata-rata sederhana', domain: 'est', level: 'mid',
    roll: () => {
      const avg = r(3, 20)
      const d = pick([[-3, 0, 3], [-2, -1, 3], [-4, 1, 3], [-1, -2, 3], [2, -3, 1], [4, -1, -3], [-2, 2, 0], [3, -3, 0]])
      return [avg + d[0], avg + d[1], avg + d[2]]
    },
    make: ([a, b, c]) => {
      const sum = a + b + c, avg = sum / 3
      return {
        text: `Rata-rata dari ${a}, ${b}, ${c} = ?`, answer: avg,
        hint: 'Jumlahkan semua dulu, baru bagi banyaknya angka.',
        why: [`${a} + ${b} + ${c} = ${sum}.`, `${sum} : 3 = ${avg}.`],
      }
    },
  },
  {
    id: 'prob-simple', name: 'Peluang sederhana', domain: 'est', level: 'adv',
    roll: () => { const a = r(1, 6); let b = r(1, 6); if (b === a) b++; return [a, b] },
    make: ([a, b]) => {
      const total = a + b, g = gcd(a, total), ans = `${a / g}/${total / g}`
      return {
        text: `Ada ${a} bola merah dan ${b} bola biru dalam kotak. Ambil 1 bola acak, peluang dapat merah?`,
        answer: ans,
        choices: [ans, `${a}/${b}`, `${b}/${total}`, `${a}/${total + 1}`].filter((v, i, s) => s.indexOf(v) === i).sort(() => Math.random() - 0.5),
        hint: 'Peluang = banyak yang dicari dibagi total semua.',
        why: [`Total bola: ${a} + ${b} = ${total}.`, `Peluang merah = ${a}/${total}.`, `Disederhanakan: ${ans}.`],
      }
    },
  },

  // ────────────── LOGIKA & POLA (lateral thinking, programming logic) ──────────
  {
    id: 'logic-seq', name: 'Pola bilangan', domain: 'logic', level: 'easy',
    roll: () => {
      const patterns = [
        { seq: [2, 4, 6, 8], step: 2, name: 'aritmetika +2' },
        { seq: [3, 6, 12, 24], step: '×2', name: 'geometri ×2' },
        { seq: [1, 4, 9, 16], step: 'n²', name: 'kuadrat' },
        { seq: [5, 10, 15, 20], step: 5, name: 'aritmetika +5' },
      ]
      return [pick(patterns)]
    },
    make: ([p]) => {
      const next = typeof p.step === 'number' ? p.seq[3] + p.step : p.step === '×2' ? p.seq[3] * 2 : 25
      return {
        text: `Lanjutkan pola: ${p.seq.join(', ')}, ?`,
        answer: next,
        choices: choices(next, next + (typeof p.step === 'number' ? p.step : 1), p.seq[2], p.seq[3]),
        hint: `Cari beda atau rasio antar angka berurutan. Pola: ${p.name}.`,
        why: [`${p.seq.join(' → ')} → selanjutnya ${next}.`, `Polanya: ${p.name}.`],
      }
    },
  },
  {
    id: 'logic-order', name: 'Urutan logika', domain: 'logic', level: 'easy',
    roll: () => {
      const names = [['Andi', 'Budi', 'Cici'], ['Kucing', 'Anjing', 'Kelinci'], ['Merah', 'Biru', 'Hijau']]
      const n = pick(names)
      return [pick([
        { text: `${n[0]} di depan ${n[1]}, ${n[2]} di belakang ${n[1]}. ${n[1]} di posisi ke berapa dari depan?`, answer: 2 },
        { text: `Urutan dari depan: ${n[0]} → ${n[1]} → ${n[2]}. ${n[2]} di posisi ke berapa?`, answer: 3 },
        { text: `Barisan: ${n[2]} paling depan, ${n[1]} di tengah, ${n[0]} paling belakang. ${n[0]} di posisi ke berapa?`, answer: 3 },
      ])]
    },
    make: ([p]) => ({
      text: p.text, answer: p.answer, choices: [1, 2, 3],
      hint: 'Bayangkan barisannya, hitung dari depan: posisi 1, 2, 3.',
      why: [`Hitung dari depan satu per satu.`, `Jawaban: posisi ke-${p.answer}.`],
    }),
  },
  {
    id: 'logic-var', name: 'Trace variabel', domain: 'logic', level: 'mid',
    roll: () => {
      const ops = [
        { x: r(3, 9), y: r(2, 7), code: 'x = x + y\ny = x - y\nx = x - y', fx: (x, y) => [y, x] },
        { x: r(2, 8), y: r(3, 6), code: 'x = x * 2\ny = y + x', fx: (x, y) => [x * 2, y + x * 2] },
        { x: r(3, 7), y: r(2, 5), code: 'x = x + 3\ny = y + x', fx: (x, y) => [x + 3, y + x + 3] },
      ]
      const op = pick(ops)
      return [op]
    },
    make: ([op]) => {
      const [nx, ny] = op.fx(op.x, op.y)
      return {
        text: `x = ${op.x}, y = ${op.y}\n${op.code}\nBerapa x + y sekarang?`,
        answer: nx + ny,
        choices: choices(nx + ny, op.x + op.y, nx + op.y, op.x + ny),
        hint: 'Jalankan kode baris per baris, catat nilai x dan y tiap langkah.',
        why: [`Awal: x=${op.x}, y=${op.y}.`, `Setelah kode: x=${nx}, y=${ny}.`, `x + y = ${nx + ny}.`],
      }
    },
  },
  {
    id: 'logic-cond', name: 'Logika kondisi', domain: 'logic', level: 'mid',
    roll: () => {
      const puzzles = [
        { text: 'Semua programmer suka kopi. Andi programmer. Apakah Andi suka kopi?', answer: 1, choices: [1, 0], labels: ['Ya (1)', 'Tidak (0)'] },
        { text: 'Jika hujan, tanah basah. Tanah basah. Apakah pasti hujan?', answer: 0, choices: [1, 0], labels: ['Ya (1)', 'Tidak (0)'] },
        { text: 'x = 7. Jika x > 5 maka x = x * 2, selain itu x = x + 1. Berapa x?', answer: 14, choices: choices(14, 8, 7, 15) },
        { text: 'N = 9. Jika N genap maka N = N/2, selain itu N = N*3+1. Berapa N?', answer: 28, choices: choices(28, 4, 10, 9) },
      ]
      const p = pick(puzzles)
      return [p]
    },
    make: ([p]) => ({
      text: p.text,
      answer: p.answer,
      choices: p.choices || choices(p.answer, p.answer + 2, p.answer - 2, p.answer + 5),
      hint: p.answer === 1 ? 'Ikuti premisnya — berlaku ke semua anggota.' : p.answer === 0 ? 'Hati-hati dengan arah implikasi. Basah belum tentu karena hujan.' : 'Eksekusi kondisinya: periksa syarat, jalankan yang cocok.',
      why: p.labels ? [`Jawabannya: ${p.labels.find((l) => l.includes(String(p.answer))) || p.answer}.`] : [`Hasil akhir: ${p.answer}.`],
    }),
  },
  {
    id: 'logic-crypt', name: 'Kriptaritma mini', domain: 'logic', level: 'adv',
    roll: () => {
      const puzzles = [
        // A×B=12, A+B=7, A>B → A=4, B=3 (unique)
        { text: 'A × B = 12. A + B = 7. A > B. Berapa A?', a: 4, b: 3, ask: 'a' },
        // A+A+A = B+B, A=2 → 6=2B → B=3
        { text: 'A + A + A = B + B. A = 2. Berapa B?', a: 2, b: 3, ask: 'b' },
        // A+B=8, A−B=2 → A=5, B=3 → A×B=15 (unique)
        { text: 'A + B = 8. A − B = 2. A > B. Berapa A × B?', a: 5, b: 3, ask: 'product' },
      ]
      const p = pick(puzzles)
      return [p]
    },
    make: ([p]) => {
      const ans = p.ask === 'product' ? p.a * p.b : p.ask === 'sum' ? p.a + p.b : p.a
      return {
        text: p.text,
        answer: ans,
        choices: choices(ans, ans + 1, ans - 1, ans + 3),
        hint: 'Coba semua digit 1-9 yang mungkin. Ingat AB artinya 10×A + B.',
        why: [`Coba satu-satu: A=${p.a}, B=${p.b} memenuhi.`, `Maka hasilnya = ${ans}.`],
      }
    },
  },
  {
    id: 'logic-lateral', name: 'Lateral thinking', domain: 'logic', level: 'adv',
    roll: () => {
      const puzzles = [
        // Jumlah huruf dalam bahasa Indonesia: satu(4), dua(3), tiga(4), empat(5), lima(4) → enam(4)
        { text: '1 = 4, 2 = 3, 3 = 4, 4 = 5, 5 = 4. Maka 6 = ?\n(Petunjuk: hitung jumlah huruf tiap angka)', answer: 4 },
        { text: 'Seorang ayah punya 3 anak: Andi, Budi, dan ___. Siapa nama anak ketiga?\n(Petunjuk: baca ulang kalimatnya)', answer: 3, choices: [1, 2, 3], labels: ['Andi (1)', 'Budi (2)', '___ (3)'] },
        { text: 'Semua mawar adalah bunga. Beberapa bunga cepat layu. Apakah SEMUA mawar cepat layu?', answer: 0, choices: [1, 0], labels: ['Ya (1)', 'Tidak (0)'] },
        { text: '1, 11, 21, 1211, 111221, ?\n(Petunjuk: baca keras-keras tiap baris)', answer: 312211 },
      ]
      const p = pick(puzzles)
      return [p]
    },
    make: ([p]) => ({
      text: p.text,
      answer: p.answer,
      choices: p.choices || choices(p.answer, p.answer + 2, Math.abs(p.answer - 2), p.answer * 2),
      hint: 'Baca petunjuk baik-baik. Pikir di luar kebiasaan — lateral thinking!',
      why: [`Jawaban: ${p.answer}. ${p.labels ? p.labels.find((l) => l.includes(String(p.answer))) || '' : ''}`],
    }),
  },
]

export const skillById = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
export const skillsOf = (level) => SKILLS.filter((s) => s.level === level)

// --------------------------- Ragam bentuk soal ------------------------------
// Satu soal hitung yang sama bisa muncul dalam beberapa bentuk. Bentuknya
// diturunkan dari teks soal lewat satu regex, jadi tidak ada satu pun generator
// di atas yang perlu diubah — semua skill "A op B = ?" langsung dapat semuanya.
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, ':': (a, b) => a / b }
const FORM_RE = /^(\d+(?:,\d+)?) ([+−×:]) (\d+(?:,\d+)?) = \?$/

export const VARIANTS = ['plain', 'gap', 'tf', 'cmp', 'rev', 'est']
export const VARIANT_NAME = {
  plain: 'Hitung langsung', gap: 'Cari yang hilang', tf: 'Benar atau salah',
  cmp: 'Mana lebih besar', rev: 'Tebak angkaku', est: 'Kira-kira berapa?',
}

const deriveForm = (text) => {
  const m = FORM_RE.exec(text)
  return m ? [m[2], parseNum(m[1]), parseNum(m[3])] : null
}

function applyVariant(p, kind) {
  const form = kind === 'plain' ? null : deriveForm(p.text)
  if (!form) return p
  const [op, a, b] = form
  const val = OPS[op](a, b)
  const base = { ...p, visual: null, display: null, variant: kind }

  if (kind === 'gap')
    return {
      ...base, text: `${fmt(a)} ${op} ? = ${fmt(val)}`, answer: b, choices: null,
      hint: `Cari angka yang bikin kalimat ini benar. Coba tebak lalu periksa.`,
      why: [`${fmt(a)} ${op} ${fmt(b)} = ${fmt(val)}.`, `Jadi angka yang hilang: ${fmt(b)}.`],
    }

  if (kind === 'tf') {
    const off = ((a + b) % 3) + 1
    const shown = (a + b) % 2 === 0 ? val : val + off
    const benar = shown === val
    return {
      ...base, text: `${fmt(a)} ${op} ${fmt(b)} = ${fmt(shown)}`, display: 'Benar atau salah?',
      answer: benar ? 'Benar' : 'Salah', choices: ['Benar', 'Salah'],
      hint: `Hitung dulu ${fmt(a)} ${op} ${fmt(b)}, baru bandingkan.`,
      why: [`${fmt(a)} ${op} ${fmt(b)} = ${fmt(val)}.`, benar ? 'Yang tertulis sama — jadi benar.' : `Yang tertulis ${fmt(shown)} — jadi salah.`],
    }
  }

  if (kind === 'cmp') {
    const c = a + ((a % 3) + 1)
    const d = Math.max(1, b - ((b % 2) + 1))
    const other = OPS[op](c, d)
    if (other === val || !Number.isFinite(other)) return applyVariant(p, 'tf')
    const kiri = `${fmt(a)} ${op} ${fmt(b)}`, kanan = `${fmt(c)} ${op} ${fmt(d)}`
    return {
      ...base, text: 'Mana yang lebih besar?', display: `${kiri}   atau   ${kanan}`,
      answer: val > other ? kiri : kanan, choices: [kiri, kanan],
      hint: 'Hitung dua-duanya dulu, baru bandingkan.',
      why: [`${kiri} = ${fmt(val)}`, `${kanan} = ${fmt(other)}`, `Yang lebih besar: ${val > other ? kiri : kanan}.`],
    }
  }

  // Reverse: "Aku mikirin angka. Ditambah b hasilnya c. Angka berapa?"
  if (kind === 'rev') {
    const phrases = [
      `Aku mikirin sebuah angka. Kalau di${op === '+' ? 'tambah' : op === '−' ? 'kurang' : op === '×' ? 'kali' : 'bagi'} ${fmt(b)}, hasilnya ${fmt(val)}.`,
      `Sebuah angka rahasia di${op === '+' ? 'tambah' : op === '−' ? 'kurang' : op === '×' ? 'kali' : 'bagi'} ${fmt(b)} jadinya ${fmt(val)}.`,
      `? ${op} ${fmt(b)} = ${fmt(val)}. Cari angka yang hilang di depan.`,
    ]
    return {
      ...base, text: phrases[a % phrases.length], answer: a, choices: choices(a, a + 2, a - 2, b),
      hint: `Kerjakan kebalikannya: ${fmt(val)} ${op === '+' ? '−' : op === '−' ? '+' : op === '×' ? ':' : '×'} ${fmt(b)}.`,
      why: [`${op === '+' ? 'Balik jadi kurang' : op === '−' ? 'Balik jadi tambah' : op === '×' ? 'Balik jadi bagi' : 'Balik jadi kali'}: ${fmt(val)} ${op === '+' ? '−' : op === '−' ? '+' : op === '×' ? ':' : '×'} ${fmt(b)} = ${fmt(a)}.`, `Cek: ${fmt(a)} ${op} ${fmt(b)} = ${fmt(val)} ✓.`],
    }
  }

  // Estimation: pilih jawaban terdekat dari 4 pilihan
  if (kind === 'est') {
    const near = [val, val + ((a % 3) + 2), Math.abs(val - (b % 5) - 1), val + ((b % 4) + 3)]
    const uniq = [...new Set(near)].slice(0, 4)
    return {
      ...base, text: `${fmt(a)} ${op} ${fmt(b)} ≈ ?`, answer: val,
      choices: uniq.sort(() => Math.random() - 0.5),
      hint: `Bulatkan dulu angkanya, baru hitung kasar. Hasil pastinya deket ke ${Math.round(val / 5) * 5}.`,
      why: [`${fmt(a)} ${op} ${fmt(b)} = ${fmt(val)}.`, `Di antara pilihan yang ada, ${fmt(val)} yang paling tepat.`],
    }
  }

  return p
}

// Bentuk dibuka bertahap: pemula selalu bentuk polos, ragam menyusul setelah
// pola dasarnya menempel — supaya variasi terasa seru, bukan membingungkan.
export function variantsFor(m) {
  if (m.n < 5) return ['plain']
  if (m.n < 12) return ['plain', 'plain', 'gap', 'est']
  if (m.n < 25 || m.acc < 0.7) return ['plain', 'gap', 'tf', 'est', 'rev']
  return ['plain', 'gap', 'tf', 'cmp', 'rev', 'est']
}

// Tidak semua skill bisa diubah bentuknya — soal cerita dan pecahan tidak punya
// pola "A op B = ?". Dipakai supaya tantangan tidak pernah menjanjikan bentuk
// yang tidak bisa muncul di wilayah yang dipilih.
export function supportsVariants(skillId) {
  const s = skillById[skillId]
  for (let i = 0; i < 5; i++) if (deriveForm(s.make(s.roll()).text)) return true
  return false
}

export function problemFromKey(key) {
  const [id, raw, kind = 'plain'] = key.split(':')
  const s = skillById[id]
  const params = raw.split(',').map(Number)
  return { ...applyVariant({ skill: id, variant: 'plain', ...s.make(params) }, kind), key }
}

export function newProblem(skillId, kind = 'plain') {
  const s = skillById[skillId]
  const params = s.roll()
  const key = `${skillId}:${params.join(',')}:${kind}`
  return { ...applyVariant({ skill: skillId, variant: 'plain', ...s.make(params) }, kind), key }
}

// --------------------------- SRS (SM-2, Lampiran B) -------------------------
export function review(card, correct, ms) {
  const c = card || { ef: 2.5, int: 0, reps: 0, due: 0 }
  let { ef, int, reps } = c
  if (correct) {
    int = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(int * ef)
    ef = Math.min(3, ef + 0.1)
    if (ms < 3000) ef = Math.min(3, ef + 0.05)
    if (ms > 15000) ef = Math.max(1.3, ef - 0.05)
    reps += 1
  } else {
    int = 1
    ef = Math.max(1.3, ef - 0.2)
    reps = 0
  }
  return { ef: Math.round(ef * 100) / 100, int, reps, due: today() + int }
}

// --------------------------- Penguasaan keterampilan ------------------------
export function mastery(skillStat) {
  const s = skillStat || { hist: [], days: [] }
  const n = s.hist.length
  const acc = n ? s.hist.reduce((a, b) => a + b, 0) / n : 0
  if (n >= 20 && acc >= 0.85 && s.days.length >= 3) return { tier: 'gold', acc, n }
  if (n >= 15 && acc >= 0.7) return { tier: 'silver', acc, n }
  if (n >= 10 && acc >= 0.5) return { tier: 'bronze', acc, n }
  return { tier: n ? 'unlocked' : 'locked', acc, n }
}

const TIER_ORDER = { locked: 0, unlocked: 1, bronze: 2, silver: 3, gold: 4 }
export const tierRank = (t) => TIER_ORDER[t]

export function levelStatus(g) {
  const list = skillsOf(g.level)
  const stats = list.map((s) => mastery(g.skills?.[s.id]))
  const attempts = stats.reduce((a, s) => a + s.n, 0)
  const acc = attempts ? stats.reduce((a, s) => a + s.acc * s.n, 0) / attempts : 0
  const goldPct = stats.filter((s) => s.tier === 'gold').length / list.length
  const days = g.levelDays?.[g.level] || 0
  const need = LEVELS[g.level].minDays
  const missing = []
  if (acc < 0.85) missing.push(`akurasi ${Math.round(acc * 100)}% → butuh 85%`)
  if (goldPct < 0.7) missing.push(`${Math.round(goldPct * 100)}% skill emas → butuh 70%`)
  if (days < need) missing.push(`${days} hari latihan → butuh ${need} hari`)
  return { acc, goldPct, days, need, ready: missing.length === 0, missing, attempts }
}

export const nextLevel = (l) => ({ easy: 'mid', mid: 'adv', adv: null })[l]

// --------------------------- Penyusun sesi ----------------------------------
// Komposisi mengikuti PRD 6.2: pemanasan 10%, ulangan SRS 40%, materi baru 30%,
// tantangan 15%, sisanya pendinginan (ditangani layar ringkasan).
const PER_MINUTE = 2.6

export function buildSession(g, minutes, focus = [], opts = {}) {
  const total = opts.count || Math.min(15, Math.max(10, Math.round(minutes * PER_MINUTE)))
  // opts.skillIds memilih skill secara eksplisit (dipakai jalur AI) — melewati
  // filter g.level karena satu jalur bisa merentang beberapa tingkat sekaligus.
  const level = opts.levelBias || g.level
  const all = opts.skillIds ? opts.skillIds.map((id) => skillById[id]).filter(Boolean) : skillsOf(level)
  const themed = opts.domain ? all.filter((s) => s.domain === opts.domain) : all
  const list = themed.length ? themed : all
  const stat = (s) => mastery(g.skills[s.id])
  const t = today()
  // bentuk soal diputar per hari supaya sesi kemarin dan hari ini tidak terasa sama
  let n0 = t + (opts.variantSeed || 0)
  // Pergeseran per-skill penting: dengan pencacah bersama saja, skill yang bisa
  // diubah bentuknya bisa terus jatuh di fase yang salah dan bentuknya tidak
  // pernah muncul sama sekali.
  const variantOf = (s) => {
    const own = variantsFor(stat(s))
    const pool = opts.variantBias ? [opts.variantBias, opts.variantBias, ...own] : own
    return pool[(n0++ + s.id.length) % pool.length]
  }

  const inList = new Set(list.map((s) => s.id))
  const due = Object.entries(g.srs)
    .filter(([k, c]) => c.due <= t && skillById[k.split(':')[0]] && (!opts.skillIds || inList.has(k.split(':')[0])))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k)

  const byWeakness = [...list].sort((a, b) => stat(a).acc - stat(b).acc || stat(a).n - stat(b).n)
  const unseen = list.filter((s) => stat(s).n === 0)
  const strong = [...list].sort((a, b) => stat(b).acc - stat(a).acc)
  const focused = focus.map((id) => skillById[id]).filter((s) => s && s.level === g.level)

  const n = (p) => Math.round(total * p)
  const out = []
  const push = (p) => { if (p && !out.some((x) => x.key === p.key)) out.push(p) }
  const fresh = (s) => push(newProblem(s.id, variantOf(s)))

  // pemanasan — skill terkuat, bentuk polos, bangun percaya diri
  for (let i = 0; i < n(0.1) + 1; i++) push(newProblem((strong[i % strong.length] || list[0]).id, 'plain'))
  // ulangan SRS
  for (let i = 0; i < n(0.4) && i < due.length; i++) push(problemFromKey(due[i]))
  // materi baru / fokus dari AI
  const pool = focused.length ? focused : unseen.length ? unseen : byWeakness
  for (let i = 0; i < n(0.3); i++) fresh(pool[i % pool.length])
  // tantangan — skill terlemah
  for (let i = 0; i < n(0.15); i++) fresh(byWeakness[i % byWeakness.length])
  // isi sisa kalau kurang (SRS masih kosong di hari-hari awal)
  let guard = 0
  while (out.length < total && guard++ < total * 6) fresh(byWeakness[(out.length + guard) % byWeakness.length])

  return out.slice(0, total)
}

// --------------------------- Kerajaan ---------------------------------------
// Level bangunan 0–5 = seberapa dalam penguasaan domain terkait.
export function buildingLevels(g) {
  const out = {}
  for (const d of Object.keys(DOMAINS)) {
    const list = SKILLS.filter((s) => s.domain === d)
    const score = list.reduce((a, s) => a + tierRank(mastery(g.skills[s.id]).tier), 0)
    out[d] = Math.min(5, Math.floor((score / (list.length * 4)) * 5 + 0.001))
  }
  return out
}

export const BADGES = [
  { id: 'first', name: 'Langkah Pertama', icon: 'flag', test: (g) => g.sessions >= 1 },
  { id: 'week', name: 'Prajurit Sepekan', icon: 'calendar', test: (g) => g.streak >= 7 },
  { id: 'century', name: 'Klub Seratus', icon: 'award', test: (g) => g.streak >= 100 },
  { id: 'tables', name: 'Raja Perkalian', icon: 'grid', test: (g) => SKILLS.filter((s) => s.domain === 'mul').every((s) => mastery(g.skills?.[s.id]).tier === 'gold') },
  { id: 'speed', name: 'Kilat', icon: 'zap', test: (g) => g.fastCorrect >= 50 },
  { id: 'perfect', name: 'Tanpa Cela', icon: 'target', test: (g) => g.perfectSets >= 10 },
  { id: 'comeback', name: 'Kembali Bangkit', icon: 'sunrise', test: (g) => g.comebacks >= 1 },
  { id: 'kingdom', name: 'Kerajaan Lengkap', icon: 'star', test: (g) => Object.values(buildingLevels(g)).every((v) => v >= 5) },
  { id: 'clan', name: 'Punya Rekan', icon: 'users', test: (g) => !!g.clanId },
  { id: 'war', name: 'Veteran Perang', icon: 'crosshair', test: (g) => (g.warSessions || 0) >= 3 },
  { id: 'defense', name: 'Penjaga Gerbang', icon: 'shield', test: (g) => (g.defenseWins || 0) >= 1 },
  { id: 'quests', name: 'Pemburu Tugas', icon: 'check', test: (g) => (g.questsDone || 0) >= 20 },
]

// --------------------------- Pasukan & pertahanan ---------------------------
// Kekuatan unit ditarik langsung dari penguasaan skill domainnya — satu-satunya
// cara memperkuat pasukan adalah benar-benar menguasai hitungannya.
export const UNITS = {
  add: { name: 'Penjaga Ladang', role: 'Perisai', icon: 'shield' },
  sub: { name: 'Penggali Tambang', role: 'Pendobrak', icon: 'layers' },
  mul: { name: 'Penggempur Barak', role: 'Serangan luas', icon: 'zap' },
  div: { name: 'Penajam Bengkel', role: 'Serangan tepat', icon: 'crosshair' },
  frac: { name: 'Tabib Pasar', role: 'Pemulih', icon: 'activity' },
}

export function army(g) {
  const lv = buildingLevels(g)
  return Object.entries(UNITS).map(([domain, u]) => ({ ...u, domain, level: lv[domain], power: lv[domain] * 20 }))
}

// Kekuatan total menaikkan HP benteng di Pertahanan Kerajaan.
export const fortressHp = (g) => 60 + army(g).reduce((a, u) => a + u.power, 0)

// Bintang perang: gabungan ketepatan dan kecepatan, 0–3.
export function warStars({ correct, problems, seconds }) {
  if (!problems) return 0
  const acc = correct / problems
  const pace = seconds / problems
  if (acc >= 0.9 && pace <= 12) return 3
  if (acc >= 0.75) return 2
  if (acc >= 0.5) return 1
  return 0
}

// --------------------------- Skor tantangan ---------------------------------
// Mode tantangan pakai skor, bukan cuma benar/salah: 100 poin dasar + bonus
// kecepatan, dikali pengganda combo. Combo-nya yang bikin nagih — jawaban ke-6
// beruntun bernilai 3x lipat, jadi satu kesalahan terasa mahal.
export const comboMult = (combo) => (combo >= 6 ? 3 : combo >= 4 ? 2 : combo >= 2 ? 1.5 : 1)

export function scoreFor({ combo, ms, limitMs }) {
  const speed = limitMs > 0 ? Math.max(0, Math.round(50 * (1 - Math.min(1, ms / limitMs)))) : 0
  return Math.round((100 + speed) * comboMult(combo))
}

// Target dipasang di atas skor "main aman" (100/soal) supaya harus ngejar combo.
export const challengeTarget = (n) => n * 200

export const RANKS = [
  { key: 'S', min: 1,    label: 'Sempurna!',       labelKey: 'rank.s', color: '#ffd060' },
  { key: 'A', min: 0.8,  label: 'Keren banget',    labelKey: 'rank.a', color: '#3ec98a' },
  { key: 'B', min: 0.6,  label: 'Lumayan!',        labelKey: 'rank.b', color: '#6bd5ff' },
  { key: 'C', min: 0.35, label: 'Belum maksimal',  labelKey: 'rank.c', color: '#ff9f6b' },
  { key: 'D', min: 0,    label: 'Coba lagi ya',    labelKey: 'rank.d', color: '#ff7a6b' },
]

export const rankFor = (score, target) =>
  RANKS.find((r) => (target > 0 ? score / target : 0) >= r.min) || RANKS[RANKS.length - 1]

export function xpFor({ correct, hinted, explained, ms }) {
  if (!correct) return 0
  let xp = explained ? 3 : hinted ? 5 : 10
  if (!hinted && !explained && ms < 3000) xp += 5
  return xp
}
