# Sayfa Rehberi — Minimal Çöp Adam Animasyonlarıyla Kişisel Gelişim Reels'leri

Gönderdiğin 4 reels'ten çıkardığım "formül", sayfanın görsel kimliği, içerik planı ve bu repodaki animasyon motorunun kullanımı.

---

## 1. Örnek videolardan öğrendiklerim

| Video | Metafor | Kanca (ilk 1 sn) | Gerilim aracı | Kapanış |
|---|---|---|---|---|
| Konfor alanı halkaları | Çöp adam iç içe halkaları kırarak dışarı çıkıyor: Konfor → Korku → Öğrenme → Gelişim → BAŞARI | Halkalar ve etiketler hemen ekranda | Her halkada zorlanan, kıvılcım çıkaran adam | "Her duvar bir **omuz** darbesi uzağında." |
| İki tezgah (finans) | Ucuz satan kalabalık tezgah ile pahalı satan sakin tezgah | SALES / PROFIT paneli, kâr "???" | Sayaçlar akıyor, kâr gizli | Ay sonu açılır: 500 satış = 1.000 $, 70 satış = 1.050 $ → "MORE SALES. LESS PROFIT." |
| 4 zihniyet, 42 km | Motivasyon / Öfke / Takıntı / Disiplin koşucuları | "4 MINDSETS. 42 KM. WHO FINISHES FIRST?" | Kilometre sayaçları, alevli auralar, düşenler | Motivasyon bırakır, disiplin hiç durmadan bitirir |
| Madendeki telefon | Elmas damarına bir kazma uzaklıkta telefona bakan adam | Kazma yerde, adam telefonda | Duvar yıkılınca kelimeler belirir: Disiplin, Sağlık, Özgürlük... | "SO CLOSE. SO DISTRACTED." |

### Ortak DNA
1. **Tek metafor, tek mesaj.** Video tek bir fikri tek bir görselle anlatır. Konuşma/seslendirme yok; görsel kendi başına anlaşılır.
2. **Karakter = beyaz çöp adam.** Yüzü yok, herkes kendini onda görür. Duygu, poz ve **parlama (glow)** ile verilir.
3. **Karanlık zemin + neon vurgu.** Siyah/lacivert arka plan, beyaz çizgiler, 1–2 vurgu rengi. Her karakterin/kavramın kendi rengi var.
4. **Oyun arayüzü (HUD).** Sayaçlar, ilerleme çubukları, km/satış/gün sayıları. İzleyici bir "yarış" ya da "deney" izliyormuş gibi hisseder.
5. **Merak boşluğu.** "???", "Kim önce bitirir?", gizli kâr. Cevap en sonda verilir → izleyici sona kadar kalır (izlenme süresi ↑).
6. **Karşılaştırma.** İki ya da dört yol yan yana. Doğru seçim parlar ve yükselir, yanlış olan söner, griye döner, çöker.
7. **Kanca 1. saniyede.** Başlık ve sahne hemen ekranda, intro yok.
8. **15–30 sn, tam döngü.** Son kare ilk kareyle bağlanabilir; tekrar izlenme artar.
9. **Punchline + tek vurgulu kelime.** Sonda kısa, iki parçalı bir cümle; tek kelime renkli ve parlak.
10. **Marka + CTA.** Köşede hesap adı, sonda logo ve takip et kartı. Açıklamada "Yorumlara X yaz, rehberi göndereyim" tuzağı (yorum = algoritma).
11. **Müzik.** Slowed/phonk/epik ambient. Sahne geçişleri ritme oturur.

### Mesaj / ton
- Disiplin > motivasyon, erteleme, dikkat dağınıklığı, bileşik etki, konfor alanı, para ve zaman.
- Ton: **sert ama yargılamayan.** İzleyiciyi aşağılamaz, ona ayna tutar: "Bu sensin. Daha iyisini yapabilirsin."

---

## 2. Görsel kimlik (bu sayfa için)

**Renkler** (`reels/engine.js` → `CONFIG`)

| Token | Renk | Anlamı |
|---|---|---|
| `bg` | `#07080b` | Zemin (neredeyse siyah) |
| `ink` | `#f4f2ee` | Çöp adam, metin |
| `gold` | `#f4b740` | **Doğru yol, gelişim, imza renk** |
| `red` | `#ff4d5e` | Kayıp, bahane, yanlış yol |
| `cyan` | `#38d6f5` | Bilgi/veri vurgusu |
| `violet` / `green` | `#9b7bff` / `#3ee08f` | Ek karakter renkleri |
| Telefon renkleri | pembe/mavi/yeşil/turuncu | Dikkat dağıtıcının "ekranı", yüze yansır |

**Tipografi:** Inter 800–900 (başlık, büyük harf), Inter 500–700 (alt başlık, harf aralığı geniş), JetBrains Mono (sayaçlar, HUD).

**Hareket prensipleri**
- Giriş: `outBack` (hafif zıplama), çıkış: `outCubic`. Lineer hareket yok.
- Metin kelime kelime belirir, aşağıdan yukarı kayar.
- Doğru karakterin parlaması zamanla artar ve kıvılcım çıkarır. Yanlış karakter söner, griye döner.
- Tüm karelerde vinyet ve hafif film greni (ucuz "dijital" görünümü kırar).

**Güvenli alanlar (1080×1920):** üstte ~220 px, altta ~380 px'e önemli bir şey koyma (Instagram arayüzü kapatır).

**Reel iskeleti (23 sn)**

| Zaman | Ne olur |
|---|---|
| 0–1 sn | Başlık + soru (kanca). Vurgulu kelime parlar. |
| 1–2 sn | Sahne, karakterler ve HUD belirir. |
| 2–14 sn | Deney akar: sayaçlar, karşılaştırma, ara cümle ("İlk aylarda fark yok gibi..."). |
| 14–16 sn | Sonuç: "???" açılır, kazanan parlar, kaybeden çöker. |
| 16–20 sn | Ekran kararır, iki satırlık punchline gelir. |
| 20–23 sn | Logo + @hesap + "Takip et". |

---

## 3. Hazır reels'ler (bu repoda)

| # | Dosya | Mesaj | Punchline |
|---|---|---|---|
| 01 | `reels/01-yuzde-bir.html` | Her gün %1 daha iyi ya da daha kötü. 365 gün sonra ×37,8 ve ×0,03. | "Bugün fark etmez. Bir yıl sonra **37 kat** fark eder." |
| 02 | `reels/02-yarin.html` | Biri her gün bir basamak çıkar, diğeri telefonda "yarın" der. | "'Yarın' bir gün değil. Bir **bahane.**" |
| 03 | `reels/03-dort-saat.html` | Günde 4 saat = yılda 1.460 saat ≈ 61 gün. Biri kaydırır, diğeri kule inşa eder. | "Aynı 24 saat. **Farklı** hayatlar." |
| 04 | `reels/04-bir-vurus.html` | İki madenci aynı duvarı kazar. Hızlı başlayan yavaşlar ve elmasa 1 vuruş kala bırakır, sabit tempoda giden duvarı yıkar. | "Vazgeçtiğin an, belki **son vuruştu.**" |

Render edilmiş videolar: `reels/out/*.mp4` (1080×1920, 30 fps, sessiz. Müziği Instagram'da trend bir sesten ekle).

---

## 4. Sonraki 30 fikir

1. **Kazma ve tünel:** Kazmayı bırakan adam ile 1 vuruş daha atan adam. Ödül duvarın hemen arkasında.
2. **Motivasyon pili:** Motivasyon bataryası günden güne biter, disiplin sabit güçte kalır.
3. **Dopamin borcu:** Her kaydırma +1 dopamin ve −1 odak. Sayaç eksiye düşer.
4. **5 saniye kuralı:** Alarm çalar. 5…4…3 geri sayımı. Biri kalkar, diğeri ertele'ye basar (×7).
5. **Bambu ağacı:** 4 yıl toprak altında kök, 5. yılda 30 m büyüme. "Görmediğin yerde büyüyorsun."
6. **Kum saati:** Üst hazne "zaman", alt hazne "hiçbir şey" ya da "beceri".
7. **Faiz kartopu:** Ayda 1.000 ₺ birikim, 10/20/30 yıl. Kartopu çığa dönüşür.
8. **Konfor koltuğu:** Koltuk büyür ve adamı yutar.
9. **İki ayna:** "Şu anki sen" ile "1 yıl sonraki sen". Her alışkanlıkla ikincisi değişir.
10. **Domino:** Her taş öncekinin 1,5 katı. 1. taş küçük bir alışkanlık, 30. taş gökdelen.
11. **Arkadaş çemberi:** En çok vakit geçirdiğin 5 kişinin ortalaması. Halkalar renk değiştirir.
12. **Bildirim yağmuru:** Hedefe yürüyen adama bildirimler çarpar, yolu sapar.
13. **Ağırlık kaldırma:** Her gün +1 kg. Kas barı dolar, bahane barı boşalır.
14. **Harcama sızıntısı:** Kova (maaş) delik deşik: kahve, abonelik, sepet.
15. **Kulak arkası ses:** "Yapamazsın" balonları büyür. Adam kulaklık takar, balonlar söner.
16. **Kayıp maraton:** Kim önce bitirir? Hızlı başlayan mı, sabit giden mi?
17. **Karanlık oda:** Her doğru alışkanlık bir ampul yakar. 30. günde oda aydınlık.
18. **Kapılar:** "Kolay" yazan kapı aşağı, "zor" yazan kapı yukarı götürür.
19. **Batan gemi:** Her bahane gemiye bir delik açar.
20. **Merdiven ve asansör:** Kısa yol arayan asansörde bozulup kalır, merdiveni çıkan varır.
21. **Bahçe:** Her gün sulanan tohum ile ayda bir sulanan tohum.
22. **Ekran süresi:** 6 saat/gün × 50 yıl = 12,5 yıl ekranda. Hayat çubuğu dilimlenir.
23. **Tek atış:** Okçu, hedefe odaklanan ile her sese dönen.
24. **Labirent:** Plansız koşan ile haritası olan.
25. **Yük:** Sırttaki taşlara "geçmiş", "başkaları ne der" yazar. Bırakınca hızlanır.
26. **Sınav gecesi:** Son gece çalışan ile her gün 20 dk çalışan. Bilgi barı unutma eğrisiyle düşer.
27. **Para ağacı:** Maaşın yüzde kaçı tohum, yüzde kaçı meyve?
28. **Sessiz çalışan:** Herkes konuşur (balonlar), biri sessizce kule diker.
29. **Ateş çemberi:** Korku halkası. Atlayan için ateş aslında sahnedir.
30. **Son nefes listesi:** Yaşlı çöp adam pişmanlıkları sayar. Genç adam o listeyi bugünden siler.

---

## 5. Paylaşım planı

- **Sıklık:** Haftada 4–5 reel. Saat 19:00–22:00 arası.
- **Seri mantığı:** Aynı formatta (ör. "2 insan, 1 fark") seriler hesabı tanınır kılar.
- **Açıklama şablonu:**
  ```
  Aynı 24 saat. Farklı hayatlar. ⏳
  Sen hangisisin? 👇

  Yorumlara "PLAN" yaz, 30 günlük disiplin planımı DM'den göndereyim.

  #disiplin #kişiselgelişim #motivasyon #alışkanlık #başarı #odak
  ```
- **Lead magnet:** Yorum yazana gönderilecek basit bir PDF hazırla (30 günlük plan, alışkanlık takip tablosu). Bu yorumları ve DM'leri patlatır.
- **Kapak:** Videonun 1. saniyesi zaten başlıklı. Profil ızgarası için aynı kareyi kapak seç.
- **Sabitlenen 3 reel:** En güçlü 3 video (01, 02, 03 iyi bir başlangıç).

---

## 6. Teknik: animasyonları kullanma

```bash
cd reels

# 1) Tarayıcıda izle / düzenle (tıkla: durdur · R: baştan · ←/→: sar)
open 01-yuzde-bir.html          # ya da: python3 -m http.server → http://localhost:8000

# 2) MP4 üret (Node + Playwright + ffmpeg gerekir)
node render.cjs 01-yuzde-bir.html
node render.cjs 01-yuzde-bir.html --handle @gercekhesabin   # sayfa adıyla

# 3) Hızlı önizleme kareleri
node render.cjs 02-yarin.html --snap 1,5,10,18
```

- **Sayfa adını kalıcı değiştir:** `reels/engine.js` → `CONFIG.handle`.
- **Yeni reel:** Bir reel dosyasını kopyala. `draw(ctx, t, F)` içinde her şey `t` saniyesine göre hesaplanır (`F.prog(t, a, b)` 0→1 ilerleme verir).
- **Motorun parçaları:** `F.stickman` (pozlar: `stand`, `walk`, `run`, `sitPhone`, `standPhone`, `slump`, `celebrate`, `lift`), `F.revealLine` (kelime kelime metin, `*vurgu*`), `F.panel` (HUD kutusu), `F.embers` (kıvılcım), `F.endCard` (logo + takip et).
