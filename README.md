# XAD Player — Hướng dẫn tích hợp

Video Ad Player hỗ trợ quảng cáo VAST/VMAP qua Google IMA SDK, scroll sticky, tự bật lại quảng cáo, và responsive trên mọi thiết bị.

---

## 1. Cài đặt

Chỉ cần 1 dòng script. Tất cả dependencies (Video.js, IMA SDK, contrib-ads) được tự động load.

```html
<script src="https://cdn.jsdelivr.net/gh/Bigfourth/video-ads@latest/minify.js" async></script>
```

Hoặc self-host:

```html
<script src="/path/to/xadplayer-optimized.js" async></script>
```

---

## 2. Hai chế độ: Instream & Outstream

### 2.1 Instream — Video + Quảng cáo

Player hiển thị video nội dung kèm quảng cáo (preroll, midroll, postroll).

```html
<div class="xad-video"
     data-src="https://cdn.pubabc.com/vietnam/Vietnam-4K-Epic-Roadtrip-Nature-landscapes-c.m3u8"
     data-adtag="https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator="
     data-controls="true"
     data-autoplay="true"
     data-sticky="bottom-right"
     data-ad-breaks="pre,25%,50%,75%,post"
     data-close="true"
     data-debug="true">
</div>
```

### 2.2 Outstream — Chỉ quảng cáo + Video nền

Player chạy video nền (muted) và phủ quảng cáo lên. Thường đặt giữa nội dung bài viết.

```html
<div class="xad-outstream"
     data-mode="outstream"
     data-adtag="https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator="
     data-category="random"
     data-sticky="bottom-right"
     data-close="true"
     data-ad-repeat="true"
     data-ad-repeat-delay="20"
     data-debug="true">
</div>
```

---

## 3. Bảng Data Attributes

### 3.1 Chung (cả Instream & Outstream)

| Attribute | Mô tả | Giá trị | Mặc định |
|---|---|---|---|
| `data-adtag` | URL quảng cáo VAST hoặc VMAP | URL | **bắt buộc** |
| `data-ad-format` | Loại ad tag | `vast` / `vmap` | auto-detect từ URL |
| `data-sticky` | Vị trí sticky khi scroll | `bottom-right` / `bottom-left` / `top-right` / `top-left` | *(tắt)* |
| `data-sticky-width` | Chiều rộng sticky (px) | số | `400` |
| `data-sticky-height` | Chiều cao sticky (px) | số | `225` |
| `data-close` | Hiện nút đóng ✕ khi sticky | `true` / `false` | `true` |
| `data-max-width` | Giới hạn chiều rộng tối đa (px) | số | *(không giới hạn)* |
| `data-debug` | Log ra Console (F12) | `true` / `false` | `false` |

### 3.2 Instream

| Attribute | Mô tả | Giá trị | Mặc định |
|---|---|---|---|
| `data-src` | URL video nội dung | `.m3u8` / `.mpd` / `.mp4` | *(không có)* |
| `data-controls` | Hiện thanh điều khiển | `true` / `false` | `true` |
| `data-autoplay` | Tự động phát (muted) | `true` / `false` | `false` |
| `data-poster` | Ảnh thumbnail | URL ảnh | *(không có)* |
| `data-width` | Tỷ lệ ngang (ratio) | số | `16` |
| `data-height` | Tỷ lệ dọc (ratio) | số | `9` |
| `data-ad-breaks` | Vị trí chèn quảng cáo (VAST) | `pre,25%,50%,post` | `pre` |
| `data-ad-interval` | Midroll tự động mỗi N giây | số giây | `0` *(tắt)* |

### 3.3 Outstream

| Attribute | Mô tả | Giá trị | Mặc định |
|---|---|---|---|
| `data-mode` | Chế độ | `outstream` | **bắt buộc** |
| `data-src` | URL video nền (ghi đè category) | URL | *(dùng category)* |
| `data-category` | Thể loại video nền | Xem bảng bên dưới | `nature` |
| `data-ad-repeat` | Lặp lại quảng cáo | `true` / `false` | `true` |
| `data-ad-repeat-delay` | Chờ N giây giữa các lần lặp | số giây | `30` |

### 3.4 Video Category (Outstream)

| `data-category` | Video nền |
|---|---|
| `sport` | `cdn.pubabc.com/sport/main.m3u8` |
| `tech` hoặc `technology` | `cdn.pubabc.com/tech/main.m3u8` |
| `entertainment` | `cdn.pubabc.com/entertainment/main.m3u8` |
| `travel` | `cdn.pubabc.com/travel/main.m3u8` |
| `nature` | `cdn.pubabc.com/natural/main.m3u8` |
| `vietnam` | `cdn.pubabc.com/vietnam/...m3u8` |
| **`random`** | **Ngẫu nhiên 1 trong 6 thể loại trên** |
| *(không set)* | Fallback → `nature` |

Ưu tiên chọn video: `data-src` > `data-category` > `nature` (mặc định).

Nếu video lỗi (404/CORS) → tự động thử category khác cho đến khi tìm được video hoạt động.

---

## 4. Scroll Sticky — Cơ chế hoạt động

### 4.1 Ba trạng thái

```
NORMAL  — Player ở vị trí gốc trong trang, user nhìn thấy
STICKY  — User scroll xuống → player thu nhỏ fixed vào góc màn hình
HIDDEN  — User nhấn ✕ → ẩn sticky, player VẪN PLAY ở vị trí gốc
```

### 4.2 Chuyển trạng thái

```
NORMAL ──scroll xuống──→ STICKY      (player ra khỏi viewport)
STICKY ──scroll lên────→ NORMAL      (player trở lại viewport)
STICKY ──nhấn ✕────────→ HIDDEN      (ẩn sticky, player vẫn play)
HIDDEN ──ad break──────→ STICKY      (★ tự bật lại khi có quảng cáo!)
HIDDEN ──scroll lên────→ NORMAL      (user nhìn thấy player lại)
```

### 4.3 Điểm quan trọng

- Player **KHÔNG BAO GIỜ bị xóa** khi nhấn ✕. Chỉ ẩn khung sticky.
- Video tiếp tục play bình thường ở vị trí gốc.
- Khi video đến ad break (midroll) hoặc ad mới request thành công → sticky **tự bật lại** ở góc.
- Responsive: trên mobile sticky tự thu nhỏ vừa màn hình.
- Xoay ngang/dọc → sticky tự resize.

---

## 5. Quảng cáo — VAST vs VMAP

### 5.1 VAST (1 quảng cáo mỗi request)

Code tự quản lý schedule. Dùng `data-ad-breaks` để chỉ định vị trí:

```html
data-ad-breaks="pre,25%,50%,75%,post"
```

| Giá trị | Ý nghĩa |
|---|---|
| `pre` | Preroll (trước video) |
| `post` | Postroll (sau video) |
| `25%` | Midroll tại 25% thời lượng video |
| `60` | Midroll tại giây thứ 60 |

Hoặc dùng `data-ad-interval="30"` để tự chèn midroll mỗi 30 giây.

### 5.2 VMAP (nhiều quảng cáo trong 1 response)

IMA SDK tự quản lý toàn bộ schedule từ VMAP XML. Không cần `data-ad-breaks`.

Auto-detect từ URL parameter `output=vmap`. Hoặc set thủ công: `data-ad-format="vmap"`.

### 5.3 Correlator & Retry

Mỗi request quảng cáo tự thêm `correlator=Date.now()` mới → tránh Google reject duplicate.

Nếu quảng cáo lỗi (no fill, timeout) → tự retry 4 lần với exponential backoff:

```
Lần 1: chờ 5 giây
Lần 2: chờ 10 giây
Lần 3: chờ 20 giây
Lần 4: chờ 40 giây
→ Dừng
```

### 5.4 Google Test Ad Tags (luôn có fill)

Dùng để test, luôn trả về quảng cáo:

```
VAST Skippable:
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=

VAST Linear:
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator=

VMAP Pre-roll:
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/vmap_ad_samples&sz=640x480&cust_params=sample_ar%3Dpreonly&ciu_szs=300x250%2C728x90&gdfp_req=1&ad_rule=1&output=vmap&unviewed_position_start=1&env=vp&correlator=
```

Danh sách đầy đủ: https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/tags

---

## 6. Responsive

### 6.1 Player tự co giãn

Player luôn chiếm 100% width của container cha. Chiều cao giữ tỷ lệ bằng padding-top trick.

```
Container 800px → Player 800 × 450 (16:9)
Container 375px → Player 375 × 211 (16:9)
Container 320px → Player 320 × 180 (16:9)
```

### 6.2 Tỷ lệ tùy chỉnh (Instream)

```html
<!-- 16:9 (mặc định) -->
<div class="xad-video" data-src="..." data-adtag="..."></div>

<!-- 4:3 -->
<div class="xad-video" data-src="..." data-adtag="..." data-width="4" data-height="3"></div>

<!-- 21:9 Ultra-wide -->
<div class="xad-video" data-src="..." data-adtag="..." data-width="21" data-height="9"></div>
```

### 6.3 Outstream

- Min width: 300px (không co nhỏ hơn).
- Height: tự detect từ video thật qua `loadedmetadata`.
- Không viền, không bo góc.
- `data-max-width="640"` để giới hạn trên desktop.

### 6.4 Sticky trên mobile

Sticky tự tính: `width = min(data-sticky-width, viewport - 24px)`, giữ tỷ lệ.

```
Desktop 1440px: sticky 400 × 225
iPhone 14:      sticky 369 × 207
iPhone SE:      sticky 351 × 197
```

---

## 7. CDN — Cấu hình CORS (Cloudflare R2)

Video HLS (.m3u8) qua Video.js dùng XHR để fetch các segment .ts → CDN **phải có CORS header**.

### 7.1 Thêm CORS policy

Cloudflare Dashboard → R2 → Bucket → Settings → CORS Policy → Add:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Content-Type"],
    "MaxAgeSeconds": 86400
  }
]
```

Để giới hạn domain:

```json
"AllowedOrigins": ["https://yourdomain.com", "https://www.yourdomain.com"]
```

### 7.2 Purge cache sau khi set CORS

Cloudflare Dashboard → domain CDN → Caching → **Purge Everything**.

Nếu không purge, các file đã cache sẽ không có CORS header cho đến khi hết hạn.

---

## 8. Code mẫu đầy đủ

### 8.1 Instream cơ bản

```html
<script src="xadplayer-optimized.js" async></script>

<div class="xad-video"
     data-src="https://cdn.pubabc.com/vietnam/Vietnam-4K-Epic-Roadtrip-Nature-landscapes-c.m3u8"
     data-adtag="YOUR_VAST_TAG"
     data-autoplay="true"
     data-controls="true">
</div>
```

### 8.2 Instream + Sticky + Midroll

```html
<div class="xad-video"
     data-src="https://cdn.pubabc.com/vietnam/Vietnam-4K-Epic-Roadtrip-Nature-landscapes-c.m3u8"
     data-adtag="YOUR_VAST_TAG"
     data-autoplay="true"
     data-controls="true"
     data-sticky="bottom-right"
     data-sticky-width="400"
     data-sticky-height="225"
     data-close="true"
     data-ad-breaks="pre,30%,60%,post">
</div>
```

### 8.3 Outstream cơ bản

```html
<div class="xad-outstream"
     data-mode="outstream"
     data-adtag="YOUR_VAST_TAG"
     data-category="random">
</div>
```

### 8.4 Outstream + Sticky + Ad Repeat

```html
<div class="xad-outstream"
     data-mode="outstream"
     data-adtag="YOUR_VAST_TAG"
     data-category="random"
     data-sticky="bottom-right"
     data-sticky-width="400"
     data-sticky-height="225"
     data-close="true"
     data-ad-repeat="true"
     data-ad-repeat-delay="20">
</div>
```

### 8.5 Giới hạn kích thước trên desktop

```html
<div class="xad-outstream"
     data-mode="outstream"
     data-adtag="YOUR_VAST_TAG"
     data-category="travel"
     data-max-width="640"
     data-sticky="bottom-right">
</div>
```

### 8.6 Nhiều player trên 1 trang

```html
<!-- Player 1: Instream ở đầu bài -->
<div class="xad-video"
     data-src="video.m3u8"
     data-adtag="TAG_1"
     data-autoplay="true"
     data-sticky="bottom-right"
     data-ad-breaks="pre,50%,post">
</div>

<!-- Nội dung bài viết... -->

<!-- Player 2: Outstream giữa bài -->
<div class="xad-outstream"
     data-mode="outstream"
     data-adtag="TAG_2"
     data-category="random"
     data-sticky="bottom-left"
     data-ad-repeat="true">
</div>
```

---

## 9. Debug

Thêm `data-debug="true"` rồi mở Console (F12) để xem log:

```
[XAD] category: travel → https://cdn.pubabc.com/travel/main.m3u8
[XAD] Video ratio: 1920x1080 → 56.2500%
[XAD] VAST breaks: [0, 37, 75, 112, -1]
[XAD sticky] normal → STICKY
[XAD] ad #1 started
[XAD sticky] ★ FORCE STICKY
[XAD] ad #1 ended
[XAD sticky] sticky → HIDDEN
[XAD] midroll @ 37
[XAD sticky] ★ FORCE STICKY
[XAD] retry #1 in 5000ms
[XAD] Video lỗi, thử: sport → https://cdn.pubabc.com/sport/main.m3u8
```

---

## 10. JavaScript API

Player expose global object `window.XadPlayer`:

```javascript
// Mount tất cả player trên trang
XadPlayer.mountAll();

// Mount riêng 1 element
XadPlayer.mountInstream(document.getElementById('my-video'));
XadPlayer.mountOutstream(document.getElementById('my-outstream'));

// Mount trong 1 container cụ thể (SPA, lazy load)
XadPlayer.mountAll(document.getElementById('article-content'));
```

---

## 11. Lưu ý khi deploy

1. **Ad tag production**: Thay test ad tag bằng ad tag thật từ Google Ad Manager. Code tự xử lý correlator.

2. **CORS trên CDN**: Video HLS (.m3u8) **bắt buộc** có CORS header. Xem mục 7.

3. **Autoplay policy**: Browser chỉ cho autoplay khi muted. Player tự set `muted` khi `data-autoplay="true"`.

4. **Ad blocker**: Nếu user bật ad blocker, IMA SDK bị chặn → player fallback chạy video bình thường không quảng cáo.

5. **HTTPS**: Google IMA SDK yêu cầu trang phải dùng HTTPS. Trang HTTP sẽ không load được quảng cáo.

6. **Nhiều player**: Mỗi player trên trang hoạt động độc lập. Sticky sẽ chồng nhau nếu cùng vị trí — nên dùng `bottom-right` cho player 1 và `bottom-left` cho player 2.
