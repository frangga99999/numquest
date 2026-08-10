// Jalur AI: urutan belajar matematika khusus buat orang dewasa yang mau paham
// AI tapi ngerasa "bodoh banget" soal hitung-hitungan. Setiap node harus
// dituntaskan berurutan — tidak ada yang bisa dilompati, kayak map di Duolingo.
// Materinya daur ulang dari SKILLS yang sudah ada (plus avg-simple & prob-simple
// yang baru) supaya mesin soal, SRS, dan penguasaan tetap satu sumber kebenaran.

export const AI_PATH = [
  {
    id: 'kenalan-angka', title: 'Kenalan Angka', icon: 'ph:magnifying-glass-fill',
    why: 'AI juga "baca" angka dulu sebelum belajar apa pun.',
    skillIds: ['ns-compare', 'ns-place', 'ns-seq'],
  },
  {
    id: 'pembulatan', title: 'Pembulatan & Perkiraan', icon: 'ph:target-fill',
    why: 'AI jarang ngitung persis — dia lebih sering "ngira-ngira" pakai pembulatan. Kayak kamu naksir harga total belanjaan sebelum ke kasir.',
    skillIds: ['est-round10', 'est-about', 'est-round100'],
  },
  {
    id: 'sehari-hari', title: 'Matematika Sehari-hari', icon: 'ph:shopping-cart-fill',
    why: 'AI belajar dari data dunia nyata: harga barang, waktu tempuh, kembalian. Matematika yang sama kayak yang kamu pakai tiap hari.',
    skillIds: ['word-easy', 'time-calc', 'money-change'],
  },
  {
    id: 'tambah-kurang', title: 'Tambah & Kurang', icon: 'ph:plus-minus-fill',
    why: 'Ini fondasi semua hitungan yang AI pakai buat ngolah data.',
    skillIds: ['add-1d', 'add-20', 'sub-1d', 'sub-20'],
  },
  {
    id: 'kali-bagi', title: 'Kali & Bagi', icon: 'ph:x-fill',
    why: 'AI ngitung jutaan perkalian tiap detik pas lagi belajar.',
    skillIds: ['mul-easy', 'mul-tables', 'div-easy', 'div-facts'],
  },
  {
    id: 'hitung-gesit', title: 'Hitung Gesit', icon: 'ph:lightning-fill',
    why: 'AI butuh ngitung super-cepat. Kayak kamu lagi main game — makin gesit mikir, makin jago lo level-up.',
    skillIds: ['add-2d-carry', 'sub-2d-borrow', 'mul-2dx1d'],
  },
  {
    id: 'pola-logika', title: 'Pola & Logika', icon: 'ph:git-branch-fill',
    why: 'AI "melihat" dengan cari pola di data. Kayak kamu nebak lagu cuma dari dua nada pertama — itu juga pola.',
    skillIds: ['ns-seq', 'div-rem', 'ns-count-back'],
  },
  {
    id: 'pecahan', title: 'Pecahan', icon: 'ph:chart-pie-slice-fill',
    why: 'Data yang dipelajari AI sering berupa pecahan dari keseluruhan.',
    skillIds: ['frac-compare', 'frac-add-same', 'frac-of-number'],
  },
  {
    id: 'desimal', title: 'Desimal', icon: 'ph:number-circle-one-fill',
    why: 'Angka penting di dalam AI (namanya "weight") hampir selalu desimal.',
    skillIds: ['dec-add', 'dec-mul'],
  },
  {
    id: 'persen', title: 'Persen', icon: 'ph:percent-fill',
    why: 'Tingkat yakin AI atas jawabannya itu bentuknya persen, kayak "yakin 92%".',
    skillIds: ['pct-of', 'pct-change'],
  },
  {
    id: 'rata-rata', title: 'Rata-rata', icon: 'ph:chart-bar-fill',
    why: 'AI "belajar" dengan ngambil rata-rata dari jutaan contoh sekaligus.',
    skillIds: ['avg-simple'],
  },
  {
    id: 'peluang', title: 'Peluang', icon: 'ph:dice-five-fill',
    why: 'Jawaban AI itu sebenarnya tebakan berdasar peluang paling besar.',
    skillIds: ['prob-simple'],
  },
  {
    id: 'perbandingan', title: 'Perbandingan', icon: 'ph:scales-fill',
    why: 'AI nyari jawaban dengan bandingin pola dari data-data yang mirip.',
    skillIds: ['ratio', 'unit-price'],
  },
]

export const NODE_PROBLEM_COUNT = 10
export const NODE_PASS_ACC = 0.7

export const starsFor = (acc) => (acc >= 0.9 ? 3 : acc >= NODE_PASS_ACC ? (acc >= 0.8 ? 2 : 1) : 0)

export function nodeStatus(g, index) {
  const cleared = g.aiPath?.cleared || {}
  if (cleared[AI_PATH[index].id] != null) return 'cleared'
  if (index === 0) return 'available'
  return cleared[AI_PATH[index - 1].id] != null ? 'available' : 'locked'
}

export const pathProgress = (g) => {
  const cleared = g.aiPath?.cleared || {}
  return { done: Object.keys(cleared).length, total: AI_PATH.length }
}

export function clearPathNode(g, nodeId, stars) {
  const prev = g.aiPath?.cleared?.[nodeId] || 0
  return {
    ...g,
    aiPath: { ...g.aiPath, cleared: { ...g.aiPath?.cleared, [nodeId]: Math.max(prev, stars) } },
  }
}
