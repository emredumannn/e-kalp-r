# E ❤ R · Kurulum

## 1. Supabase projesi
1. supabase.com → **New project** (bölge: Frankfurt / eu-central-1).
2. **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**.
3. **Authentication → Sign In / Providers → Email**: “Allow new users to sign up” seçeneğini **kapat**.
   Böylece ikinizden başka kimse hesap açamaz.
4. **Authentication → Users → Add user → Create new user**
   - Emre'nin e-postası ve şifresi, “Auto Confirm User” işaretli
   - Rabia'nın e-postası ve geçici bir şifre (Rabia sonra Ayarlar'dan değiştirir)
5. SQL Editor'de `schema.sql` dosyasının en altındaki iki `insert into public.profiles` satırını
   e-postalarla doldurup çalıştır. Emre'nin satırında `is_admin = true` var: admin sensin.

## Admin neleri değiştirebilir?
- **Admin paneli** (sağ üstteki 🛠️): site adı, sayaç başlangıç anı, sayaç yazıları, kavanoz başlığı,
  dualar sayfasındaki cümle, isimler ve Rabia'yı da admin yapma.
- **Tüm içerik**: anılar, fotoğraflar, sebepler, dualar (hazırlar dahil), dua kayıtları, ruh halleri,
  ilkler, yapacaklar, şarkılar, yerler. Hepsi düzenlenip silinebilir.
- **Kişiye özel olanlar istisna**: mektuplar, açılış sürprizleri ve test soruları. Herkes yalnızca
  kendi yazdığını görür ve düzenler. Admin de sana hazırlanan sürprizi ya da cevapları önceden göremez.
- Rabia kendi eklediği her şeyi düzenleyip silebilir. Yapacaklar listesinde ikiniz de "yaptık" işaretleyebilirsiniz.
6. **Project Settings → API**: **Project URL** ile **anon public** key'i `js/config.js` dosyasına yaz.
   (`service_role` key'i ASLA koyma.)

## 2. Yayına alma (GitHub Pages)
Repo `e-kalp-r` adıyla açılır, Settings → Pages → “Deploy from branch: main / root”.
Adres: `https://emredumannn.github.io/e-kalp-r/`

Kodda sadece site arayüzü ve anon key bulunur. Anılar, mektuplar ve fotoğraflar Supabase'te
durur ve güvenlik kuralları (RLS) sayesinde sadece ikiniz görebilirsiniz.

## 3. iPhone'a ekleme
Safari'de adresi aç → **Paylaş** (□↑) → **Ana Ekrana Ekle**.
Ana ekrandan açtıktan sonra bir kez daha giriş yap.

## Güncelleme yaparken
Dosyaları değiştirdikten sonra `sw.js` içindeki `VERSION` değerini bir artır
(`ekalpr-v1` → `ekalpr-v2`). Telefonda “Yeni sürüm hazır” butonu çıkar.

## Notlar
- `js/config.js` boşken site **demo modunda** açılır (veriler kaydedilmez).
- İlk görüş anı `js/config.js` içindeki `START` değeridir: 7 Kasım 2026, 19:00.
- Fotoğraflar yüklenmeden önce 1600 piksele küçültülür. Supabase'in ücretsiz 1 GB alanına yaklaşık 3–4 bin fotoğraf sığar.
