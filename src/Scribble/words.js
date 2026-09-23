// ── Scribble It — Bộ từ vựng mặc định ─────────────────────────
// Ưu tiên từ/cụm từ cụ thể, phổ biến, dễ hình dung và dễ vẽ.
// `id` được lưu vào game.wordPackages
// `label` hiển thị trên nút chọn chủ đề và tag mô tả chủ đề.

export const WORD_PACKAGES = {
  animals: {
    label: "Động vật",
    words: [
      "con mèo", "con chó", "con voi", "con hổ", "con sư tử",
      "con gà", "con vịt", "con lợn", "con trâu", "con bò",
      "con ngựa", "con cừu", "con dê", "con thỏ", "con chuột",
      "con cá", "con tôm", "con cua", "con ốc sên", "con bướm",
      "con ong", "con rắn", "con cá sấu", "chim cánh cụt", "con cú",
      "con công", "con vẹt", "con bồ câu", "con nhím", "con sóc",
      "con khỉ", "gấu trúc", "hươu cao cổ", "con ngựa vằn", "con tê giác",
      "cá heo", "cá mập", "con rùa", "con ếch", "con thằn lằn",
      "con bạch tuộc", "con sao biển", "chim sẻ", "con thiên nga",
      "con báo", "con gấu", "con dơi", "con cá vàng", "con kiến",
      "con ruồi", "con muỗi", "con gián",
    ],
  },

  food: {
    label: "Đồ ăn",
    words: [
      "bánh mì", "bánh chưng", "pizza", "phở", "bún bò",
      "cơm tấm", "cơm rang", "xôi", "bánh xèo", "nem rán",
      "bánh cuốn", "hamburger", "khoai tây chiên", "gà rán", "trứng ốp la",
      "trứng luộc", "sữa tươi", "sữa chua", "bơ", "phô mai",
      "cây kem", "kem ốc quế", "chè", "xoài", "chuối",
      "quả táo", "quả cam", "quả dừa", "dưa hấu", "chùm nho",
      "dâu tây", "quả đu đủ", "quả mít", "sầu riêng", "quýt",
      "bưởi", "quả ổi", "bắp ngô", "củ cà rốt", "bí đỏ",
      "dưa chuột", "cà chua", "bông cải", "cây nấm", "củ hành",
      "củ tỏi", "trái ớt", "rau muống", "quả lê", "quả đào",
    ],
  },

  city: {
    label: "Thành phố",
    words: [
      "xe buýt", "xe taxi", "xe đạp", "xe máy", "ô tô",
      "tàu điện", "tàu hỏa", "máy bay", "cây cầu", "cầu vượt",
      "ngã tư", "đèn giao thông", "công viên", "cây xanh", "bồn hoa",
      "tòa nhà", "chung cư", "siêu thị", "khu chợ", "quán cà phê",
      "nhà hàng", "trường học", "bệnh viện", "trạm xăng", "ngân hàng",
      "rạp chiếu phim", "bảo tàng", "thư viện", "bưu điện", "đồn cảnh sát",
      "trạm cứu hỏa", "cột đèn", "vỉa hè", "biển quảng cáo", "đài phun nước",
      "bờ hồ", "ghế đá", "xe cứu thương", "xe cứu hỏa", "xe tải",
      "người bán hàng", "phố đi bộ", "chợ đêm", "thang máy", "thang cuốn",
      "đường hầm", "trạm xe buýt",
    ],
  },

  body: {
    label: "Cơ thể",
    words: [
      "bàn tay", "bàn chân", "ngón tay", "ngón chân", "cánh tay",
      "cái chân", "đầu gối", "cái vai", "cái cổ", "cái đầu",
      "mái tóc", "khuôn mặt", "đôi mắt", "lông mày", "lông mi",
      "cái mũi", "cái miệng", "đôi môi", "cái tai", "hàm răng",
      "cái lưỡi", "cổ tay", "khuỷu tay", "bắp chân", "bắp tay",
      "cái bụng", "cái lưng", "ngực", "trái tim", "bộ não",
      "khung xương", "cái rốn", "móng tay", "đôi má", "cái cằm",
      "cái trán", "ngón tay cái", "đôi mắt to", "cái mũi dài",
      "mái tóc xoăn", "bộ ria mép",
    ],
  },

  emotion: {
    label: "Cảm xúc",
    words: [
      "nụ cười", "tiếng cười", "khóc", "buồn", "tức giận",
      "sợ hãi", "ngạc nhiên", "xấu hổ", "tự hào", "ghen tị",
      "tình yêu", "mỉm cười", "cười khúc khích", "khóc nức nở", "giận dỗi",
      "cáu gắt", "mệt mỏi", "buồn ngủ", "cái ngáp", "hạnh phúc",
      "phấn khích", "hào hứng", "háo hức", "lo lắng", "bồn chồn",
      "bối rối", "hồi hộp", "thất vọng", "bình yên", "thư giãn",
      "thoải mái", "cô đơn", "buồn chán", "chán nản", "ngại ngùng",
      "lúng túng", "hoảng hốt", "vui vẻ", "cười tươi", "nhíu mày",
      "trợn mắt", "vỗ tay", "ôm", "nhảy vui",
    ],
  },

  objects: {
    label: "Đồ vật",
    words: [
      "cái bàn", "cái ghế", "cái giường", "cái tủ", "cái đèn",
      "cây quạt", "cái tivi", "tủ lạnh", "bếp ga", "cái nồi",
      "cái chảo", "cái bát", "cái đĩa", "cái ly", "bình nước",
      "ấm trà", "cái thìa", "đôi đũa", "cái nĩa", "con dao",
      "cái kéo", "cây búa", "cây đinh", "cuốn sách", "quyển vở",
      "bút chì", "cục tẩy", "thước kẻ", "đồng hồ", "điện thoại",
      "máy tính", "cái loa", "tai nghe", "cái gối", "tấm nệm",
      "cái chăn", "tấm rèm", "cái gương", "bàn chải đánh răng", "kem đánh răng",
      "khăn mặt", "xà phòng", "cây chổi", "cái xô", "cây lau nhà",
      "chiếc ô", "cái mũ", "cái áo", "cái quần", "đôi giày",
      "đôi dép", "ba lô", "cái ví", "chiếc nhẫn", "túi xách",
    ],
  },

  nature: {
    label: "Thiên nhiên",
    words: [
      "cây cổ thụ", "cây thông", "cây dừa", "cây tre", "bông hoa",
      "lá cây", "khu rừng", "ngọn núi", "ngọn đồi", "thung lũng",
      "hang động", "thác nước", "dòng sông", "con suối", "hồ nước",
      "bãi cỏ", "cánh đồng", "hòn đảo", "bãi biển", "vách đá",
      "tảng đá", "núi lửa", "mặt trời", "mặt trăng", "cầu vồng",
      "đám mây", "sấm sét", "mưa", "gió", "tuyết",
      "hoa hướng dương", "hoa sen", "hoa hồng", "tổ chim", "tổ kiến",
      "mạng nhện", "quả thông", "cành cây", "cây nấm", "bụi cỏ",
    ],
  },

  professions: {
    label: "Nghề nghiệp",
    words: [
      "bác sĩ", "y tá", "giáo viên", "học sinh", "đầu bếp",
      "cảnh sát", "lính cứu hỏa", "phi công", "thợ xây", "thợ điện",
      "thợ sửa xe", "nông dân", "ngư dân", "ca sĩ", "nhạc sĩ",
      "họa sĩ", "nhiếp ảnh gia", "diễn viên", "vũ công", "nhà khoa học",
      "lập trình viên", "nhân viên bán hàng", "nhân viên giao hàng", "tài xế",
      "thợ cắt tóc", "thợ may", "thợ mộc", "thợ làm bánh", "nhà báo",
      "kỹ sư", "phi hành gia", "huấn luyện viên", "vận động viên",
      "ảo thuật gia", "người đưa thư",
    ],
  },

  vehicles: {
    label: "Phương tiện",
    words: [
      "xe đạp", "xe máy", "xe tay ga", "ô tô", "xe buýt",
      "taxi", "xe tải", "xe cứu thương", "xe cứu hỏa", "xe cảnh sát",
      "xe đua", "xe điện", "xe ba bánh", "tàu hỏa", "tàu điện",
      "tàu cao tốc", "tàu ngầm", "tàu thủy", "thuyền buồm", "ca nô",
      "xuồng", "máy bay", "trực thăng", "khinh khí cầu", "tên lửa",
      "xe tăng", "máy kéo", "xe nâng", "xe cẩu", "xe chở rác",
      "xe cứu hộ", "ván trượt", "ván lướt sóng", "xe ngựa", "tàu vũ trụ",
    ],
  },

  sports: {
    label: "Thể thao",
    words: [
      "quả bóng", "bóng đá", "bóng rổ", "bóng chuyền", "bóng bàn",
      "cầu lông", "tennis", "golf", "bóng chày", "đạp xe",
      "chạy bộ", "bơi lội", "lặn biển", "leo núi", "trượt tuyết",
      "trượt băng", "lướt sóng", "boxing", "karate", "judo",
      "taekwondo", "cử tạ", "bắn cung", "đua xe", "vợt tennis",
      "găng tay boxing", "cúp vô địch", "huy chương", "sân bóng", "khung thành",
      "trọng tài", "cầu thủ", "huấn luyện viên", "đường đua", "bể bơi",
      "sân tennis",
    ],
  },

  technology: {
    label: "Công nghệ",
    words: [
      "điện thoại", "máy tính", "laptop", "máy tính bảng", "bàn phím",
      "chuột máy tính", "màn hình", "tai nghe", "loa", "micro",
      "camera", "máy ảnh", "robot", "drone", "đồng hồ thông minh",
      "kính thực tế ảo", "tay cầm chơi game", "máy chơi game", "USB", "sạc điện thoại",
      "pin", "wifi", "máy in", "máy chiếu", "tivi",
      "điều khiển", "robot hút bụi", "camera an ninh", "dây điện", "ổ cắm",
      "cục sạc", "mã QR",
    ],
  },

  space: {
    label: "Vũ trụ",
    words: [
      "mặt trời", "mặt trăng", "trái đất", "sao Hỏa", "sao Kim",
      "sao Thủy", "sao Mộc", "sao Thổ", "ngôi sao", "hành tinh",
      "tiểu hành tinh", "sao chổi", "phi hành gia", "tàu vũ trụ", "tên lửa",
      "trạm vũ trụ", "người ngoài hành tinh", "robot không gian", "kính thiên văn",
      "thiên thạch", "vệ tinh", "tàu con thoi", "hành tinh xanh",
      "hành tinh đỏ", "cực quang", "vành đai sao Thổ",
    ],
  },

  school: {
    label: "Trường học",
    words: [
      "bảng đen", "phấn", "bút chì", "bút mực", "cục tẩy",
      "thước kẻ", "sách giáo khoa", "quyển vở", "cặp sách", "ba lô",
      "bàn học", "ghế học sinh", "bàn giáo viên", "bảng trắng", "máy chiếu",
      "máy tính", "thư viện", "phòng học", "phòng thí nghiệm", "sân trường",
      "cổng trường", "cây phượng", "trống trường", "đồng phục", "hộp bút",
      "bình nước", "hộp cơm", "giấy kiểm tra", "bài thi", "chuông trường",
      "xe đạp", "căng tin", "sân bóng", "thầy giáo", "cô giáo",
      "học sinh", "giờ ra chơi",
    ],
  },

  clothes: {
    label: "Quần áo",
    words: [
      "áo phông", "áo sơ mi", "áo khoác", "áo len", "áo mưa",
      "quần dài", "quần short", "quần jean", "váy", "đầm",
      "áo vest", "cà vạt", "thắt lưng", "tất", "giày",
      "dép", "ủng", "mũ", "nón lá", "khăn quàng",
      "găng tay", "kính râm", "ba lô", "túi xách", "ví",
      "đồng hồ", "nhẫn", "vòng tay", "vòng cổ", "bông tai",
      "kẹp tóc", "ô", "áo choàng", "đồng phục", "đồ ngủ",
      "đồ bơi", "áo bóng đá", "giày thể thao", "mũ bảo hiểm",
    ],
  },

  music: {
    label: "Âm nhạc",
    words: [
      "đàn guitar", "đàn piano", "đàn violin", "đàn ukulele", "đàn accordion",
      "trống", "kèn", "sáo", "kèn trumpet", "đàn organ",
      "micro", "loa", "tai nghe", "nốt nhạc", "bản nhạc",
      "ca sĩ", "nhạc sĩ", "ban nhạc", "sân khấu", "buổi hòa nhạc",
      "DJ", "đĩa nhạc", "đàn bass", "chuông", "karaoke",
      "hát", "nhảy", "vỗ tay",
    ],
  },

  fantasy: {
    label: "Thế giới phép thuật",
    words: [
      "phù thủy", "pháp sư", "cây đũa phép", "con rồng", "kỳ lân",
      "người khổng lồ", "tiên nữ", "yêu tinh", "người lùn", "ma cà rồng",
      "người sói", "quái vật", "nàng tiên cá", "hiệp sĩ", "công chúa",
      "hoàng tử", "nhà vua", "nữ hoàng", "lâu đài", "tháp phép thuật",
      "kho báu", "rương vàng", "kiếm", "khiên", "vương miện",
      "thuốc phép", "quả cầu pha lê", "sách phép thuật", "chổi bay", "mê cung",
      "hang rồng", "ma", "zombie", "khu rừng phép thuật",
    ],
  },

  travel: {
    label: "Du lịch",
    words: [
      "vali", "hộ chiếu", "vé máy bay", "bản đồ", "la bàn",
      "khách sạn", "lều trại", "ba lô", "máy ảnh", "kính râm",
      "bãi biển", "ngọn núi", "thác nước", "hòn đảo", "chợ đêm",
      "ngôi chùa", "nhà thờ", "lâu đài", "bảo tàng", "ngọn tháp",
      "cây cầu", "tàu du lịch", "máy bay", "xe buýt du lịch", "hướng dẫn viên",
      "quà lưu niệm", "bưu thiếp", "kem chống nắng", "lều", "túi ngủ",
      "bình nước", "cắm trại", "chụp ảnh", "đi biển",
    ],
  },

  toys: {
    label: "Đồ chơi",
    words: [
      "gấu bông", "búp bê", "robot đồ chơi", "ô tô đồ chơi", "máy bay đồ chơi",
      "tàu hỏa đồ chơi", "quả bóng", "diều", "yo-yo", "con quay",
      "xếp hình", "lego", "rubik", "cờ vua", "cờ cá ngựa",
      "bộ bài", "bóng bay", "súng nước", "xe điều khiển", "nhà búp bê",
      "bộ đồ chơi bác sĩ", "bộ màu vẽ", "đất nặn", "chong chóng", "trống đồ chơi",
      "mặt nạ", "cầu trượt", "xích đu", "bập bênh", "bóng rổ mini",
    ],
  },

  weather: {
    label: "Thời tiết",
    words: [
      "mặt trời", "đám mây", "mưa", "mưa phùn", "mưa rào",
      "bão", "sấm", "chớp", "cầu vồng", "tuyết",
      "băng", "gió", "lốc xoáy", "sương mù", "nắng nóng",
      "trời lạnh", "trời nhiều mây", "hoàng hôn", "bình minh", "ô",
      "áo mưa", "ủng đi mưa", "áo khoác", "khăn quàng", "kính râm",
      "kem chống nắng", "mũ", "vũng nước", "giọt mưa", "bông tuyết",
      "tia sét", "mây đen", "mây trắng", "mưa đá", "lá bay",
    ],
  },

  summer: {
    label: "Mùa hè",
    words: [
      "bãi biển", "cây kem", "dưa hấu", "kính râm", "ô che nắng",
      "phao bơi", "bóng biển", "cát", "sóng biển", "cây dừa",
      "nước dừa", "máy ảnh", "mũ", "áo tắm", "lâu đài cát",
      "con cua", "ốc biển", "thuyền", "ván lướt sóng", "khăn tắm",
      "kính bơi", "kem chống nắng", "đá lạnh", "nước chanh", "du lịch",
    ],
  },

  fairytale: {
    label: "Cổ tích",
    words: [
      "công chúa", "hoàng tử", "nhà vua", "nữ hoàng", "lâu đài",
      "con rồng", "kỳ lân", "phù thủy", "nàng tiên", "cây đũa phép",
      "vương miện", "kiếm", "khiên", "kho báu", "rương vàng",
      "khu rừng", "ngôi nhà gỗ", "con sói", "quả táo", "chiếc gương",
      "chàng hiệp sĩ", "nàng tiên cá", "con quạ", "chổi bay", "ngôi tháp",
    ],
  },

  daily: {
    label: "Đời sống hàng ngày",
    words: [
      "đánh răng", "rửa mặt", "ăn cơm", "uống nước", "ngủ",
      "đọc sách", "xem tivi", "đi học", "đi làm", "nấu ăn",
      "quét nhà", "giặt quần áo", "đi xe đạp", "chơi bóng", "đi siêu thị",
      "mua hàng", "uống cà phê", "ăn kem", "chụp ảnh", "nghe nhạc",
      "tắm", "gội đầu", "mặc quần áo", "đi ngủ", "thức dậy",
      "nấu cơm", "rửa bát", "mở cửa", "đóng cửa", "gọi điện thoại",
    ],
  },

  // ── Ca dao & tục ngữ ───────────────────────────────────────
  // Ưu tiên những câu có hình ảnh cụ thể, có thể chia thành
  // 2–3 vật/người/hành động để người chơi dễ thể hiện.

  ca_dao_tuc_ngu: {
    label: "Ca dao & Tục ngữ",
    words: [
      "Ếch ngồi đáy giếng",
      "Cá nằm trên thớt",
      "Nước đến chân mới nhảy",
      "Có công mài sắt có ngày nên kim",
      "Ăn quả nhớ kẻ trồng cây",
      "Uống nước nhớ nguồn",
      "Lá lành đùm lá rách",
      "Một cây làm chẳng nên non",
      "Ba cây chụm lại nên hòn núi cao",
      "Thương người như thể thương thân",
      "Đói cho sạch, rách cho thơm",
      "Tốt gỗ hơn tốt nước sơn",
      "Chớ thấy sóng cả mà ngã tay chèo",
      "Có mới nới cũ",
      "Trâu buộc ghét trâu ăn",
      "Chó treo mèo đậy",
      "Chim có tổ, người có tông",
      "Một con ngựa đau, cả tàu bỏ cỏ",
      "Thẳng như ruột ngựa",
      "Nhanh như thỏ",
      "Chậm như rùa",
      "Khỏe như voi",
      "Đen như mực",
      "Trắng như bông",
      "Đẹp như tiên",
      "Gieo gió gặt bão",
      "Gậy ông đập lưng ông",
      "Lửa thử vàng, gian nan thử sức",
      "Đi một ngày đàng học một sàng khôn",
      "Gần mực thì đen, gần đèn thì sáng",
      "Học thầy không tày học bạn",
      "Tiên học lễ, hậu học văn",
      "Kính trên nhường dưới",
      "Một nắng hai sương",
      "Chân cứng đá mềm",
      "Sau cơn mưa trời lại sáng",
    ],
  },
};