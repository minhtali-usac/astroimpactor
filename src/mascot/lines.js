// Lời thoại, câu hỏi kiểm tra nhanh và bài khái niệm của Chó phi hành gia cho từng phần.
export const LINES = {
  solar: {
    intro: 'Gâu! Mình là Chó phi hành gia. Bấm vào một chấm sáng hoặc gõ “Apophis” để bắt đầu!',
    hints: [
      'Bật “Chỉ vật thể trong danh sách rủi ro” để xem ~1.800 vật thể đáng chú ý.',
      'Tô màu theo “Rủi ro”: chấm càng đỏ, càng đáng theo dõi.',
      'Tua “1 năm / giây”: vật gần Mặt Trời chạy nhanh hơn — định luật Kepler!',
      'Chọn một tiểu hành tinh rồi bấm “Nếu va chạm?” để thử vai Destroyer.',
    ],
    concept: {
      title: 'Thiên thể gần Trái Đất là gì?',
      html: `
<p class="about-lead">Một tiểu hành tinh hay sao chổi được gọi là <b>thiên thể gần Trái Đất (NEO)</b> khi điểm gần Mặt Trời nhất trên quỹ đạo của nó (cận điểm <i>q</i>) nhỏ hơn <b>1,3 AU</b>.</p>
<div class="about-cards">
  <div class="about-card"><span class="ac-n">1</span><h4>Quỹ đạo elip</h4><p>Mỗi thiên thể đi trên một elip có bán trục lớn <i>a</i> và độ lệch tâm <i>e</i>. Cận điểm q = a(1 − e), viễn điểm Q = a(1 + e).</p></div>
  <div class="about-card"><span class="ac-n">2</span><h4>Bốn nhóm NEO</h4><p><b>Atira</b> nằm hẳn trong quỹ đạo Trái Đất; <b>Aten</b> và <b>Apollo</b> cắt quỹ đạo Trái Đất; <b>Amor</b> chỉ tiến lại gần mà không cắt.</p></div>
  <div class="about-card"><span class="ac-n">3</span><h4>Vì sao gần thì nhanh?</h4><p>Định luật Kepler III: chu kỳ T² ∝ a³. Ở gần Mặt Trời, lực hấp dẫn mạnh hơn nên thiên thể phải chạy nhanh hơn để không rơi vào trong.</p></div>
</div>
<p><b>Thang Palermo</b> so sánh nguy cơ của một thiên thể với nguy cơ “nền” tự nhiên: −2 nghĩa là bằng 1% nền, 0 là bằng nền, giá trị dương là đáng quan ngại.</p>`,
    },
    quiz: [
      { q: 'Một tiểu hành tinh nhóm Apollo có đặc điểm gì?', a: ['a > 1 AU và cận điểm q < 1,017 AU — cắt quỹ đạo Trái Đất từ bên ngoài', 'Nằm hoàn toàn bên trong quỹ đạo Trái Đất', 'Không bao giờ tiến gần Trái Đất hơn 1,3 AU'], c: 0, why: 'Apollo có bán trục lớn hơn 1 AU nhưng cận điểm vào trong quỹ đạo Trái Đất, nên quỹ đạo hai bên cắt nhau.' },
      { q: 'Thang Palermo bằng −2 nghĩa là gì?', a: ['Xác suất va chạm là 2%', 'Nguy cơ bằng khoảng 1% nguy cơ nền tự nhiên', 'Thiên thể rộng 2 km'], c: 1, why: 'Thang Palermo là logarit cơ số 10 của tỉ số nguy cơ / nguy cơ nền: 10⁻² = 1%.' },
      { q: 'Vì sao tiểu hành tinh ở gần Mặt Trời chuyển động nhanh hơn?', a: ['Vì chúng nhỏ hơn', 'Vì lực hấp dẫn mạnh hơn nên vận tốc quỹ đạo lớn hơn (định luật Kepler)', 'Vì gió Mặt Trời đẩy chúng'], c: 1, why: 'Phương trình vis-viva: v² = GM(2/r − 1/a). r càng nhỏ, v càng lớn.' },
      { q: 'Khi chỉ biết cấp sao tuyệt đối H, ta cần thêm đại lượng nào để ước tính đường kính?', a: ['Hệ số phản xạ (albedo) của bề mặt', 'Khối lượng', 'Vận tốc'], c: 0, why: 'D = 1329 km / √pᵥ · 10^(−H/5). Cùng độ sáng, vật tối màu phải lớn hơn vật sáng màu.' },
      { q: 'Cấp sao tuyệt đối H giảm 5 đơn vị (sáng hơn) thì đường kính…', a: ['tăng gấp đôi', 'tăng gấp 10 lần', 'không đổi'], c: 1, why: 'D tỉ lệ với 10^(−H/5): giảm H đi 5 làm D tăng 10¹ = 10 lần.' },
    ],
  },
  impact: {
    intro: 'Vai Destroyer! Chọn một sự kiện lịch sử hoặc tự chỉnh rồi bấm “Thả thiên thạch”.',
    hints: [
      'Gấp đôi đường kính → năng lượng gấp 8 lần!',
      'Gấp đôi vận tốc → năng lượng gấp 4 lần.',
      'Thử thiên thạch 20 m, góc 18°: nó nổ trên không như Chelyabinsk.',
      'Nhấp ra đại dương rồi thả thiên thạch 1 km để xem sóng thần.',
    ],
    concept: {
      title: 'Điều gì quyết định sức tàn phá?',
      html: `
<p class="about-lead">Năng lượng của thiên thạch là <b>động năng</b>: E = ½·m·v², với khối lượng m = (π/6)·ρ·D³.</p>
<div class="about-cards">
  <div class="about-card"><span class="ac-n">1</span><h4>Kích thước thắng tất cả</h4><p>Gấp đôi đường kính ⇒ khối lượng gấp 8 ⇒ năng lượng gấp 8. Gấp đôi vận tốc chỉ làm năng lượng gấp 4.</p></div>
  <div class="about-card"><span class="ac-n">2</span><h4>Khí quyển là tấm khiên</h4><p>Áp suất khí động ρ<sub>khí</sub>·v² có thể vượt độ bền của đá. Thiên thạch nhỏ vỡ vụn và nổ trên không — như Tunguska (1908) và Chelyabinsk (2013).</p></div>
  <div class="about-card"><span class="ac-n">3</span><h4>Từ hố đơn giản đến phức tạp</h4><p>Hố lớn hơn khoảng 3,2 km trên Trái Đất sụp xuống dưới trọng lực, tạo vành bậc thang và đỉnh trung tâm.</p></div>
</div>
<p>Năng lượng thường được quy đổi ra <b>megaton TNT</b> (1 Mt = 4,184×10¹⁵ J). Bom Hiroshima ≈ 0,015 Mt; va chạm Chicxulub ≈ 10⁸ Mt.</p>`,
    },
    quiz: [
      { q: 'Gấp đôi đường kính thiên thạch (cùng vận tốc, cùng thành phần), năng lượng va chạm tăng bao nhiêu?', a: ['2 lần', '4 lần', '8 lần'], c: 2, why: 'Khối lượng tỉ lệ với thể tích, tức D³: 2³ = 8.' },
      { q: 'Gấp đôi vận tốc thì động năng tăng bao nhiêu?', a: ['2 lần', '4 lần', '8 lần'], c: 1, why: 'E = ½mv², nên v tăng 2 lần thì E tăng 2² = 4 lần.' },
      { q: 'Vì sao thiên thạch Chelyabinsk (2013) không tạo hố va chạm?', a: ['Vì nó rơi xuống hồ', 'Vì nó vỡ vụn và nổ trên không khi áp suất khí động vượt độ bền', 'Vì nó quá chậm'], c: 1, why: 'Ở độ cao ~30 km, áp suất không khí trên mặt trước thiên thạch đã lớn hơn độ bền của đá.' },
      { q: 'Hố va chạm lớn hơn khoảng 3,2 km trên Trái Đất thường có đặc điểm gì?', a: ['Sụp thành hố phức tạp có đỉnh trung tâm', 'Luôn hình bát tròn trơn', 'Không thể hình thành'], c: 0, why: 'Trọng lực làm thành hố tạm thời sụp xuống, đáy bật lên tạo đỉnh trung tâm.' },
      { q: '1 megaton TNT tương đương bao nhiêu năng lượng?', a: ['4,184×10⁹ J', '4,184×10¹⁵ J', '4,184×10²¹ J'], c: 1, why: '1 tấn TNT = 4,184×10⁹ J, nên 1 triệu tấn = 4,184×10¹⁵ J.' },
    ],
  },
  defense: {
    intro: 'Vai Defender! Đẩy điểm vàng ra khỏi vòng đỏ. Mẹo: phóng tàu thật sớm!',
    hints: [
      'Phóng tàu ngay từ đầu — càng sớm, độ lệch càng lớn.',
      'Laser chỉ mạnh khi tiểu hành tinh đã gần. Để dành cho cuối trận!',
      'Thấy “Trái Đất che khuất”? Chờ vệ tinh quay ra rồi bắn tiếp.',
      'Vòng đỏ lớn hơn Trái Đất vì lực hấp dẫn kéo tiểu hành tinh vào.',
    ],
    concept: {
      title: 'Làm lệch hướng tiểu hành tinh',
      html: `
<p class="about-lead">Không cần phá huỷ tiểu hành tinh: chỉ cần đổi vận tốc của nó một chút, <b>đủ sớm</b>.</p>
<div class="about-cards">
  <div class="about-card"><span class="ac-n">1</span><h4>Va chạm động năng</h4><p>Tàu khối lượng m đâm vào với vận tốc u truyền Δv = β·m·u / M. Vật chất bắn ra từ hố đẩy thêm, nên β > 1 — thí nghiệm DART (2022) đo được β ≈ 3,6.</p></div>
  <div class="about-card"><span class="ac-n">2</span><h4>Đòn bẩy thời gian</h4><p>Một thay đổi Δv nhỏ tích luỹ thành độ lệch Δζ ≈ 3·Δv·t. Đẩy 1 cm/s trước 10 năm làm lệch gần 9.500 km — gần bằng 1,5 lần bán kính Trái Đất.</p></div>
  <div class="about-card"><span class="ac-n">3</span><h4>Mặt phẳng B</h4><p>Mặt phẳng vuông góc với hướng bay, đi qua tâm Trái Đất. Điểm xuyên phải nằm ngoài bán kính bắt giữ b⊕ = R·√(1 + v<sub>esc</sub>²/v∞²) để tiểu hành tinh trượt qua.</p></div>
</div>`,
    },
    quiz: [
      { q: 'Vì sao phát hiện sớm lại quan trọng nhất trong phòng thủ hành tinh?', a: ['Vì tên lửa cần nhiều năm để chế tạo', 'Vì cùng một Δv, tác dụng sớm hơn tạo độ lệch tích luỹ lớn hơn (Δζ ≈ 3·Δv·t)', 'Vì tiểu hành tinh nhỏ dần theo thời gian'], c: 1, why: 'Độ lệch tăng tuyến tính (và hơn thế) theo thời gian còn lại trước va chạm.' },
      { q: 'Hệ số β trong va chạm động năng lớn hơn 1 vì sao?', a: ['Vật chất bắn ra từ hố va chạm tạo thêm lực đẩy', 'Tàu phát nổ khi va chạm', 'Lực hấp dẫn của tàu'], c: 0, why: 'Giống tên lửa: khối vật chất văng ngược lại đẩy tiểu hành tinh về phía trước.' },
      { q: 'Vì sao bán kính bắt giữ b⊕ lớn hơn bán kính Trái Đất?', a: ['Vì khí quyển rất dày', 'Vì lực hấp dẫn bẻ cong đường bay về phía Trái Đất (hội tụ hấp dẫn)', 'Vì Trái Đất quay'], c: 1, why: 'Tiểu hành tinh càng chậm, Trái Đất càng có nhiều thời gian kéo nó lại gần.' },
      { q: 'Nhiệm vụ DART (2022) đã chứng minh điều gì?', a: ['Có thể phá huỷ hoàn toàn một tiểu hành tinh', 'Va chạm động năng làm thay đổi được quỹ đạo của Dimorphos (chu kỳ ngắn đi ~32 phút)', 'Laser có thể đẩy tiểu hành tinh'], c: 1, why: 'Chu kỳ quay của Dimorphos quanh Didymos giảm từ 11 giờ 55 phút xuống khoảng 11 giờ 23 phút.' },
      { q: 'Vì sao laser kém hiệu quả khi tiểu hành tinh còn ở rất xa?', a: ['Ánh sáng không đi xa được', 'Chùm tia loe ra, cường độ trên mục tiêu giảm theo bình phương khoảng cách', 'Tiểu hành tinh phản xạ hết ánh sáng'], c: 1, why: 'Do nhiễu xạ, vết sáng to dần theo khoảng cách nên năng lượng trên mỗi m² giảm mạnh.' },
    ],
  },
};
