import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Compass,
  Sparkles,
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  BookOpen,
  PlusCircle,
  Send,
  CheckCircle2,
  CheckCircle,
  Eye,
  Grid,
  Presentation,
  X,
  Download,
  Lightbulb,
  FileText,
  Loader2,
  Layers,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Award,
  Key,
  ExternalLink,
  Trash2
} from 'lucide-react';

/* ============================================================================
   HẰNG SỐ LƯU TRỮ LOCALSTORAGE
   ============================================================================ */
const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const CUSTOM_PROBLEMS_STORAGE = 'toan_hinh_custom_problems';

/* ============================================================================
   KHO BÀI TOÁN HÌNH HỌC THCS MẪU (CÓ SẴN HÌNH VẼ TỌA ĐỘ & LỜI GIẢI TỪNG DÒNG)
   ============================================================================ */
const SAMPLE_PROBLEMS = [
  {
    id: 'g7_isosceles_median',
    grade: 'Toán 7',
    title: 'Chứng minh hai tam giác bằng nhau & đường cao trong tam giác cân',
    problemText:
      'Cho tam giác ABC cân tại A (AB = AC). Gọi M là trung điểm của cạnh BC. Chứng minh rằng:\na) △ABM = △ACM.\nb) AM vuông góc với BC.',
    given: ['△ABC cân tại A (AB = AC)', 'M là trung điểm của BC (MB = MC)'],
    prove: ['a) △ABM = △ACM', 'b) AM ⊥ BC'],
    geometry: {
      points: [
        { id: 'A', label: 'A', x: 0, y: -115, dx: 0, dy: -16, revealAtStep: 0 },
        { id: 'B', label: 'B', x: -115, y: 85, dx: -15, dy: 14, revealAtStep: 0 },
        { id: 'C', label: 'C', x: 115, y: 85, dx: 15, dy: 14, revealAtStep: 0 },
        { id: 'M', label: 'M', x: 0, y: 85, dx: 0, dy: 18, revealAtStep: 0 }
      ],
      segments: [
        { from: 'A', to: 'B', style: 'solid', color: 'main', ticks: 1, revealAtStep: 0 },
        { from: 'A', to: 'C', style: 'solid', color: 'main', ticks: 1, revealAtStep: 0 },
        { from: 'B', to: 'M', style: 'solid', color: 'main', ticks: 2, revealAtStep: 0 },
        { from: 'M', to: 'C', style: 'solid', color: 'main', ticks: 2, revealAtStep: 0 },
        { from: 'A', to: 'M', style: 'dashed', color: 'accent', ticks: 0, revealAtStep: 0 }
      ],
      circles: [],
      rightAngles: [
        { vertex: 'M', p1: 'A', p2: 'C', revealAtStep: 5 }
      ],
      angleArcs: [
        { vertex: 'M', p1: 'B', p2: 'A', radius: 22, label: '', color: 'accent', revealAtStep: 4 },
        { vertex: 'M', p1: 'A', p2: 'C', radius: 25, label: '', color: 'red', revealAtStep: 4 }
      ]
    },
    solutionSteps: [
      {
        lineText: 'a) Xét △ABM và △ACM, ta có:',
        voiceExplanation:
          'Để chứng minh tam giác A B M bằng tam giác A C M, trước tiên ta xét hai tam giác này và liệt kê các yếu tố bằng nhau đã biết từ đề bài.',
        tip: 'Bước mở đầu: Nêu tên hai tam giác cần xét.',
        highlightSegments: [],
        highlightPoints: ['A', 'B', 'M', 'C'],
        highlightPolygons: [
          { points: ['A', 'B', 'M'], color: 'blue' },
          { points: ['A', 'C', 'M'], color: 'amber' }
        ]
      },
      {
        lineText: '   • AB = AC (giả thiết tam giác ABC cân tại A).',
        voiceExplanation:
          'Yếu tố thứ nhất: Cạnh A B bằng cạnh A C, vì đề bài cho tam giác A B C cân tại đỉnh A.',
        tip: 'Khai thác giả thiết tam giác cân.',
        highlightSegments: ['A-B', 'A-C'],
        highlightPoints: ['A', 'B', 'C'],
        highlightPolygons: []
      },
      {
        lineText: '   • MB = MC (vì M là trung điểm của cạnh BC).',
        voiceExplanation:
          'Yếu tố thứ hai: Đoạn thẳng M B bằng đoạn thẳng M C, do điểm M là trung điểm của cạnh đáy B C.',
        tip: 'Tính chất trung điểm của đoạn thẳng.',
        highlightSegments: ['B-M', 'M-C'],
        highlightPoints: ['B', 'M', 'C'],
        highlightPolygons: []
      },
      {
        lineText: '   • AM là cạnh chung của hai tam giác.',
        voiceExplanation:
          'Yếu tố thứ ba: Hai tam giác A B M và A C M có chung cạnh A M nối từ đỉnh A xuống trung điểm M.',
        tip: 'Nhận diện cạnh chung trên hình vẽ.',
        highlightSegments: ['A-M'],
        highlightPoints: ['A', 'M'],
        highlightPolygons: []
      },
      {
        lineText: '   ⇒ △ABM = △ACM (cạnh – cạnh – cạnh).',
        voiceExplanation:
          'Như vậy, ba cạnh của tam giác A B M lần lượt bằng ba cạnh của tam giác A C M. Ta kết luận hai tam giác bằng nhau theo trường hợp cạnh, cạnh, cạnh.',
        tip: 'Trường hợp bằng nhau thứ nhất của tam giác (c.c.c).',
        highlightSegments: ['A-B', 'A-C', 'A-M', 'B-M', 'M-C'],
        highlightPoints: ['A', 'B', 'M', 'C'],
        highlightPolygons: [
          { points: ['A', 'B', 'M'], color: 'blue' },
          { points: ['A', 'C', 'M'], color: 'emerald' }
        ]
      },
      {
        lineText:
          'b) Từ △ABM = △ACM suy ra ∠AMB = ∠AMC (hai góc tương ứng). Mà ∠AMB + ∠AMC = 180° (hai góc kề bù) nên ∠AMB = ∠AMC = 90° ⇒ AM ⊥ BC (đpcm).',
        voiceExplanation:
          'Sang câu b, từ hai tam giác bằng nhau ta suy ra hai góc ở đỉnh M là góc A M B và góc A M C bằng nhau. Mặt khác, hai góc này kề bù nên có tổng bằng 180 độ. Chia đôi ra, mỗi góc bằng 90 độ, chứng tỏ A M vuông góc với B C.',
        tip: 'Hai góc vừa bằng nhau vừa kề bù thì mỗi góc bằng 90°.',
        highlightSegments: ['A-M', 'B-M', 'M-C'],
        highlightPoints: ['M'],
        highlightPolygons: []
      }
    ]
  },
  {
    id: 'g7_adjacent_bisectors',
    grade: 'Toán 7',
    title: 'Tính góc tạo bởi hai tia phân giác của hai góc kề bù',
    problemText:
      'Cho hai góc kề bù xOz và zOy, biết ∠xOz = 70°. Gọi Om là tia phân giác của góc xOz, On là tia phân giác của góc zOy. Tính số đo góc mOn.',
    given: ['∠xOz và ∠zOy là hai góc kề bù', '∠xOz = 70°', 'Om là tia phân giác của ∠xOz', 'On là tia phân giác của ∠zOy'],
    prove: ['Tính số đo ∠mOn'],
    geometry: {
      points: [
        { id: 'O', label: 'O', x: 0, y: 75, dx: 0, dy: 18, revealAtStep: 0 },
        { id: 'x', label: 'x', x: 185, y: 75, dx: 12, dy: 4, revealAtStep: 0 },
        { id: 'y', label: 'y', x: -185, y: 75, dx: -12, dy: 4, revealAtStep: 0 },
        { id: 'z', label: 'z', x: 58, y: -85, dx: 10, dy: -10, revealAtStep: 0 },
        { id: 'm', label: 'm', x: 142, y: -24, dx: 12, dy: -8, revealAtStep: 1 },
        { id: 'n', label: 'n', x: -96, y: -92, dx: -12, dy: -10, revealAtStep: 3 }
      ],
      segments: [
        { from: 'y', to: 'x', style: 'solid', color: 'main', ticks: 0, revealAtStep: 0 },
        { from: 'O', to: 'z', style: 'solid', color: 'main', ticks: 0, revealAtStep: 0 },
        { from: 'O', to: 'm', style: 'solid', color: 'accent', ticks: 0, revealAtStep: 1 },
        { from: 'O', to: 'n', style: 'solid', color: 'red', ticks: 0, revealAtStep: 3 }
      ],
      circles: [],
      rightAngles: [
        { vertex: 'O', p1: 'm', p2: 'n', revealAtStep: 4 }
      ],
      angleArcs: [
        { vertex: 'O', p1: 'x', p2: 'm', radius: 34, label: '35°', color: 'accent', revealAtStep: 1 },
        { vertex: 'O', p1: 'm', p2: 'z', radius: 38, label: '35°', color: 'accent', revealAtStep: 1 },
        { vertex: 'O', p1: 'z', p2: 'n', radius: 42, label: '55°', color: 'red', revealAtStep: 3 },
        { vertex: 'O', p1: 'n', p2: 'y', radius: 46, label: '55°', color: 'red', revealAtStep: 3 }
      ]
    },
    solutionSteps: [
      {
        lineText: '• Vì ∠xOz và ∠zOy là hai góc kề bù nên: ∠xOz + ∠zOy = 180°.',
        voiceExplanation:
          'Quan sát trên hình, hai tia O x và O y đối nhau nên hai góc x O z và z O y là hai góc kề bù. Do đó tổng số đo của chúng bằng 180 độ.',
        tip: 'Tổng hai góc kề bù luôn bằng 180°.',
        highlightSegments: ['y-x', 'O-z'],
        highlightPoints: ['O', 'x', 'y', 'z'],
        highlightPolygons: []
      },
      {
        lineText: '• Vì tia Om là tia phân giác của ∠xOz nên: ∠mOz = ∠xOz : 2 = 70° : 2 = 35°.',
        voiceExplanation:
          'Tiếp theo, tia O m là tia phân giác của góc x O z, nên tia O m chia góc 70 độ thành hai phần bằng nhau. Suy ra góc m O z bằng 70 độ chia 2, được 35 độ.',
        tip: 'Tia phân giác chia góc thành hai góc bằng nhau.',
        highlightSegments: ['O-m', 'O-z', 'O-x'],
        highlightPoints: ['O', 'm', 'z'],
        highlightPolygons: []
      },
      {
        lineText: '• Ta có: ∠zOy = 180° − ∠xOz = 180° − 70° = 110°.',
        voiceExplanation:
          'Bây giờ ta tính góc kề bù còn lại là góc z O y bằng cách lấy 180 độ trừ đi 70 độ, kết quả bằng 110 độ.',
        tip: 'Tính góc kề bù còn lại.',
        highlightSegments: ['O-z', 'O-y'],
        highlightPoints: ['O', 'z', 'y'],
        highlightPolygons: []
      },
      {
        lineText: '• Vì tia On là tia phân giác của ∠zOy nên: ∠zOn = ∠zOy : 2 = 110° : 2 = 55°.',
        voiceExplanation:
          'Tương tự, tia O n là tia phân giác của góc z O y bằng 110 độ, nên góc z O n bằng một nửa của 110 độ, tức là bằng 55 độ.',
        tip: 'Áp dụng tính chất tia phân giác lần thứ hai.',
        highlightSegments: ['O-n', 'O-z', 'O-y'],
        highlightPoints: ['O', 'n', 'z'],
        highlightPolygons: []
      },
      {
        lineText: '• Tia Oz nằm giữa hai tia Om và On nên: ∠mOn = ∠mOz + ∠zOn = 35° + 55° = 90°.',
        voiceExplanation:
          'Cuối cùng, vì tia O z nằm giữa hai tia O m và O n, ta cộng hai góc thành phần là 35 độ và 55 độ, thu được góc m O n bằng 90 độ. Đây chính là tính chất hai tia phân giác của hai góc kề bù thì vuông góc với nhau.',
        tip: 'Định lí quan trọng: Hai tia phân giác của hai góc kề bù vuông góc với nhau.',
        highlightSegments: ['O-m', 'O-n'],
        highlightPoints: ['O', 'm', 'n'],
        highlightPolygons: []
      }
    ]
  },
  {
    id: 'g8_pythagoras_altitude',
    grade: 'Toán 8',
    title: 'Tính cạnh huyền & đường cao tam giác vuông (Định lí Pythagore)',
    problemText:
      'Cho tam giác ABC vuông tại A có AB = 6 cm, AC = 8 cm. Kẻ đường cao AH vuông góc với cạnh huyền BC (H ∈ BC). Tính độ dài cạnh BC và đường cao AH.',
    given: ['△ABC vuông tại A (∠BAC = 90°)', 'AB = 6 cm, AC = 8 cm', 'AH ⊥ BC tại H'],
    prove: ['Tính độ dài BC và AH'],
    geometry: {
      points: [
        { id: 'B', label: 'B', x: -145, y: 75, dx: -14, dy: 14, revealAtStep: 0 },
        { id: 'C', label: 'C', x: 145, y: 75, dx: 14, dy: 14, revealAtStep: 0 },
        { id: 'A', label: 'A', x: -41, y: -64, dx: 0, dy: -16, revealAtStep: 0 },
        { id: 'H', label: 'H', x: -41, y: 75, dx: 0, dy: 18, revealAtStep: 2 }
      ],
      segments: [
        { from: 'A', to: 'B', style: 'solid', color: 'main', ticks: 0, revealAtStep: 0 },
        { from: 'A', to: 'C', style: 'solid', color: 'main', ticks: 0, revealAtStep: 0 },
        { from: 'B', to: 'C', style: 'solid', color: 'main', ticks: 0, revealAtStep: 0 },
        { from: 'A', to: 'H', style: 'dashed', color: 'red', ticks: 0, revealAtStep: 2 }
      ],
      circles: [],
      rightAngles: [
        { vertex: 'A', p1: 'B', p2: 'C', revealAtStep: 0 },
        { vertex: 'H', p1: 'A', p2: 'C', revealAtStep: 2 }
      ],
      angleArcs: []
    },
    solutionSteps: [
      {
        lineText: '• Áp dụng định lí Pythagore vào △ABC vuông tại A, ta có: BC² = AB² + AC².',
        voiceExplanation:
          'Tam giác A B C vuông tại đỉnh A, nên theo định lí Pi-ta-go, bình phương cạnh huyền B C bằng tổng bình phương hai cạnh góc vuông A B và A C.',
        tip: 'Định lí Pythagore trong tam giác vuông.',
        highlightSegments: ['A-B', 'A-C', 'B-C'],
        highlightPoints: ['A', 'B', 'C'],
        highlightPolygons: [{ points: ['A', 'B', 'C'], color: 'blue' }]
      },
      {
        lineText: '• Thay số: BC² = 6² + 8² = 36 + 64 = 100 ⇒ BC = √100 = 10 (cm).',
        voiceExplanation:
          'Thay số đo A B bằng 6 xăng-ti-mét và A C bằng 8 xăng-ti-mét, ta tính được B C bình phương bằng 36 cộng 64 bằng 100. Lấy căn bậc hai, độ dài cạnh huyền B C bằng 10 xăng-ti-mét.',
        tip: 'Bộ ba số Pythagore quen thuộc: 6 – 8 – 10.',
        highlightSegments: ['B-C'],
        highlightPoints: ['B', 'C'],
        highlightPolygons: []
      },
      {
        lineText: '• Diện tích tam giác ABC vuông tại A được tính theo hai cách: S(ABC) = ½·AB·AC = ½·AH·BC.',
        voiceExplanation:
          'Tiếp theo, để tính đường cao A H, các em hãy biểu diễn diện tích tam giác A B C theo hai cách: một nửa tích hai cạnh góc vuông A B nhân A C, hoặc một nửa tích đường cao A H nhân cạnh đáy B C.',
        tip: 'Phương pháp diện tích để tính đường cao tam giác vuông.',
        highlightSegments: ['A-H', 'A-B', 'A-C', 'B-C'],
        highlightPoints: ['A', 'H'],
        highlightPolygons: [{ points: ['A', 'B', 'C'], color: 'emerald' }]
      },
      {
        lineText: '• Suy ra: AH = (AB · AC) / BC = (6 · 8) / 10 = 48 / 10 = 4,8 (cm).',
        voiceExplanation:
          'Từ đẳng thức trên, rút gọn một phần hai ở hai vế, ta tính được đường cao A H bằng tích A B nhân A C chia cho cạnh huyền B C, tức là 6 nhân 8 chia 10, bằng 4 phẩy 8 xăng-ti-mét.',
        tip: 'Công thức nhanh: Tích hai cạnh góc vuông bằng tích cạnh huyền và đường cao tương ứng.',
        highlightSegments: ['A-H'],
        highlightPoints: ['A', 'H'],
        highlightPolygons: []
      }
    ]
  },
  {
    id: 'g9_two_tangents_chord',
    grade: 'Toán 9',
    title: 'Tính chất hai tiếp tuyến cắt nhau của đường tròn (O)',
    problemText:
      'Từ điểm M nằm ngoài đường tròn (O; R), kẻ hai tiếp tuyến MA, MB tới đường tròn (A, B là các tiếp điểm). Gọi H là giao điểm của OM và AB. Chứng minh OM là đường trung trực của đoạn thẳng AB.',
    given: ['Đường tròn (O; R), điểm M nằm ngoài (O)', 'MA, MB là hai tiếp tuyến tại A và B', 'OM cắt AB tại H'],
    prove: ['OM là đường trung trực của đoạn thẳng AB (OM ⊥ AB và HA = HB)'],
    geometry: {
      points: [
        { id: 'O', label: 'O', x: -70, y: 0, dx: -15, dy: 4, revealAtStep: 0 },
        { id: 'M', label: 'M', x: 145, y: 0, dx: 15, dy: 4, revealAtStep: 0 },
        { id: 'A', label: 'A', x: -35, y: -72, dx: -6, dy: -15, revealAtStep: 0 },
        { id: 'B', label: 'B', x: -35, y: 72, dx: -6, dy: 17, revealAtStep: 0 },
        { id: 'H', label: 'H', x: -35, y: 0, dx: -12, dy: 15, revealAtStep: 0 }
      ],
      segments: [
        { from: 'M', to: 'A', style: 'solid', color: 'main', ticks: 1, revealAtStep: 0 },
        { from: 'M', to: 'B', style: 'solid', color: 'main', ticks: 1, revealAtStep: 0 },
        { from: 'O', to: 'A', style: 'dashed', color: 'accent', ticks: 2, revealAtStep: 0 },
        { from: 'O', to: 'B', style: 'dashed', color: 'accent', ticks: 2, revealAtStep: 0 },
        { from: 'O', to: 'M', style: 'solid', color: 'red', ticks: 0, revealAtStep: 0 },
        { from: 'A', to: 'B', style: 'solid', color: 'main', ticks: 0, revealAtStep: 0 }
      ],
      circles: [
        { center: 'O', radiusPx: 80, style: 'solid', revealAtStep: 0 }
      ],
      rightAngles: [
        { vertex: 'A', p1: 'O', p2: 'M', revealAtStep: 0 },
        { vertex: 'B', p1: 'O', p2: 'M', revealAtStep: 0 },
        { vertex: 'H', p1: 'A', p2: 'M', revealAtStep: 3 }
      ],
      angleArcs: []
    },
    solutionSteps: [
      {
        lineText: '• Xét đường tròn (O) có MA, MB là hai tiếp tuyến cắt nhau tại M (A, B là tiếp điểm).',
        voiceExplanation:
          'Quan sát hình vẽ, từ điểm M nằm ngoài đường tròn tâm O, ta có hai tiếp tuyến M A và M B tiếp xúc với đường tròn tại hai tiếp điểm A và B.',
        tip: 'Nhận dạng giả thiết hai tiếp tuyến cắt nhau.',
        highlightSegments: ['M-A', 'M-B'],
        highlightPoints: ['M', 'A', 'B'],
        highlightPolygons: []
      },
      {
        lineText: '• Theo tính chất hai tiếp tuyến cắt nhau, ta có: MA = MB ⇒ M thuộc đường trung trực của AB (1).',
        voiceExplanation:
          'Theo định lí về hai tiếp tuyến cắt nhau, hai đoạn thẳng M A và M B bằng nhau. Vì điểm M cách đều hai đầu mút A và B, nên M nằm trên đường trung trực của đoạn thẳng A B.',
        tip: 'Điểm cách đều hai đầu mút của đoạn thẳng thì nằm trên đường trung trực của đoạn thẳng đó.',
        highlightSegments: ['M-A', 'M-B'],
        highlightPoints: ['M', 'A', 'B'],
        highlightPolygons: []
      },
      {
        lineText: '• Mặt khác, OA = OB = R (bán kính đường tròn) ⇒ O thuộc đường trung trực của AB (2).',
        voiceExplanation:
          'Mặt khác, hai bán kính O A và O B cùng bằng bán kính R của đường tròn, nên tâm O cũng cách đều hai điểm A và B. Suy ra O nằm trên đường trung trực của đoạn thẳng A B.',
        tip: 'Mọi điểm trên đường tròn đều cách tâm một khoảng bằng bán kính R.',
        highlightSegments: ['O-A', 'O-B'],
        highlightPoints: ['O', 'A', 'B'],
        highlightPolygons: []
      },
      {
        lineText: '• Từ (1) và (2) suy ra đường thẳng OM là đường trung trực của đoạn thẳng AB, hay OM ⊥ AB tại trung điểm H của AB.',
        voiceExplanation:
          'Kết hợp hai điều trên, cả hai điểm O và M cùng thuộc đường trung trực của đoạn thẳng A B. Vậy đường thẳng O M chính là đường trung trực của A B, tức là O M vuông góc với A B tại trung điểm H.',
        tip: 'Đường thẳng đi qua hai điểm phân biệt cùng cách đều A, B là đường trung trực của AB.',
        highlightSegments: ['O-M', 'A-B'],
        highlightPoints: ['O', 'M', 'H', 'A', 'B'],
        highlightPolygons: []
      }
    ]
  }
];

const AI_QUICK_PROMPTS = [
  'Cho tam giác ABC vuông tại A, đường cao AH. Biết AB = 3 cm, AC = 4 cm. Tính độ dài cạnh BC và đường cao AH.',
  'Cho hình chữ nhật ABCD có O là giao điểm hai đường chéo. Lấy điểm E đối xứng với A qua D. Chứng minh tứ giác BCED là hình bình hành.',
  'Cho nửa đường tròn tâm O đường kính AB. Lấy điểm C trên nửa đường tròn (C khác A, B). Kẻ CH vuông góc với AB tại H. Chứng minh tam giác ABC vuông tại C.'
];

/* ============================================================================
   HÀM XỬ LÝ GIỌNG ĐỌC TIẾNG VIỆT (GEMINI TTS + FALLBACK TRÌNH DUYỆT)
   ============================================================================ */
function formatNaturalLectureSpeech(text) {
  return text
    .replace(/△\s*/g, 'tam giác ')
    .replace(/∠\s*/g, 'góc ')
    .replace(/⊥/g, 'vuông góc với')
    .replace(/\/\//g, 'song song với')
    .replace(/⇒/g, 'suy ra')
    .replace(/∈/g, 'thuộc')
    .replace(/½/g, 'một phần hai')
    .replace(/√(\d+)/g, 'căn bậc hai của $1')
    .replace(/(\d+)²/g, '$1 bình phương')
    .replace(/([A-Z]{2})²/g, '$1 bình phương')
    .replace(/\bđpcm\b/gi, 'điều phải chứng minh')
    .replace(/\bgt\b/gi, 'giả thiết')
    .replace(/\bc\.c\.c\b/gi, 'cạnh, cạnh, cạnh')
    .replace(/\bc\.g\.c\b/gi, 'cạnh, góc, cạnh')
    .replace(/\bg\.c\.g\b/gi, 'góc, cạnh, góc')
    .replace(/(\d+)\.(\d+)/g, '$1,$2')
    .replace(/(\d+(?:,\d+)?)\s*°/g, '$1 độ')
    .replace(/(\d+(?:,\d+)?)\s*cm\b/gi, '$1 xăng-ti-mét')
    .replace(/\s+/g, ' ')
    .trim();
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function pcmToWav(pcm16, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function getStrictVietnameseVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const viVoices = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('vi') || name.includes('vietnam') || name.includes('tiếng việt');
  });
  if (!viVoices.length) return null;
  const nonMale = viVoices.filter((v) => !/(namminh|nam minh|male|\bnam\b)/i.test(v.name || ''));
  const pool = nonMale.length ? nonMale : viVoices;
  return pool.find((v) => /(hoaimy|hoài my|google|linh|female|nữ)/i.test(v.name || '')) || pool[0];
}

/* ============================================================================
   BỘ VẼ HÌNH HỌC ĐỘNG TRÊN CANVAS (TỰ ĐỘNG REVEAL & HIGHLIGHT THEO DÒNG GIẢI)
   ============================================================================ */
function renderGeometryScene(ctx, geometry, activeStepIdx, pulsePhase = 0, lightMode = false) {
  if (!geometry) return;
  const pointMap = {};
  (geometry.points || []).forEach((pt) => {
    pointMap[pt.id] = pt;
  });

  const activeStepData = geometry._currentStepMeta || {};
  const hlSegSet = new Set(
    (activeStepData.highlightSegments || []).flatMap((pair) => {
      const parts = pair.split('-').map((s) => s.trim());
      if (parts.length !== 2) return [];
      return [`${parts[0]}-${parts[1]}`, `${parts[1]}-${parts[0]}`];
    })
  );
  const hlPointSet = new Set(activeStepData.highlightPoints || []);
  const hlPolygons = activeStepData.highlightPolygons || [];

  const mainStroke = lightMode ? '#0f172a' : '#f8fafc';
  const accentStroke = lightMode ? '#2563eb' : '#38bdf8';
  const redStroke = lightMode ? '#dc2626' : '#f87171';

  // 1. Tô màu vùng đa giác (tam giác / tứ giác) đang được xét ở dòng giải hiện tại
  hlPolygons.forEach((poly) => {
    const pts = (poly.points || []).map((id) => pointMap[id]).filter(Boolean);
    if (pts.length < 3) return;
    ctx.save();
    const alpha = 0.16 + 0.06 * Math.sin(pulsePhase * Math.PI * 2);
    if (poly.color === 'amber') {
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    } else if (poly.color === 'emerald') {
      ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    } else {
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // 2. Vẽ các đường tròn đã xuất hiện tới bước hiện tại
  (geometry.circles || []).forEach((circ) => {
    if ((circ.revealAtStep || 0) > activeStepIdx) return;
    const center = pointMap[circ.center];
    if (!center) return;
    ctx.save();
    ctx.strokeStyle = mainStroke;
    ctx.lineWidth = 2.2;
    if (circ.style === 'dashed') ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, circ.radiusPx || 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // 3. Vẽ các đoạn thẳng & làm nổi bật đoạn đang phân tích
  (geometry.segments || []).forEach((seg) => {
    if ((seg.revealAtStep || 0) > activeStepIdx) return;
    const p1 = pointMap[seg.from];
    const p2 = pointMap[seg.to];
    if (!p1 || !p2) return;

    const isHighlighted = hlSegSet.has(`${seg.from}-${seg.to}`);
    let strokeColor = mainStroke;
    if (seg.color === 'accent') strokeColor = accentStroke;
    else if (seg.color === 'red') strokeColor = redStroke;

    // Hào quang phát sáng nếu đoạn thẳng đang được giảng tới
    if (isHighlighted && !lightMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
      ctx.lineWidth = 8 + 2.5 * Math.sin(pulsePhase * Math.PI * 2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = isHighlighted ? (lightMode ? '#d97706' : '#facc15') : strokeColor;
    ctx.lineWidth = isHighlighted ? 3.4 : 2.3;
    ctx.lineCap = 'round';
    if (seg.style === 'dashed') ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();

    // Ký hiệu các đoạn thẳng bằng nhau (vạch gạch ngang)
    if (seg.ticks && seg.ticks > 0) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const nx = -uy;
      const ny = ux;
      ctx.save();
      ctx.strokeStyle = lightMode ? '#dc2626' : '#fbbf24';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < seg.ticks; i++) {
        const off = (i - (seg.ticks - 1) / 2) * 4.5;
        const cx = mx + ux * off;
        const cy = my + uy * off;
        ctx.beginPath();
        ctx.moveTo(cx - nx * 5.5, cy - ny * 5.5);
        ctx.lineTo(cx + nx * 5.5, cy + ny * 5.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  });

  // 4. Vẽ ký hiệu góc vuông
  (geometry.rightAngles || []).forEach((ra) => {
    if ((ra.revealAtStep || 0) > activeStepIdx) return;
    const v = pointMap[ra.vertex];
    const p1 = pointMap[ra.p1];
    const p2 = pointMap[ra.p2];
    if (!v || !p1 || !p2) return;

    const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
    const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
    const sz = 12;

    const q1x = v.x + Math.cos(a1) * sz;
    const q1y = v.y + Math.sin(a1) * sz;
    const q2x = v.x + Math.cos(a2) * sz;
    const q2y = v.y + Math.sin(a2) * sz;
    const q3x = q1x + Math.cos(a2) * sz;
    const q3y = q1y + Math.sin(a2) * sz;

    ctx.save();
    ctx.strokeStyle = redStroke;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(q1x, q1y);
    ctx.lineTo(q3x, q3y);
    ctx.lineTo(q2x, q2y);
    ctx.stroke();
    ctx.restore();
  });

  // 5. Vẽ cung góc & nhãn số đo
  (geometry.angleArcs || []).forEach((arc) => {
    if ((arc.revealAtStep || 0) > activeStepIdx) return;
    const v = pointMap[arc.vertex];
    const p1 = pointMap[arc.p1];
    const p2 = pointMap[arc.p2];
    if (!v || !p1 || !p2) return;

    const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
    const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
    let diff = a2 - a1;
    while (diff <= -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const color = arc.color === 'red' ? redStroke : accentStroke;
    const r = arc.radius || 26;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(v.x, v.y, r, a1, a1 + diff, diff < 0);
    ctx.stroke();

    if (arc.label) {
      const mid = a1 + diff / 2;
      ctx.font = "bold 11.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arc.label, v.x + Math.cos(mid) * (r + 16), v.y + Math.sin(mid) * (r + 16));
    }
    ctx.restore();
  });

  // 6. Vẽ các điểm & nhãn tên điểm
  (geometry.points || []).forEach((pt) => {
    if ((pt.revealAtStep || 0) > activeStepIdx) return;
    const isHl = hlPointSet.has(pt.id);

    if (isHl && !lightMode) {
      ctx.save();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9 + 3 * Math.sin(pulsePhase * Math.PI * 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = isHl ? (lightMode ? '#d97706' : '#facc15') : mainStroke;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isHl ? 4.8 : 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = lightMode ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    if (pt.label) {
      ctx.font = "italic bold 16px 'Times New Roman', Georgia, serif";
      ctx.fillStyle = isHl ? (lightMode ? '#b45309' : '#fde047') : mainStroke;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pt.label, pt.x + (pt.dx ?? 0), pt.y + (pt.dy ?? -15));
    }
    ctx.restore();
  });
}

/* ============================================================================
   COMPONENT CHÍNH CỦA ỨNG DỤNG
   ============================================================================ */
export default function App() {
  // Quản lý Gemini API Key trong localStorage
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Danh sách bài toán tự tạo bằng AI lưu trong localStorage
  const [customProblems, setCustomProblems] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PROBLEMS_STORAGE);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Hợp nhất bài toán AI tự tạo (đứng đầu) + kho bài mẫu
  const problems = useMemo(() => {
    return [...customProblems, ...SAMPLE_PROBLEMS];
  }, [customProblems]);

  const [selectedProblemId, setSelectedProblemId] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PROBLEMS_STORAGE);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
        return parsed[0].id;
      }
    } catch {
      // Bỏ qua lỗi đọc storage
    }
    return SAMPLE_PROBLEMS[0].id;
  });

  // Chỉ số dòng lời giải hiện tại đang giảng (0 -> solutionSteps.length - 1)
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showAllLines, setShowAllLines] = useState(false);
  const [isAutoTeaching, setIsAutoTeaching] = useState(false);

  // Tùy chọn hiển thị & âm thanh
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isPresentation, setIsPresentation] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pulsePhase, setPulsePhase] = useState(0);

  // Modal nhập đề bài toán mới để AI tự giải & vẽ hình
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const canvasRef = useRef(null);
  const solutionListRef = useRef(null);
  const currentAudioRef = useRef(null);
  const ttsAbortRef = useRef(null);
  const ttsCacheRef = useRef(new Map());
  const autoAdvanceTimerRef = useRef(null);

  const activeProblem = useMemo(
    () => problems.find((p) => p.id === selectedProblemId) || problems[0],
    [problems, selectedProblemId]
  );

  const isCurrentCustom = useMemo(
    () => customProblems.some((p) => p.id === activeProblem.id),
    [customProblems, activeProblem.id]
  );

  const totalSteps = activeProblem.solutionSteps.length;
  const activeStep = activeProblem.solutionSteps[currentStepIdx] || activeProblem.solutionSteps[0];

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 3400);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Đồng bộ bài toán tự tạo vào localStorage mỗi khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROBLEMS_STORAGE, JSON.stringify(customProblems));
    } catch {
      // Bỏ qua nếu trình duyệt chặn lưu trữ
    }
  }, [customProblems]);

  // Mở modal Cài đặt API Key
  const handleOpenApiKeyModal = () => {
    setApiKeyInput(geminiApiKey);
    setApiKeyModalOpen(true);
  };

  // Lưu hoặc xóa API Key trong localStorage
  const handleSaveApiKey = () => {
    const cleaned = apiKeyInput.trim();
    setGeminiApiKey(cleaned);
    try {
      if (cleaned) {
        localStorage.setItem(API_KEY_STORAGE, cleaned);
        showToast('Đã lưu Gemini API Key vào trình duyệt!');
      } else {
        localStorage.removeItem(API_KEY_STORAGE);
        showToast('Đã xóa Gemini API Key khỏi trình duyệt.');
      }
    } catch {
      showToast('Không thể lưu vào trình duyệt.');
    }
    setApiKeyModalOpen(false);
  };

  // Dừng mọi luồng âm thanh & hẹn giờ chuyển dòng
  const stopSpeechAndTimers = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {
        // Bỏ qua lỗi dừng audio
      }
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsLoadingVoice(false);
  }, []);

  useEffect(() => {
    const cache = ttsCacheRef.current;
    return () => {
      stopSpeechAndTimers();
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, [stopSpeechAndTimers]);

  // Nhịp nhấp nháy nhẹ cho đối tượng đang được highlight trên hình vẽ
  useEffect(() => {
    let rafId;
    const loop = (now) => {
      setPulsePhase((now / 1400) % 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Cuộn mượt danh sách lời giải tới dòng đang giảng
  useEffect(() => {
    const container = solutionListRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-step-idx="${currentStepIdx}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStepIdx]);

  // Đọc lời giải thích cho dòng hiện tại bằng giọng nữ miền Bắc truyền cảm (Gemini TTS)
  const narrateStep = useCallback(
    async (stepIdx, autoNextAfterFinish = false, forceVoice = false) => {
      const stepObj = activeProblem.solutionSteps[stepIdx];
      if (!stepObj) return;

      stopSpeechAndTimers();

      const advanceIfNeeded = () => {
        if (!autoNextAfterFinish) return;
        if (stepIdx < activeProblem.solutionSteps.length - 1) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            setCurrentStepIdx(stepIdx + 1);
          }, 650);
        } else {
          setIsAutoTeaching(false);
          showToast('Đã hoàn thành bài giảng lời giải!');
        }
      };

      if (!voiceEnabled && !forceVoice) {
        if (autoNextAfterFinish) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            advanceIfNeeded();
          }, 3200);
        }
        return;
      }

      const rawSpeech = stepObj.voiceExplanation || stepObj.lineText;
      const naturalSpeech = formatNaturalLectureSpeech(rawSpeech);
      const cacheKey = `${activeProblem.id}::${stepIdx}::${naturalSpeech}`;

      const playWav = (wavUrl) => {
        const audio = new Audio(wavUrl);
        currentAudioRef.current = audio;
        audio.onended = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          advanceIfNeeded();
        };
        audio.onerror = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          advanceIfNeeded();
        };
        audio.play().catch(() => {
          advanceIfNeeded();
        });
      };

      if (ttsCacheRef.current.has(cacheKey)) {
        playWav(ttsCacheRef.current.get(cacheKey));
        return;
      }

      const apiKey = geminiApiKey.trim();
      let audioData = null;
      let mimeType = '';

      if (apiKey) {
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        setIsLoadingVoice(true);

        const prompt = `Hãy đóng vai cô giáo dạy Toán THCS giọng nữ chuẩn miền Bắc (Hà Nội), dịu dàng, rõ ràng, truyền cảm, đọc lời giảng giải thích bài toán hình học sau cho học sinh hiểu bài:\n\n"${naturalSpeech}"`;
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Sulafat' }
              }
            }
          },
          model: 'gemini-2.5-flash-preview-tts'
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

        for (let attempt = 0; attempt < 3; attempt++) {
          if (controller.signal.aborted) return;
          try {
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const part = data?.candidates?.[0]?.content?.parts?.[0];
            audioData = part?.inlineData?.data;
            mimeType = part?.inlineData?.mimeType || '';
            if (audioData && mimeType.startsWith('audio/')) break;
          } catch (err) {
            if (err?.name === 'AbortError' || controller.signal.aborted) return;
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
          }
        }

        if (controller.signal.aborted) return;
        setIsLoadingVoice(false);
      }

      if (audioData && mimeType.startsWith('audio/')) {
        const rateMatch = mimeType.match(/rate=(\d+)/i);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const pcmBuffer = base64ToArrayBuffer(audioData);
        const pcm16 = new Int16Array(pcmBuffer);
        const wavBlob = pcmToWav(pcm16, sampleRate);
        const wavUrl = URL.createObjectURL(wavBlob);
        ttsCacheRef.current.set(cacheKey, wavUrl);
        playWav(wavUrl);
        return;
      }

      // Fallback sang giọng tiếng Việt có sẵn trên thiết bị nếu chưa nhập Key hoặc mất mạng
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const viVoice = getStrictVietnameseVoice();
        if (viVoice) {
          const utter = new SpeechSynthesisUtterance(naturalSpeech);
          utter.voice = viVoice;
          utter.lang = 'vi-VN';
          utter.rate = 0.95;
          utter.onend = () => advanceIfNeeded();
          utter.onerror = () => advanceIfNeeded();
          window.speechSynthesis.speak(utter);
          return;
        }
      }

      advanceIfNeeded();
    },
    [activeProblem, voiceEnabled, geminiApiKey, stopSpeechAndTimers, showToast]
  );

  // Tự động giảng khi bật chế độ Tự động giảng từng dòng
  useEffect(() => {
    if (!isAutoTeaching) return;
    narrateStep(currentStepIdx, true, false);
  }, [isAutoTeaching, currentStepIdx, narrateStep]);

  // Chuyển sang bài toán khác
  const handleSelectProblem = (probId) => {
    stopSpeechAndTimers();
    setIsAutoTeaching(false);
    setSelectedProblemId(probId);
    setCurrentStepIdx(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Xóa một bài toán tự tạo khỏi localStorage
  const handleDeleteCurrentCustomProblem = () => {
    if (!isCurrentCustom) return;
    stopSpeechAndTimers();
    setIsAutoTeaching(false);
    const remaining = customProblems.filter((p) => p.id !== activeProblem.id);
    setCustomProblems(remaining);
    const nextId = remaining.length > 0 ? remaining[0].id : SAMPLE_PROBLEMS[0].id;
    setSelectedProblemId(nextId);
    setCurrentStepIdx(0);
    showToast('Đã xóa bài toán tự tạo khỏi danh sách.');
  };

  // Bấm vào một dòng giải cụ thể -> hiện đến dòng đó + tô sáng hình + đọc giải thích
  const handleClickStep = (idx) => {
    setIsAutoTeaching(false);
    setCurrentStepIdx(idx);
    narrateStep(idx, false, false);
  };

  const handleToggleAutoTeach = () => {
    if (isAutoTeaching) {
      stopSpeechAndTimers();
      setIsAutoTeaching(false);
    } else {
      if (currentStepIdx >= totalSteps - 1) {
        setCurrentStepIdx(0);
      }
      setIsAutoTeaching(true);
    }
  };

  // Kết xuất Canvas hình vẽ theo dòng giải hiện tại
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;

    const draw = () => {
      const rect = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
      ctx.scale(zoom, zoom);

      if (showGrid) {
        const step = 40;
        const halfW = w / (2 * zoom) + Math.abs(pan.x) / zoom + step;
        const halfH = h / (2 * zoom) + Math.abs(pan.y) / zoom + step;
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (let gx = Math.floor(-halfW / step) * step; gx <= halfW; gx += step) {
          ctx.moveTo(gx, -halfH);
          ctx.lineTo(gx, halfH);
        }
        for (let gy = Math.floor(-halfH / step) * step; gy <= halfH; gy += step) {
          ctx.moveTo(-halfW, gy);
          ctx.lineTo(halfW, gy);
        }
        ctx.stroke();
      }

      const geomWithStep = {
        ...activeProblem.geometry,
        _currentStepMeta: activeStep
      };
      renderGeometryScene(ctx, geomWithStep, currentStepIdx, pulsePhase, false);

      ctx.restore();
    };

    draw();

    let ro = null;
    if (parent && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => draw());
      ro.observe(parent);
    }
    window.addEventListener('resize', draw);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [activeProblem, activeStep, currentStepIdx, pulsePhase, showGrid, zoom, pan, isPresentation]);

  // Xuất ảnh PNG nền trắng sạch để giáo viên chèn vào Word/PowerPoint
  const handleExportPNG = () => {
    try {
      const off = document.createElement('canvas');
      off.width = 1100;
      off.height = 750;
      const ctx = off.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, off.width, off.height);

      ctx.save();
      ctx.translate(off.width / 2, off.height / 2);
      ctx.scale(1.3, 1.3);
      renderGeometryScene(
        ctx,
        { ...activeProblem.geometry, _currentStepMeta: {} },
        totalSteps - 1,
        0,
        true
      );
      ctx.restore();

      const link = document.createElement('a');
      link.download = `${activeProblem.id}_hinh_ve.png`;
      link.href = off.toDataURL('image/png');
      link.click();
      showToast('Đã tải ảnh hình vẽ PNG nền trắng!');
    } catch {
      showToast('Không thể xuất ảnh PNG.');
    }
  };

  // Gọi Gemini 2.5 Flash để tự động vẽ hình tọa độ & giải từng dòng cho đề bài giáo viên nhập vào
  const handleGenerateCustomProblem = async () => {
    const trimmed = customPromptInput.trim();
    if (!trimmed) {
      showToast('Bạn hãy nhập đề bài toán hình học trước nhé!');
      return;
    }

    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      showToast('Bạn cần nhập Gemini API Key miễn phí trước khi dùng AI!');
      setApiKeyInput('');
      setApiKeyModalOpen(true);
      return;
    }

    setIsGeneratingAI(true);
    stopSpeechAndTimers();
    setIsAutoTeaching(false);

    const systemPrompt = `Bạn là giáo viên Toán THCS xuất sắc tại Việt Nam. Nhiệm vụ của bạn là nhận một đề bài toán hình học phẳng THCS và tạo ra dữ liệu JSON gồm:
1. Tóm tắt Giả thiết (given) và Kết luận (prove).
2. Tọa độ hình học 2D chuẩn xác trên hệ tọa độ Canvas tâm (0,0), trục x hướng sang phải (-180 đến 180), trục y hướng xuống dưới (-130 đến 130). Đảm bảo các tính chất hình học (vuông góc, trung điểm, đường tròn, tiếp tuyến, song song) khớp đúng hình học phẳng!
3. Lời giải chi tiết chia thành 4 đến 7 dòng tuần tự (solutionSteps). Mỗi dòng gồm:
   - lineText: Câu trình bày ngắn gọn, chuẩn mực như viết trên bảng.
   - voiceExplanation: Lời giảng tự nhiên, ấm áp, giải thích cặn kẽ vì sao có bước đó cho học sinh hiểu.
   - tip: Tên định lí/tính chất áp dụng.
   - highlightSegments: Mảng các cặp điểm dạng "A-B" cần phát sáng trên hình vẽ ở dòng này.
   - highlightPoints: Mảng tên các điểm cần làm nổi bật ở dòng này.
   - highlightPolygons: Mảng các đa giác cần tô màu bán trong suốt (nếu đang xét hai tam giác hoặc tứ giác).`;

    const payload = {
      contents: [{ parts: [{ text: `Hãy dựng hình tọa độ chuẩn xác và giải chi tiết từng dòng bài toán hình học sau:\n\n"${trimmed}"` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            grade: { type: 'STRING' },
            title: { type: 'STRING' },
            problemText: { type: 'STRING' },
            given: { type: 'ARRAY', items: { type: 'STRING' } },
            prove: { type: 'ARRAY', items: { type: 'STRING' } },
            geometry: {
              type: 'OBJECT',
              properties: {
                points: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      label: { type: 'STRING' },
                      x: { type: 'NUMBER' },
                      y: { type: 'NUMBER' },
                      dx: { type: 'NUMBER' },
                      dy: { type: 'NUMBER' },
                      revealAtStep: { type: 'INTEGER' }
                    },
                    required: ['id', 'label', 'x', 'y', 'dx', 'dy', 'revealAtStep']
                  }
                },
                segments: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      from: { type: 'STRING' },
                      to: { type: 'STRING' },
                      style: { type: 'STRING' },
                      color: { type: 'STRING' },
                      ticks: { type: 'INTEGER' },
                      revealAtStep: { type: 'INTEGER' }
                    },
                    required: ['from', 'to', 'style', 'color', 'ticks', 'revealAtStep']
                  }
                },
                circles: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      center: { type: 'STRING' },
                      radiusPx: { type: 'NUMBER' },
                      style: { type: 'STRING' },
                      revealAtStep: { type: 'INTEGER' }
                    },
                    required: ['center', 'radiusPx', 'style', 'revealAtStep']
                  }
                },
                rightAngles: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      vertex: { type: 'STRING' },
                      p1: { type: 'STRING' },
                      p2: { type: 'STRING' },
                      revealAtStep: { type: 'INTEGER' }
                    },
                    required: ['vertex', 'p1', 'p2', 'revealAtStep']
                  }
                },
                angleArcs: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      vertex: { type: 'STRING' },
                      p1: { type: 'STRING' },
                      p2: { type: 'STRING' },
                      radius: { type: 'NUMBER' },
                      label: { type: 'STRING' },
                      color: { type: 'STRING' },
                      revealAtStep: { type: 'INTEGER' }
                    },
                    required: ['vertex', 'p1', 'p2', 'radius', 'label', 'color', 'revealAtStep']
                  }
                }
              },
              required: ['points', 'segments', 'circles', 'rightAngles', 'angleArcs']
            },
            solutionSteps: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  lineText: { type: 'STRING' },
                  voiceExplanation: { type: 'STRING' },
                  tip: { type: 'STRING' },
                  highlightSegments: { type: 'ARRAY', items: { type: 'STRING' } },
                  highlightPoints: { type: 'ARRAY', items: { type: 'STRING' } },
                  highlightPolygons: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        points: { type: 'ARRAY', items: { type: 'STRING' } },
                        color: { type: 'STRING' }
                      },
                      required: ['points', 'color']
                    }
                  }
                },
                required: ['lineText', 'voiceExplanation', 'tip', 'highlightSegments', 'highlightPoints', 'highlightPolygons']
              }
            }
          },
          required: ['grade', 'title', 'problemText', 'given', 'prove', 'geometry', 'solutionSteps']
        }
      }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let parsed = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          parsed = JSON.parse(rawJson);
          break;
        }
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    setIsGeneratingAI(false);

    if (parsed && parsed.solutionSteps && parsed.solutionSteps.length > 0) {
      const newId = `ai_problem_${Date.now()}`;
      const createdProblem = {
        id: newId,
        grade: parsed.grade || 'Toán THCS (AI)',
        title: parsed.title || 'Bài toán hình học tự nhập',
        problemText: parsed.problemText || trimmed,
        given: parsed.given || [],
        prove: parsed.prove || [],
        geometry: parsed.geometry,
        solutionSteps: parsed.solutionSteps
      };
      setCustomProblems((prev) => [createdProblem, ...prev]);
      setSelectedProblemId(newId);
      setCurrentStepIdx(0);
      setCustomModalOpen(false);
      setCustomPromptInput('');
      setZoom(1);
      setPan({ x: 0, y: 0 });
      showToast('AI đã dựng hình, giải từng dòng và lưu vào trình duyệt!');
    } else {
      showToast('Không thể phân tích đề bài. Hãy kiểm tra lại Gemini API Key hoặc thử lại nhé!');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0b1120] text-slate-100 font-sans select-none">
      {/* ========================================================================
          THANH TIÊU ĐỀ & CÔNG CỤ TRÊN CÙNG (HEADER)
         ======================================================================== */}
      {!isPresentation && (
        <header className="h-14 shrink-0 bg-[#111827] border-b border-slate-800 px-4 flex items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-950/60 shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                  Giải & Vẽ Hình Toán Hình Học THCS
                </h1>
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Đồng bộ Hình vẽ • Lời giải • Giọng giảng AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                Hiện lần lượt từng dòng giải • Tự động tô sáng hình vẽ theo dòng • Giọng nữ miền Bắc giải thích cho học sinh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenApiKeyModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                geminiApiKey
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
              title="Cài đặt Gemini API Key cá nhân (lưu an toàn trên trình duyệt)"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {geminiApiKey ? 'Đã có API Key' : 'Cài đặt API Key'}
              </span>
            </button>

            <button
              onClick={() => setCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nhập đề bài mới (AI)</span>
            </button>

            <button
              onClick={handleExportPNG}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Tải ảnh hình vẽ nền trắng chuẩn in đề thi"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Ảnh PNG</span>
            </button>

            <button
              onClick={() => setIsPresentation(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
              title="Mở rộng toàn màn hình trình chiếu lớp học"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trình chiếu</span>
            </button>
          </div>
        </header>
      )}

      {/* ========================================================================
          KHU VỰC NỘI DUNG CHÍNH: BẢNG HÌNH VẼ (TRÁI) & BẢNG LỜI GIẢI TỪNG DÒNG (PHẢI)
         ======================================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* CỘT TRÁI: CHỌN BÀI TOÁN + BẢNG VẼ HÌNH HỌC ĐỘNG */}
        <section className="flex-1 flex flex-col min-w-0 min-h-[45%] lg:min-h-0 bg-[#090d16] border-b lg:border-b-0 lg:border-r border-slate-800 relative">
          {/* Thanh chọn bài toán mẫu */}
          {!isPresentation && (
            <div className="shrink-0 bg-[#0f172a] border-b border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                <select
                  value={activeProblem.id}
                  onChange={(e) => handleSelectProblem(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-100 max-w-full truncate focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {problems.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.grade}] {p.title}
                    </option>
                  ))}
                </select>
                {isCurrentCustom && (
                  <button
                    onClick={handleDeleteCurrentCustomProblem}
                    className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 shrink-0 transition"
                    title="Xóa bài toán tự tạo này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowGrid((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition ${
                    showGrid
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <Grid className="w-3 h-3" /> Lưới
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                  className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
                  className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  title="Căn giữa"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Khung hiển thị Đề bài & Giả thiết / Kết luận */}
          <div className="shrink-0 bg-slate-900/75 border-b border-slate-800/80 px-4 py-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-line font-medium">
                <span className="text-amber-400 font-bold mr-1.5">Đề bài:</span>
                {activeProblem.problemText}
              </p>
              {isPresentation && (
                <button
                  onClick={() => setIsPresentation(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shrink-0"
                >
                  <X className="w-3.5 h-3.5" /> Thoát
                </button>
              )}
            </div>

            {(activeProblem.given?.length > 0 || activeProblem.prove?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold text-sky-400 uppercase tracking-wider mr-1.5">GT:</span>
                  <span className="text-slate-300">{activeProblem.given.join(' ; ')}</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider mr-1.5">KL:</span>
                  <span className="text-slate-300">{activeProblem.prove.join(' ; ')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Vùng vẽ Canvas tương tác (kéo thả, thu phóng, highlight tự động) */}
          <div
            className={`flex-1 min-h-0 relative ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={(e) => {
              const f = e.deltaY < 0 ? 1.1 : 0.9;
              setZoom((z) => Math.max(0.6, Math.min(2.2, +(z * f).toFixed(2))));
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              setIsPanning(true);
              setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }}
            onMouseMove={(e) => {
              if (!isPanning) return;
              setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
            }}
            onMouseUp={() => setIsPanning(false)}
            onMouseLeave={() => setIsPanning(false)}
          >
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Chú thích trạng thái hình vẽ ở góc dưới Canvas */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
              <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>
                  Đang minh họa <strong className="text-amber-300">Dòng {currentStepIdx + 1}/{totalSteps}</strong> trên hình vẽ
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CỘT PHẢI: BẢNG TRÌNH BÀY LỜI GIẢI TỪNG DÒNG & GIỌNG GIẢNG AI */}
        <aside className="w-full lg:w-[460px] xl:w-[510px] shrink-0 bg-[#0f172a] flex flex-col min-h-[55%] lg:min-h-0">
          {/* Thanh điều khiển chế độ hiện lời giải & giọng đọc */}
          <div className="shrink-0 bg-[#111827] border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Lời giải chi tiết ({currentStepIdx + 1}/{totalSteps} dòng)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowAllLines((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  showAllLines
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Chuyển đổi giữa hiện từng dòng đến bước hiện tại hoặc hiện cả bài"
              >
                <Eye className="w-3 h-3" />
                <span>{showAllLines ? 'Đang hiện cả bài' : 'Hiện từng dòng'}</span>
              </button>

              <button
                onClick={() => {
                  const next = !voiceEnabled;
                  setVoiceEnabled(next);
                  if (!next) {
                    stopSpeechAndTimers();
                  } else {
                    narrateStep(currentStepIdx, false, true);
                  }
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  voiceEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bật/tắt giọng cô giáo giải thích"
              >
                {voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                <span>{!voiceEnabled ? 'Tắt tiếng' : isLoadingVoice ? 'Đang đọc...' : 'Giọng giảng'}</span>
              </button>
            </div>
          </div>

          {/* Danh sách các dòng lời giải xuất hiện tuần tự */}
          <div ref={solutionListRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeProblem.solutionSteps.map((step, idx) => {
              const isVisible = showAllLines || idx <= currentStepIdx;
              const isActive = idx === currentStepIdx;
              const isPast = idx < currentStepIdx;

              if (!isVisible) return null;

              return (
                <div
                  key={idx}
                  data-step-idx={idx}
                  onClick={() => handleClickStep(idx)}
                  className={`rounded-2xl p-3.5 border transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-br from-blue-950/80 to-indigo-950/60 border-blue-500/80 shadow-lg shadow-blue-950/40'
                      : isPast
                      ? 'bg-slate-900/85 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-900/40 border-slate-800/60 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-blue-500 text-white shadow'
                          : isPast
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Dòng trình bày bài giải chuẩn */}
                      <p
                        className={`text-xs sm:text-sm leading-relaxed ${
                          isActive ? 'text-white font-semibold' : 'text-slate-200'
                        }`}
                      >
                        {step.lineText}
                      </p>

                      {/* Khung lời giảng giải thích cho học sinh ở dòng đang active */}
                      {isActive && (
                        <div className="rounded-xl bg-slate-950/80 border border-blue-500/30 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                              <Lightbulb className="w-3.5 h-3.5" />
                              Giải thích cho học sinh:
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                narrateStep(idx, false, true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition"
                            >
                              <Volume2 className="w-3 h-3" /> Nghe giảng lại
                            </button>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed italic">
                            “{step.voiceExplanation}”
                          </p>
                          {step.tip && (
                            <div className="pt-1 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-sky-400">
                              <Award className="w-3.5 h-3.5 shrink-0" />
                              <span>Kiến thức áp dụng: {step.tip}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Nút gợi ý hiện dòng tiếp theo ngay cuối danh sách */}
            {!showAllLines && currentStepIdx < totalSteps - 1 && (
              <button
                onClick={() => handleClickStep(currentStepIdx + 1)}
                className="w-full py-2.5 rounded-xl border border-dashed border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Hiện dòng giải tiếp theo (Dòng {currentStepIdx + 2}/{totalSteps})</span>
              </button>
            )}
          </div>

          {/* Thanh điều khiển trình chiếu từng dòng giải ở đáy cột phải */}
          <div className="shrink-0 bg-[#111827] border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  stopSpeechAndTimers();
                  setIsAutoTeaching(false);
                  setCurrentStepIdx(0);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                title="Quay về dòng đầu tiên"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleClickStep(Math.max(0, currentStepIdx - 1))}
                disabled={currentStepIdx === 0}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition"
                title="Dòng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleToggleAutoTeach}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-950/50 transition"
              >
                {isAutoTeaching ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isAutoTeaching ? 'Tạm dừng giảng' : 'Tự động giảng từng dòng'}</span>
              </button>

              <button
                onClick={() => handleClickStep(Math.min(totalSteps - 1, currentStepIdx + 1))}
                disabled={currentStepIdx >= totalSteps - 1}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition"
                title="Dòng tiếp theo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400">
              {currentStepIdx + 1} / {totalSteps}
            </div>
          </div>
        </aside>
      </div>

      {/* ========================================================================
          MODAL CÀI ĐẶT GEMINI API KEY (LƯU TRÊN TRÌNH DUYỆT LOCALSTORAGE)
         ======================================================================== */}
      {apiKeyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Cài đặt Gemini API Key miễn phí</h3>
              </div>
              <button
                onClick={() => setApiKeyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                API Key được lưu trực tiếp trong trình duyệt (<code className="text-sky-400">localStorage</code>) của máy bạn, tuyệt đối an toàn và không gửi lên GitHub.
              </p>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-semibold underline"
              >
                <span>Lấy Gemini API Key miễn phí tại Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">
                Dán mã API Key (bắt đầu bằng AIzaSy...):
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {geminiApiKey ? (
                <button
                  onClick={() => {
                    setApiKeyInput('');
                    setGeminiApiKey('');
                    try {
                      localStorage.removeItem(API_KEY_STORAGE);
                    } catch {
                      // Bỏ qua lỗi
                    }
                    setApiKeyModalOpen(false);
                    showToast('Đã xóa API Key khỏi trình duyệt.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Key</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setApiKeyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                >
                  Lưu API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL NHẬP ĐỀ BÀI TOÁN HÌNH HỌC MỚI ĐỂ AI TỰ VẼ HÌNH & GIẢI TỪNG DÒNG
         ======================================================================== */}
      {customModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">AI Vẽ Hình & Giải Toán Hình Học Từng Dòng</h3>
              </div>
              <button
                onClick={() => !isGeneratingAI && setCustomModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Nhập đề bài toán hình học THCS (Lớp 6, 7, 8, 9). Hệ thống sẽ tự động dựng hình tọa độ, tách lời giải thành từng dòng tuần tự, tạo lời giảng giải thích và lưu lại trên trình duyệt.
            </p>

            <textarea
              rows={4}
              value={customPromptInput}
              onChange={(e) => setCustomPromptInput(e.target.value)}
              placeholder="Ví dụ: Cho tam giác ABC cân tại A, kẻ đường cao AH. Chứng minh HB = HC..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Hoặc bấm chọn nhanh một đề bài gợi ý:</span>
              </div>
              <div className="space-y-1.5">
                {AI_QUICK_PROMPTS.map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => setCustomPromptInput(sample)}
                    className="w-full text-left text-[11px] text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 transition"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCustomModalOpen(false)}
                disabled={isGeneratingAI}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300"
              >
                Đóng
              </button>
              <button
                onClick={handleGenerateCustomProblem}
                disabled={isGeneratingAI}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 shadow-md"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang dựng hình & giải toán...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Vẽ hình & Giải từng dòng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          THÔNG BÁO TOAST NHANH
         ======================================================================== */}
      {toastMsg && (
        <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-medium">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
