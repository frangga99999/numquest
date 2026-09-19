// Bank parametrik: AI hanya memilih resep, mesin ini tetap menghitung jawaban.
export const SOURCES = [
  ['Harvard Graduate School of Education', 'Pertanyaan mengapa/bagaimana, perbandingan strategi, dan tantangan lanjutan setelah jawaban benar.', 'https://www.gse.harvard.edu/ideas/usable-knowledge/26/04/helping-every-student-think-deeply-about-math'],
  ['Stanford · YouCubed', 'Number sense: mengurai angka, melihat relasi, dan membangun kelancaran tanpa menjadikan timer sebagai ukuran utama.', 'https://www.youcubed.org/wp-content/uploads/2017/09/Fluency-Without-Fear-1.28.15.pdf'],
  ['University of Oxford · Department of Education', 'Latihan terstruktur dari representasi angka, prosedur, sampai penerapan dan refleksi kesalahan.', 'https://www.education.ox.ac.uk/'],
]
export const PEDAGOGY = [
  'Mulai dari makna bilangan dan contoh terurai, lalu tambah kerumitan sedikit demi sedikit.',
  'Satu konsep muncul lagi dalam hitung langsung, isian rumpang, dan soal konteks agar strategi dapat dipindahkan.',
  'Timer psikotes adalah pilihan; ketepatan dan pembahasan tetap didahulukan.',
]

const rows = [
  ['a1','arithmetic','Dasar','Tambah & kurang','Uraikan bilangan menjadi puluhan dan satuan. Untuk mengurangi, gunakan penjumlahan balik.','38 + 27 = 38 + 20 + 7 = 65.'],
  ['a2','arithmetic','Dasar','Perkalian & pembagian','Perkalian adalah kelompok sama besar; pembagian mencari ukuran atau banyak kelompok.','6 × 8 = 48, sehingga 48 ÷ 6 = 8.'],
  ['a3','arithmetic','Dasar','Bilangan negatif','Mengurangi bilangan negatif sama dengan menambah lawannya. Bayangkan bergerak pada garis bilangan.','−8 − (−3) = −8 + 3 = −5.'],
  ['a4','arithmetic','Menengah','Pecahan & desimal','Samakan penyebut sebelum menjumlahkan pecahan. Pembilang menghitung bagian, penyebut menentukan ukuran bagian.','1/4 + 2/8 = 2/8 + 2/8 = 4/8 = 0,5.'],
  ['a5','arithmetic','Menengah','Persentase','Persen berarti per seratus. Cari 10% atau 1% lalu gunakan perkalian.','15% dari 240 = 10% × 240 + 5% × 240 = 36.'],
  ['a6','arithmetic','Menengah','Urutan operasi','Kerjakan kurung, lalu kali/bagi, kemudian tambah/kurang. Operasi setara dikerjakan dari kiri.','(18 + 6) ÷ 3 × 2 = 16.'],
  ['a7','arithmetic','Lanjut','Kuadrat mental','Gunakan puluhan terdekat untuk mengurangi beban ingatan ketika mengkuadratkan bilangan.','43² = (40 + 3)² = 1600 + 240 + 9 = 1849.'],
  ['a8','arithmetic','Lanjut','Persentase bertingkat','Perubahan berturut-turut diterapkan pada nilai terbaru. Naik dan turun dengan persen sama tidak saling menghapus.','200 naik 20% lalu turun 10%: 200 × 1,2 × 0,9 = 216.'],
  ['a9','arithmetic','Lanjut','Estimasi & pembulatan','Perkirakan besaran hasilnya lebih dulu. Pembulatan membantu mengecek apakah jawaban akhir masuk akal.','198 + 304 dekat dengan 200 + 300, jadi hasilnya sekitar 500.'],
  ['a10','arithmetic','Mahir','Persamaan & masalah angka','Terjemahkan kalimat ke operasi sederhana, lalu gunakan operasi kebalikan untuk mencari nilai yang belum diketahui.','x + 17 = 42, maka x = 42 − 17 = 25.'],
  ['a11','arithmetic','Mahir','Pangkat, akar & skala','Pangkat adalah perkalian berulang; akar mencari bilangan yang jika dikalikan dirinya menghasilkan nilai tertentu.','√196 = 14 karena 14 × 14 = 196.'],
  ['a12','arithmetic','Mahir','Diskon & perubahan nilai','Bedakan diskon tunggal, perubahan berurutan, dan bunga sederhana. Selalu tulis nilai awal serta faktor perubahannya.','Harga 200.000 diskon 25% menjadi 150.000.'],
  ['p1','psychometric','Dasar','Deret selisih tetap','Bandingkan dua suku berurutan. Uji selisih pada semua pasangan sebelum meneruskan pola.','4, 9, 14, 19 → tambah 5 → 24.'],
  ['p2','psychometric','Dasar','Analogi angka','Cari operasi yang menghubungkan pasangan pertama, lalu terapkan pada pasangan kedua.','3 : 12 = 7 : ? dengan aturan ×4, jawabannya 28.'],
  ['p3','psychometric','Dasar','Ketelitian hitung','Jumlahkan digit sesuai aturan. Utamakan ketepatan sebelum kecepatan.','8 + 7 = 15 → tulis 5. Latihan ini bukan asesmen psikologis.'],
  ['p4','psychometric','Menengah','Deret berselang','Pisahkan posisi ganjil dan genap menjadi dua deret, lalu cari pola masing-masing.','2, 10, 4, 13, 6, 16 → suku berikutnya 8.'],
  ['p5','psychometric','Menengah','Rasio & proporsi','Jumlahkan bagian rasio untuk menemukan nilai per bagian. Cek apakah hasil kembali ke total.','Rasio 2:3, total 40 → satu bagian 8 → kelompok pertama 16.'],
  ['p6','psychometric','Menengah','Interpretasi data','Baca satuan dan pertanyaan terlebih dahulu. Rata-rata adalah jumlah nilai dibagi banyak data.','Penjualan 18, 24, 30 → rata-rata 72 ÷ 3 = 24.'],
  ['p7','psychometric','Lanjut','Deret selisih bertingkat','Jika selisih pertama berubah, periksa selisih kedua. Jelaskan aturan yang konsisten dengan semua suku.','2, 5, 10, 17 → selisih 3, 5, 7, berikutnya 9 → 26.'],
  ['p8','psychometric','Lanjut','Laju kerja','Jumlahkan laju pekerjaan, bukan waktu. Laju 1/a + 1/b memberi bagian pekerjaan per jam.','Pekerja A: 6 jam, B: 3 jam → bersama 2 jam.'],
  ['p9','psychometric','Lanjut','Perbandingan kuantitatif','Bandingkan nilai A dan B tanpa menghitung terlalu jauh. Gunakan selisih, faktor, atau pembulatan.','A = 18% dari 200 dan B = 20% dari 180. Keduanya 36.'],
  ['p10','psychometric','Mahir','Matriks angka','Cari aturan pada baris, lalu cek apakah aturan itu juga berlaku pada kolom.','2, 4, 8 → tiap angka dikali 2; 3, 6, ? → 12.'],
  ['p11','psychometric','Mahir','Kecepatan, jarak & waktu','Gunakan hubungan jarak = kecepatan × waktu. Samakan satuan sebelum membandingkan pilihan.','Mobil 60 km/jam selama 2,5 jam menempuh 150 km.'],
  ['p12','psychometric','Mahir','Data & keputusan cepat','Ambil informasi relevan dari tabel kecil, lalu tentukan nilai terbesar, selisih, atau rata-rata yang diminta.','Target 80, hasil 92; selisihnya 12.'],
]
const challengeFor = (track) => track === 'arithmetic'
  ? 'Isian angka · hitung langsung, rumpang, dan soal konteks'
  : 'Pilihan ganda · pola, perbandingan, tabel, dan simulasi waktu opsional'
export const MODULES = rows.map(([id,track,level,title,lesson,example]) => ({id,track,level,title,lesson,example,challenge:challengeFor(track)}))
const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id,m]))

// 24 × 50.000 = 1,2 juta entri parametrik; tiap entri memiliki enam format.
export const BANK_SIZE = 50000
export const VARIANT_COUNT = 6
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100
const qtext = (value) => String(value)

export function question(id, seed, variant = 0) {
  const module = MODULE_BY_ID.get(id)
  if (!module) throw new Error('Modul tidak dikenal')
  const n = ((Math.trunc(seed) % BANK_SIZE) + BANK_SIZE) % BANK_SIZE
  const v = ((Math.trunc(variant) % VARIANT_COUNT) + VARIANT_COUNT) % VARIANT_COUNT
  const old = v % 3
  const a = 2 + n % 100, b = 2 + Math.floor(n / 100), d = 2 + n % 7
  let text = '', answer = NaN, explanation = ''
  const set = (t, value, e) => { text = t; answer = value; explanation = e }
  switch(id) {
    case 'a1': set(old === 1 ? a+' + □ = '+(a+b) : old === 2 ? (a+b)+' − '+a+' = ?' : a+' + '+b+' = ?', old === 0 ? a+b : b, 'Penjumlahan dan pengurangan saling membalik: '+a+' + '+b+' = '+(a+b)+'.'); break
    case 'a2': set(old === 0 ? a+' × '+b+' = ?' : (a*b)+' ÷ '+a+' = ?', old === 0 ? a*b : b, a+' kelompok × '+b+' benda = '+(a*b)+' benda.'); break
    case 'a3': set(old === 2 ? b+' + (−'+a+') = ?' : '−'+a+' − (−'+b+') = ?', b-a, 'Mengurangi negatif sama dengan menambah lawannya: −'+a+' + '+b+' = '+(b-a)+'.'); break
    case 'a4': set(old === 1 ? a+'/'+d+' = ? (desimal, bulatkan 2 angka)' : a+'/'+d+' + '+b+'/'+d+' = ? (desimal, bulatkan 2 angka)', old === 1 ? round2(a/d) : round2((a+b)/d), old === 1 ? a+' dibagi '+d+', lalu bulatkan dua angka desimal.' : 'Jumlahkan pembilang menjadi '+(a+b)+'/'+d+', lalu bagi.'); break
    case 'a5': set(old === 2 ? b+'% dari '+(a*100)+' + '+(a*100)+' = ?' : b+'% dari '+(a*100)+' = ?', old === 2 ? a*(100+b) : a*b, '1% dari '+(a*100)+' adalah '+a+'. Gunakan itu untuk menghitung '+b+'%.'); break
    case 'a6': set(old === 1 ? a+' + '+b+' × '+d+' = ?' : '('+a+' + '+b+') × '+d+' − '+b+' = ?', old === 1 ? a+b*d : (a+b)*d-b, old === 1 ? 'Kerjakan perkalian lebih dulu, baru penjumlahan.' : 'Kerjakan kurung, perkalian, lalu pengurangan.'); break
    case 'a7': set(old === 1 ? a+'² − '+b+' = ?' : a+'² + '+b+' = ?', old === 1 ? a*a-b : a*a+b, 'Kuadrat berarti '+a+' × '+a+' = '+(a*a)+', lalu '+(old === 1 ? 'kurangi ' : 'tambah ')+b+'.'); break
    case 'a8': { const start = a*10000; set(old === 1 ? 'Nilai '+start+' naik '+b+'%, lalu turun 10%. Nilai akhir?' : 'Harga '+start+' naik '+b+'%, lalu turun 10%. Harga akhir?', a*(100+b)*90, 'Terapkan persen kedua pada nilai setelah perubahan pertama, bukan nilai awal.'); break }
    case 'a9': { const x = a*100+b*10+3, est = Math.round(x/10)*10, y = b*10+7; set(v < 3 ? 'Bulatkan '+x+' ke puluhan terdekat.' : 'Perkiraan '+x+' + '+y+' (bulatkan tiap bilangan ke puluhan) = ?', v < 3 ? est : est+Math.round(y/10)*10, v < 3 ? 'Lihat digit satuan untuk menentukan pembulatan.' : 'Bulatkan kedua bilangan ke puluhan, lalu jumlahkan.'); break }
    case 'a10': set(v < 2 ? 'x + '+a+' = '+(a+b)+'. Nilai x?' : v < 4 ? d+'x = '+(d*b)+'. Nilai x?' : (a+b)+' barang dibagi rata ke '+d+' kotak. Jika jumlah per kotak dikali '+d+', totalnya berapa?', v < 2 ? b : v < 4 ? b : a+b, v < 2 ? 'Kurangi kedua sisi dengan '+a+'.' : v < 4 ? 'Bagi kedua sisi dengan '+d+'.' : 'Pembagian dan perkalian kembali ke total awal.'); break
    case 'a11': { const root = 2+n%48; set(v < 2 ? '√'+(root*root)+' = ?' : v < 4 ? d+'³ = ?' : '10^'+d+' = ?', v < 2 ? root : v < 4 ? d**3 : 10**d, v < 2 ? 'Cari pasangan: '+root+' × '+root+' = '+(root*root)+'.' : v < 4 ? d+'³ berarti '+d+' × '+d+' × '+d+'.' : 'Pangkat '+d+' berarti angka 1 diikuti '+d+' nol.'); break }
    case 'a12': { const price = a*1000, pct = 5+b%35; set(v < 3 ? 'Harga '+price+' didiskon '+pct+'%. Harga setelah diskon?' : 'Modal '+price+', bunga sederhana '+pct+'% untuk 1 tahun. Nilai akhir?', v < 3 ? round2(price*(100-pct)/100) : round2(price*(100+pct)/100), v < 3 ? 'Diskon '+pct+'% berarti membayar '+(100-pct)+'% dari harga awal.' : 'Bunga sederhana '+pct+'% menambah nilai awal satu kali.'); break }
    case 'p1': set(a+', '+(a+b)+', '+(a+2*b)+', '+(a+3*b)+', …', a+4*b, 'Selisih selalu +'+b+'; lanjutkan dengan menambah '+b+'.'); break
    case 'p2': set(a+' → '+(a*d)+'; '+b+' → ?', b*d, 'Pengalinya '+d+'. Maka '+b+' × '+d+' = '+(b*d)+'.'); break
    case 'p3': { const code = String(n).padStart(5,'0'), sum = code.split('').reduce((s,x) => s+Number(x),0); set('Kode '+code+': jumlahkan semua digit, tulis digit satuannya.', sum%10, 'Jumlah digit = '+sum+'. Ambil digit satuannya, yaitu '+(sum%10)+'.'); break }
    case 'p4': set(a+', '+b+', '+(a+d)+', '+(b+3)+', '+(a+2*d)+', '+(b+6)+', …', a+3*d, 'Posisi ganjil: '+a+', '+(a+d)+', '+(a+2*d)+'; lanjut +'+d+'.'); break
    case 'p5': { const part = a+b; set('Rasio A:B = '+d+':3. Total '+((d+3)*part)+'. Berapa A?', d*part, 'Total bagian '+(d+3)+'. Satu bagian '+part+'; A = '+d+' × '+part+'.'); break }
    case 'p6': set(v < 3 ? 'Data toko: Senin '+a+', Selasa '+b+', Rabu '+(a+b)+'. Rata-rata? (2 desimal)' : 'Data toko: Senin '+a+', Selasa '+b+', Rabu '+(a+b)+'. Selisih tertinggi dan terendah?', v < 3 ? round2(2*(a+b)/3) : (a+b)-Math.min(a,b), v < 3 ? 'Jumlah '+(2*(a+b))+', dibagi 3 hari.' : 'Kurangi nilai tertinggi dengan nilai terendah.'); break
    case 'p7': set(a+', '+(a+b)+', '+(a+2*b+2)+', '+(a+3*b+6)+', …', a+4*b+12, 'Selisih '+b+', '+(b+2)+', '+(b+4)+'; berikutnya '+(b+6)+'.'); break
    case 'p8': set('A menyelesaikan pekerjaan dalam '+a+' jam, B dalam '+b+' jam. Bersama berapa jam? (2 desimal)', round2(a*b/(a+b)), 'Laju bersama 1/'+a+' + 1/'+b+'; waktu = '+(a*b)+'/'+(a+b)+' jam.'); break
    case 'p9': { const left = a*d, right = v%3 === 0 ? a*d : v%3 === 1 ? a*d+d : a*d-d, ans = left === right ? 3 : left > right ? 1 : 2; set('Bandingkan A = '+a+' × '+d+' dan B = '+right+'. Pilih: 1 jika A lebih besar, 2 jika B lebih besar, 3 jika sama.', ans, 'A = '+left+'; B = '+right+'. Bandingkan kedua nilai sebelum memilih.'); break }
    case 'p10': { const factor = 2+d%3, x = a%20+2; set(x+', '+(x*factor)+', '+(x*factor*factor)+' · '+b+', '+(b*factor)+', ? · Aturan setiap baris: ×'+factor+'. Nilai ?', b*factor*factor, 'Pada baris kedua, '+b+' × '+factor+' = '+(b*factor)+', lalu kali '+factor+' lagi.'); break }
    case 'p11': { const speed = 20+d*10, time = 2+b%5, distance = speed*time; set(v < 3 ? 'Kendaraan menempuh '+distance+' km dalam '+time+' jam. Kecepatannya km/jam?' : 'Kecepatan '+speed+' km/jam selama '+time+' jam. Jarak yang ditempuh?', v < 3 ? speed : distance, v < 3 ? 'Kecepatan = jarak ÷ waktu = '+distance+' ÷ '+time+'.' : 'Jarak = kecepatan × waktu = '+speed+' × '+time+'.'); break }
    case 'p12': { const target = a+b, north = target+d, south = target-d, east = target+b; set(v < 3 ? 'Target '+target+'. Hasil cabang: Utara '+north+', Selatan '+south+', Timur '+east+'. Cabang tertinggi? (1=Utara, 2=Selatan, 3=Timur)' : 'Target '+target+'. Hasil Utara '+north+' dan Selatan '+south+'. Selisih kedua cabang?', v < 3 ? 1 : north-south, v < 3 ? north+' adalah nilai terbesar dibanding '+south+' dan '+east+'.' : 'Selisih = '+north+' − '+south+'.'); break }
  }
  if (!Number.isFinite(answer) || !text || !explanation) throw new Error('Generator belum tersedia untuk '+id)
  return {id:id+':'+n+':'+v,module:id,seed:n,variant:v,text:qtext(text),answer,explanation,response:module.track === 'arithmetic' || id === 'p3' ? 'input' : 'choice'}
}
export function makeSet(id, start = 0, count = 10, variants) {
  return Array.from({length:Math.min(30,Math.max(1,count))},(_,i) => question(id,((start+i)*7919)%BANK_SIZE,variants?.[i] ?? (start+i)%VARIANT_COUNT))
}
export function parseAnswer(value) {
  const normalized = String(value).trim().replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN
}
export function validateRecipe(value, id) {
  if (!MODULE_BY_ID.has(id) || !value || !Number.isInteger(value.seed) || value.seed < 0 || value.seed >= BANK_SIZE || !Array.isArray(value.variants) || value.variants.length !== 10 || !value.variants.every((n) => Number.isInteger(n) && n >= 0 && n < VARIANT_COUNT)) return null
  return makeSet(id,value.seed,10,value.variants)
}
