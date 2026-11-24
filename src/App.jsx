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
  Eye,
  Grid,
  Presentation,
  X,
  Download,
  FileText,
  Loader2,
  Layers,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Key,
  ExternalLink,
  Trash2,
  PenTool,
  Headphones,
  CheckCircle2,
  MessageSquareText,
  Image as ImageIcon,
  Upload,
  PackageCheck,
  Wand2
} from 'lucide-react';
import SAVED_SAMPLES from './data/savedSamples.json';

/* ============================================================================
   HẰNG SỐ LƯU TRỮ LOCALSTORAGE & CDN NÉN MP3 / ZIP
   ============================================================================ */
const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const CUSTOM_PROBLEMS_STORAGE = 'toan_hinh_custom_problems';
const LAMEJS_CDN = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.js';
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

/* ============================================================================
   KHO BÀI TOÁN HÌNH HỌC THCS MẶC ĐỊNH
   ============================================================================ */
const SAMPLE_PROBLEMS = [
  {
    id: 'g7_isosceles_median',
    hasStaticAudio: false,
    grade: 'Toán 7',
    title: 'Chứng minh hai tam giác bằng nhau & đường cao trong tam giác cân',
    problemText:
      'Cho tam giác ABC cân tại A (AB = AC). Gọi M là trung điểm của cạnh BC. Chứng minh rằng:\na) △ABM = △ACM.\nb) AM vuông góc với BC.',
    given: ['△ABC cân tại A (AB = AC)', 'M là trung điểm của BC (MB = MC)'],
    prove: ['a) △ABM = △ACM', 'b) AM ⊥ BC'],
    drawingSteps: [
      {
        caption: 'Vẽ tam giác ABC cân tại đỉnh A có hai cạnh bên AB và AC bằng nhau.',
        voiceExplanation:
          'Bước một, ta vẽ tam giác A B C cân tại đỉnh A, đánh dấu hai cạnh bên A B và A C bằng nhau.',
        highlightSegments: ['A-B', 'A-C', 'B-C'],
        highlightPoints: ['A', 'B', 'C']
      },
      {
        caption: 'Lấy M là trung điểm của cạnh đáy BC, kí hiệu hai đoạn thẳng MB = MC.',
        voiceExplanation:
          'Bước hai, trên cạnh đáy B C, ta lấy điểm M là trung điểm của B C và kí hiệu hai đoạn thẳng M B bằng M C.',
        highlightSegments: ['B-M', 'M-C'],
        highlightPoints: ['M']
      },
      {
        caption: 'Nối đỉnh A với trung điểm M bằng nét đứt để chia thành hai tam giác ABM và ACM.',
        voiceExplanation:
          'Bước ba, ta nối đỉnh A với trung điểm M bằng đoạn thẳng nét đứt, hoàn thành hình vẽ của bài toán.',
        highlightSegments: ['A-M'],
        highlightPoints: ['A', 'M']
      }
    ],
    geometry: {
      points: [
        { id: 'A', label: 'A', x: 0, y: -115, dx: 0, dy: -16, drawStep: 0 },
        { id: 'B', label: 'B', x: -115, y: 85, dx: -15, dy: 14, drawStep: 0 },
        { id: 'C', label: 'C', x: 115, y: 85, dx: 15, dy: 14, drawStep: 0 },
        { id: 'M', label: 'M', x: 0, y: 85, dx: 0, dy: 18, drawStep: 1 }
      ],
      segments: [
        { from: 'A', to: 'B', style: 'solid', color: 'main', ticks: 1, drawStep: 0 },
        { from: 'A', to: 'C', style: 'solid', color: 'main', ticks: 1, drawStep: 0 },
        { from: 'B', to: 'M', style: 'solid', color: 'main', ticks: 2, drawStep: 0, ticksFromStep: 1 },
        { from: 'M', to: 'C', style: 'solid', color: 'main', ticks: 2, drawStep: 0, ticksFromStep: 1 },
        { from: 'A', to: 'M', style: 'dashed', color: 'accent', ticks: 0, drawStep: 2 }
      ],
      circles: [],
      rightAngles: [
        { vertex: 'M', p1: 'A', p2: 'C', drawStep: 3, solveRevealStep: 5 }
      ],
      angleArcs: [
        { vertex: 'M', p1: 'B', p2: 'A', radius: 22, label: '', color: 'accent', drawStep: 3, solveRevealStep: 5 },
        { vertex: 'M', p1: 'A', p2: 'C', radius: 25, label: '', color: 'red', drawStep: 3, solveRevealStep: 5 }
      ]
    },
    solutionSteps: [
      {
        lineText: 'a) Xét △ABM và △ACM, ta có:',
        voiceExplanation:
          'Để chứng minh tam giác A B M bằng tam giác A C M, trước tiên ta xét hai tam giác này và liệt kê các yếu tố bằng nhau.',
        highlightSegments: [],
        highlightPoints: ['A', 'B', 'M', 'C'],
        highlightPolygons: [
          { points: ['A', 'B', 'M'], color: 'blue' },
          { points: ['A', 'C', 'M'], color: 'amber' }
        ]
      },
      {
        lineText: '    AB = AC (giả thiết △ABC cân tại A)',
        voiceExplanation:
          'Thứ nhất, cạnh A B bằng cạnh A C vì tam giác A B C cân tại A theo giả thiết.',
        highlightSegments: ['A-B', 'A-C'],
        highlightPoints: ['A', 'B', 'C'],
        highlightPolygons: []
      },
      {
        lineText: '    MB = MC (M là trung điểm của BC)',
        voiceExplanation:
          'Thứ hai, đoạn thẳng M B bằng đoạn thẳng M C vì M là trung điểm của cạnh B C.',
        highlightSegments: ['B-M', 'M-C'],
        highlightPoints: ['B', 'M', 'C'],
        highlightPolygons: []
      },
      {
        lineText: '    AM là cạnh chung',
        voiceExplanation:
          'Thứ ba, hai tam giác có chung cạnh A M.',
        highlightSegments: ['A-M'],
        highlightPoints: ['A', 'M'],
        highlightPolygons: []
      },
      {
        lineText: '    ⇒ △ABM = △ACM (c.c.c).',
        voiceExplanation:
          'Vậy ba cạnh của tam giác này bằng ba cạnh của tam giác kia, suy ra tam giác A B M bằng tam giác A C M theo trường hợp cạnh, cạnh, cạnh.',
        highlightSegments: ['A-B', 'A-C', 'A-M', 'B-M', 'M-C'],
        highlightPoints: ['A', 'B', 'M', 'C'],
        highlightPolygons: [
          { points: ['A', 'B', 'M'], color: 'blue' },
          { points: ['A', 'C', 'M'], color: 'emerald' }
        ]
      },
      {
        lineText:
          'b) Từ △ABM = △ACM ⇒ ∠AMB = ∠AMC (hai góc tương ứng). Mà ∠AMB + ∠AMC = 180° (kề bù) nên ∠AMB = ∠AMC = 90° ⇒ AM ⊥ BC.',
        voiceExplanation:
          'Sang câu b, từ hai tam giác bằng nhau suy ra hai góc A M B và A M C bằng nhau. Mà hai góc này kề bù có tổng bằng 180 độ nên mỗi góc bằng 90 độ, chứng tỏ A M vuông góc với B C.',
        highlightSegments: ['A-M', 'B-M', 'M-C'],
        highlightPoints: ['M'],
        highlightPolygons: []
      }
    ]
  },
  {
    id: 'g7_adjacent_bisectors',
    hasStaticAudio: false,
    grade: 'Toán 7',
    title: 'Tính góc tạo bởi hai tia phân giác của hai góc kề bù',
    problemText:
      'Cho hai góc kề bù xOz và zOy, biết ∠xOz = 70°. Gọi Om là tia phân giác của góc xOz, On là tia phân giác của góc zOy. Tính số đo góc mOn.',
    given: ['∠xOz và ∠zOy kề bù', '∠xOz = 70°', 'Om, On lần lượt là phân giác của ∠xOz, ∠zOy'],
    prove: ['Tính số đo ∠mOn'],
    drawingSteps: [
      {
        caption: 'Vẽ đường thẳng xy và lấy điểm O nằm trên đường thẳng xy tạo thành hai tia đối nhau Ox, Oy.',
        voiceExplanation:
          'Bước một, ta vẽ đường thẳng x y và lấy điểm O nằm trên đường thẳng đó để tạo hai tia đối nhau O x và O y.',
        highlightSegments: ['y-x'],
        highlightPoints: ['O', 'x', 'y']
      },
      {
        caption: 'Vẽ tia Oz sao cho góc xOz = 70°, tạo thành hai góc kề bù xOz và zOy.',
        voiceExplanation:
          'Bước hai, từ đỉnh O, ta vẽ tia O z tạo với tia O x một góc 70 độ, hình thành hai góc kề bù x O z và z O y.',
        highlightSegments: ['O-z'],
        highlightPoints: ['O', 'z']
      },
      {
        caption: 'Vẽ tia Om là tia phân giác của góc xOz (chia góc 70° thành hai phần bằng nhau).',
        voiceExplanation:
          'Bước ba, ta vẽ tia phân giác O m nằm trong góc x O z, chia góc này thành hai góc bằng nhau.',
        highlightSegments: ['O-m'],
        highlightPoints: ['O', 'm']
      },
      {
        caption: 'Vẽ tia On là tia phân giác của góc zOy, hoàn tất hình vẽ.',
        voiceExplanation:
          'Bước bốn, ta vẽ tiếp tia phân giác O n của góc z O y, hoàn thiện đầy đủ hình vẽ.',
        highlightSegments: ['O-n'],
        highlightPoints: ['O', 'n']
      }
    ],
    geometry: {
      points: [
        { id: 'O', label: 'O', x: 0, y: 75, dx: 0, dy: 18, drawStep: 0 },
        { id: 'x', label: 'x', x: 185, y: 75, dx: 12, dy: 4, drawStep: 0 },
        { id: 'y', label: 'y', x: -185, y: 75, dx: -12, dy: 4, drawStep: 0 },
        { id: 'z', label: 'z', x: 58, y: -85, dx: 10, dy: -10, drawStep: 1 },
        { id: 'm', label: 'm', x: 142, y: -24, dx: 12, dy: -8, drawStep: 2 },
        { id: 'n', label: 'n', x: -96, y: -92, dx: -12, dy: -10, drawStep: 3 }
      ],
      segments: [
        { from: 'y', to: 'x', style: 'solid', color: 'main', ticks: 0, drawStep: 0 },
        { from: 'O', to: 'z', style: 'solid', color: 'main', ticks: 0, drawStep: 1 },
        { from: 'O', to: 'm', style: 'solid', color: 'accent', ticks: 0, drawStep: 2 },
        { from: 'O', to: 'n', style: 'solid', color: 'red', ticks: 0, drawStep: 3 }
      ],
      circles: [],
      rightAngles: [
        { vertex: 'O', p1: 'm', p2: 'n', drawStep: 4, solveRevealStep: 4 }
      ],
      angleArcs: [
        { vertex: 'O', p1: 'x', p2: 'm', radius: 34, label: '35°', color: 'accent', drawStep: 4, solveRevealStep: 1 },
        { vertex: 'O', p1: 'm', p2: 'z', radius: 38, label: '35°', color: 'accent', drawStep: 4, solveRevealStep: 1 },
        { vertex: 'O', p1: 'z', p2: 'n', radius: 42, label: '55°', color: 'red', drawStep: 4, solveRevealStep: 3 },
        { vertex: 'O', p1: 'n', p2: 'y', radius: 46, label: '55°', color: 'red', drawStep: 4, solveRevealStep: 3 }
      ]
    },
    solutionSteps: [
      {
        lineText: 'Vì ∠xOz và ∠zOy là hai góc kề bù nên ∠xOz + ∠zOy = 180°.',
        voiceExplanation:
          'Hai góc x O z và z O y kề bù nên tổng số đo của chúng bằng 180 độ.',
        highlightSegments: ['y-x', 'O-z'],
        highlightPoints: ['O', 'x', 'y', 'z'],
        highlightPolygons: []
      },
      {
        lineText: 'Vì Om là tia phân giác của ∠xOz nên ∠mOz = ∠xOz : 2 = 70° : 2 = 35°.',
        voiceExplanation:
          'Tia O m là phân giác của góc x O z bằng 70 độ nên góc m O z bằng một nửa, tức là 35 độ.',
        highlightSegments: ['O-m', 'O-z', 'O-x'],
        highlightPoints: ['O', 'm', 'z'],
        highlightPolygons: []
      },
      {
        lineText: 'Ta có ∠zOy = 180° − ∠xOz = 180° − 70° = 110°.',
        voiceExplanation:
          'Lấy 180 độ trừ 70 độ, ta tính được góc kề bù z O y bằng 110 độ.',
        highlightSegments: ['O-z', 'O-y'],
        highlightPoints: ['O', 'z', 'y'],
        highlightPolygons: []
      },
      {
        lineText: 'Vì On là tia phân giác của ∠zOy nên ∠zOn = ∠zOy : 2 = 110° : 2 = 55°.',
        voiceExplanation:
          'Tương tự, tia O n là phân giác của góc z O y bằng 110 độ nên góc z O n bằng 55 độ.',
        highlightSegments: ['O-n', 'O-z', 'O-y'],
        highlightPoints: ['O', 'n', 'z'],
        highlightPolygons: []
      },
      {
        lineText: 'Tia Oz nằm giữa hai tia Om và On nên ∠mOn = ∠mOz + ∠zOn = 35° + 55° = 90°.',
        voiceExplanation:
          'Vì tia O z nằm giữa hai tia O m và O n, cộng 35 độ với 55 độ ta được góc m O n bằng 90 độ.',
        highlightSegments: ['O-m', 'O-n'],
        highlightPoints: ['O', 'm', 'n'],
        highlightPolygons: []
      }
    ]
  },
  {
    id: 'g8_pythagoras_altitude',
    hasStaticAudio: false,
    grade: 'Toán 8',
    title: 'Tính cạnh huyền & đường cao tam giác vuông (Định lí Pythagore)',
    problemText:
      'Cho tam giác ABC vuông tại A có AB = 6 cm, AC = 8 cm. Kẻ đường cao AH vuông góc với cạnh huyền BC (H ∈ BC). Tính độ dài cạnh BC và đường cao AH.',
    given: ['△ABC vuông tại A', 'AB = 6 cm, AC = 8 cm', 'AH ⊥ BC (H ∈ BC)'],
    prove: ['Tính BC và AH'],
    drawingSteps: [
      {
        caption: 'Vẽ tam giác ABC vuông tại đỉnh A, kí hiệu góc vuông tại A với hai cạnh góc vuông AB = 6 cm, AC = 8 cm.',
        voiceExplanation:
          'Bước một, ta vẽ tam giác A B C vuông tại đỉnh A, đánh dấu kí hiệu góc vuông tại A.',
        highlightSegments: ['A-B', 'A-C', 'B-C'],
        highlightPoints: ['A', 'B', 'C']
      },
      {
        caption: 'Từ đỉnh A, kẻ đường cao AH vuông góc với cạnh huyền BC tại H.',
        voiceExplanation:
          'Bước hai, từ đỉnh góc vuông A, ta hạ đường cao A H vuông góc với cạnh huyền B C tại điểm H.',
        highlightSegments: ['A-H'],
        highlightPoints: ['A', 'H']
      }
    ],
    geometry: {
      points: [
        { id: 'B', label: 'B', x: -145, y: 75, dx: -14, dy: 14, drawStep: 0 },
        { id: 'C', label: 'C', x: 145, y: 75, dx: 14, dy: 14, drawStep: 0 },
        { id: 'A', label: 'A', x: -41, y: -64, dx: 0, dy: -16, drawStep: 0 },
        { id: 'H', label: 'H', x: -41, y: 75, dx: 0, dy: 18, drawStep: 1 }
      ],
      segments: [
        { from: 'A', to: 'B', style: 'solid', color: 'main', ticks: 0, drawStep: 0 },
        { from: 'A', to: 'C', style: 'solid', color: 'main', ticks: 0, drawStep: 0 },
        { from: 'B', to: 'C', style: 'solid', color: 'main', ticks: 0, drawStep: 0 },
        { from: 'A', to: 'H', style: 'dashed', color: 'red', ticks: 0, drawStep: 1 }
      ],
      circles: [],
      rightAngles: [
        { vertex: 'A', p1: 'B', p2: 'C', drawStep: 0 },
        { vertex: 'H', p1: 'A', p2: 'C', drawStep: 1 }
      ],
      angleArcs: []
    },
    solutionSteps: [
      {
        lineText: 'Áp dụng định lí Pythagore vào △ABC vuông tại A: BC² = AB² + AC².',
        voiceExplanation:
          'Trong tam giác A B C vuông tại A, theo định lí Pi-ta-go ta có bình phương cạnh huyền B C bằng tổng bình phương hai cạnh góc vuông A B và A C.',
        highlightSegments: ['A-B', 'A-C', 'B-C'],
        highlightPoints: ['A', 'B', 'C'],
        highlightPolygons: [{ points: ['A', 'B', 'C'], color: 'blue' }]
      },
      {
        lineText: 'Thay số: BC² = 6² + 8² = 36 + 64 = 100 ⇒ BC = 10 (cm).',
        voiceExplanation:
          'Thay số 6 và 8 vào, ta được B C bình phương bằng 36 cộng 64 bằng 100, suy ra cạnh huyền B C bằng 10 xăng-ti-mét.',
        highlightSegments: ['B-C'],
        highlightPoints: ['B', 'C'],
        highlightPolygons: []
      },
      {
        lineText: 'Diện tích △ABC: S(ABC) = ½·AB·AC = ½·AH·BC.',
        voiceExplanation:
          'Biểu diễn diện tích tam giác A B C theo hai cách: một nửa tích hai cạnh góc vuông, hoặc một nửa tích đường cao A H với cạnh huyền B C.',
        highlightSegments: ['A-H', 'A-B', 'A-C', 'B-C'],
        highlightPoints: ['A', 'H'],
        highlightPolygons: [{ points: ['A', 'B', 'C'], color: 'emerald' }]
      },
      {
        lineText: '⇒ AH = (AB · AC) / BC = (6 · 8) / 10 = 4,8 (cm).',
        voiceExplanation:
          'Từ đó rút ra đường cao A H bằng 6 nhân 8 chia 10, kết quả bằng 4 phẩy 8 xăng-ti-mét.',
        highlightSegments: ['A-H'],
        highlightPoints: ['A', 'H'],
        highlightPolygons: []
      }
    ]
  },
  {
    id: 'g9_two_tangents_chord',
    hasStaticAudio: false,
    grade: 'Toán 9',
    title: 'Tính chất hai tiếp tuyến cắt nhau của đường tròn (O)',
    problemText:
      'Từ điểm M nằm ngoài đường tròn (O; R), kẻ hai tiếp tuyến MA, MB tới đường tròn (A, B là các tiếp điểm). Gọi H là giao điểm của OM và AB. Chứng minh OM là đường trung trực của đoạn thẳng AB.',
    given: ['Đường tròn (O; R), M nằm ngoài (O)', 'MA, MB là tiếp tuyến tại A, B', 'OM ∩ AB = {H}'],
    prove: ['OM là đường trung trực của AB'],
    drawingSteps: [
      {
        caption: 'Vẽ đường tròn tâm O bán kính R và lấy điểm M nằm ngoài đường tròn (O).',
        voiceExplanation:
          'Bước một, ta vẽ đường tròn tâm O bán kính R và lấy một điểm M nằm bên ngoài đường tròn.',
        highlightSegments: [],
        highlightPoints: ['O', 'M']
      },
      {
        caption: 'Từ M kẻ hai tiếp tuyến MA, MB tới (O) tại hai tiếp điểm A, B; nối bán kính OA, OB vuông góc với tiếp tuyến.',
        voiceExplanation:
          'Bước hai, từ M kẻ hai tiếp tuyến M A và M B tiếp xúc với đường tròn tại A và B, đồng thời nối hai bán kính O A và O B vuông góc với các tiếp tuyến.',
        highlightSegments: ['M-A', 'M-B', 'O-A', 'O-B'],
        highlightPoints: ['A', 'B']
      },
      {
        caption: 'Nối OM và dây cung AB, hai đoạn thẳng cắt nhau tại giao điểm H.',
        voiceExplanation:
          'Bước ba, ta nối O với M và nối dây cung A B, hai đoạn thẳng này cắt nhau tại điểm H.',
        highlightSegments: ['O-M', 'A-B'],
        highlightPoints: ['H']
      }
    ],
    geometry: {
      points: [
        { id: 'O', label: 'O', x: -70, y: 0, dx: -15, dy: 4, drawStep: 0 },
        { id: 'M', label: 'M', x: 145, y: 0, dx: 15, dy: 4, drawStep: 0 },
        { id: 'A', label: 'A', x: -35, y: -72, dx: -6, dy: -15, drawStep: 1 },
        { id: 'B', label: 'B', x: -35, y: 72, dx: -6, dy: 17, drawStep: 1 },
        { id: 'H', label: 'H', x: -35, y: 0, dx: -12, dy: 15, drawStep: 2 }
      ],
      segments: [
        { from: 'M', to: 'A', style: 'solid', color: 'main', ticks: 1, drawStep: 1 },
        { from: 'M', to: 'B', style: 'solid', color: 'main', ticks: 1, drawStep: 1 },
        { from: 'O', to: 'A', style: 'dashed', color: 'accent', ticks: 2, drawStep: 1 },
        { from: 'O', to: 'B', style: 'dashed', color: 'accent', ticks: 2, drawStep: 1 },
        { from: 'O', to: 'M', style: 'solid', color: 'red', ticks: 0, drawStep: 2 },
        { from: 'A', to: 'B', style: 'solid', color: 'main', ticks: 0, drawStep: 2 }
      ],
      circles: [
        { center: 'O', radiusPx: 80, style: 'solid', drawStep: 0 }
      ],
      rightAngles: [
        { vertex: 'A', p1: 'O', p2: 'M', drawStep: 1 },
        { vertex: 'B', p1: 'O', p2: 'M', drawStep: 1 },
        { vertex: 'H', p1: 'A', p2: 'M', drawStep: 3, solveRevealStep: 3 }
      ],
      angleArcs: []
    },
    solutionSteps: [
      {
        lineText: 'Xét (O) có MA, MB là hai tiếp tuyến cắt nhau tại M (A, B là tiếp điểm).',
        voiceExplanation:
          'Xét đường tròn tâm O có hai tiếp tuyến M A và M B cắt nhau tại điểm M.',
        highlightSegments: ['M-A', 'M-B'],
        highlightPoints: ['M', 'A', 'B'],
        highlightPolygons: []
      },
      {
        lineText: '⇒ MA = MB (tính chất hai tiếp tuyến cắt nhau) ⇒ M thuộc đường trung trực của AB (1).',
        voiceExplanation:
          'Theo tính chất hai tiếp tuyến cắt nhau, M A bằng M B nên điểm M cách đều hai đầu mút A và B, suy ra M thuộc đường trung trực của đoạn thẳng A B.',
        highlightSegments: ['M-A', 'M-B'],
        highlightPoints: ['M', 'A', 'B'],
        highlightPolygons: []
      },
      {
        lineText: 'Lại có OA = OB = R ⇒ O thuộc đường trung trực của AB (2).',
        voiceExplanation:
          'Mặt khác, hai bán kính O A và O B cùng bằng R nên tâm O cũng cách đều A và B, suy ra O thuộc đường trung trực của A B.',
        highlightSegments: ['O-A', 'O-B'],
        highlightPoints: ['O', 'A', 'B'],
        highlightPolygons: []
      },
      {
        lineText: 'Từ (1) và (2) suy ra OM là đường trung trực của đoạn thẳng AB.',
        voiceExplanation:
          'Từ hai điều trên, cả O và M cùng nằm trên đường trung trực của A B, vậy O M chính là đường trung trực của đoạn thẳng A B.',
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

const AI_REFINE_CHIPS = [
  'Chỉnh tọa độ hình vẽ cho cân đối, thoáng và rõ điểm hơn',
  'Rút gọn lời giải các dòng cho súc tích, chuẩn mực hơn',
  'Tách thêm bước vẽ hình chi tiết từng nét hơn'
];

/* ============================================================================
   HÀM HỖ TRỢ XỬ LÝ ÂM THANH, NÉN MP3 VÀ ĐÓNG GÓI ZIP TRÊN TRÌNH DUYỆT
   ============================================================================ */
function formatNaturalLectureSpeech(text) {
  return text
    .replace(/△\s*/g, 'tam giác ')
    .replace(/∠\s*/g, 'góc ')
    .replace(/⊥/g, 'vuông góc với')
    .replace(/\/\//g, 'song song với')
    .replace(/⇒/g, 'suy ra')
    .replace(/∈/g, 'thuộc')
    .replace(/∩/g, 'cắt')
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

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Lỗi tải ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Lỗi tải ${src}`));
    document.head.appendChild(script);
  });
}

function encodePcm16ToMp3Blob(pcm16, sampleRate = 24000) {
  if (typeof window === 'undefined' || !window.lamejs || !window.lamejs.Mp3Encoder) {
    return null;
  }
  try {
    // Mono (1 kênh), sampleRate 24000Hz, bitrate 48kbps -> siêu nhẹ (~4-6KB/giây) mà vẫn trong trẻo
    const encoder = new window.lamejs.Mp3Encoder(1, sampleRate, 48);
    const mp3Chunks = [];
    const blockSize = 1152;
    for (let i = 0; i < pcm16.length; i += blockSize) {
      const chunk = pcm16.subarray(i, i + blockSize);
      const buf = encoder.encodeBuffer(chunk);
      if (buf.length > 0) mp3Chunks.push(buf);
    }
    const endBuf = encoder.flush();
    if (endBuf.length > 0) mp3Chunks.push(endBuf);
    return new Blob(mp3Chunks, { type: 'audio/mp3' });
  } catch {
    return null;
  }
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

function sleepWithSignal(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function readImageFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Tệp không phải hình ảnh hợp lệ.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Không đọc được dữ liệu ảnh.'));
        return;
      }
      resolve({
        previewUrl: dataUrl,
        mimeType: file.type,
        base64: dataUrl.slice(commaIdx + 1),
        fileName: file.name || 'anh_de_bai.png'
      });
    };
    reader.onerror = () => reject(new Error('Lỗi đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

/* ============================================================================
   SCHEMA CHUNG CHO GEMINI DỰNG HÌNH & GIẢI TOÁN
   ============================================================================ */
const PROBLEM_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    grade: { type: 'STRING' },
    title: { type: 'STRING' },
    problemText: { type: 'STRING' },
    given: { type: 'ARRAY', items: { type: 'STRING' } },
    prove: { type: 'ARRAY', items: { type: 'STRING' } },
    drawingSteps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          caption: { type: 'STRING' },
          voiceExplanation: { type: 'STRING' },
          highlightSegments: { type: 'ARRAY', items: { type: 'STRING' } },
          highlightPoints: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['caption', 'voiceExplanation', 'highlightSegments', 'highlightPoints']
      }
    },
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
              drawStep: { type: 'INTEGER' }
            },
            required: ['id', 'label', 'x', 'y', 'dx', 'dy', 'drawStep']
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
              drawStep: { type: 'INTEGER' }
            },
            required: ['from', 'to', 'style', 'color', 'ticks', 'drawStep']
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
              drawStep: { type: 'INTEGER' }
            },
            required: ['center', 'radiusPx', 'style', 'drawStep']
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
              drawStep: { type: 'INTEGER' }
            },
            required: ['vertex', 'p1', 'p2', 'drawStep']
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
              drawStep: { type: 'INTEGER' }
            },
            required: ['vertex', 'p1', 'p2', 'radius', 'label', 'color', 'drawStep']
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
        required: ['lineText', 'voiceExplanation', 'highlightSegments', 'highlightPoints', 'highlightPolygons']
      }
    }
  },
  required: ['grade', 'title', 'problemText', 'given', 'prove', 'drawingSteps', 'geometry', 'solutionSteps']
};

const TEACHER_SYSTEM_PROMPT = `Bạn là giáo viên Toán THCS xuất sắc tại Việt Nam. Nhiệm vụ của bạn là phân tích một đề bài toán hình học phẳng THCS (từ văn bản hoặc hình ảnh chụp đề bài/hình vẽ) và xuất ra dữ liệu JSON chuẩn xác gồm:
1. Tóm tắt Giả thiết (given) và Kết luận (prove) ngắn gọn.
2. Các bước vẽ hình tuần tự (drawingSteps: 2 đến 4 bước). Mỗi bước vẽ có:
   - caption: Lời văn hướng dẫn vẽ hình bước đó (sẽ hiện ở thanh cuối trang).
   - voiceExplanation: Lời đọc cô giáo hướng dẫn vẽ hình bước đó (viết tự nhiên, phát âm rõ tên điểm như "tam giác A B C", "đoạn thẳng A M").
   - highlightSegments: Mảng các đoạn "A-B" vừa vẽ ở bước này.
   - highlightPoints: Mảng tên các điểm vừa vẽ ở bước này.
3. Tọa độ hình học 2D chuẩn xác trên Canvas tâm (0,0), x từ -180 đến 180, y từ -130 đến 130. Đảm bảo tính chất hình học thật (vuông góc, cân, song song, trung điểm, tiếp tuyến...) đúng tỷ lệ trên tọa độ. Mỗi điểm/đoạn/đường tròn/góc vuông/cung góc có trường drawStep (số nguyên 0, 1, 2... tương ứng bước vẽ hình mà đối tượng đó xuất hiện).
4. Lời giải bài toán (solutionSteps: 4 đến 6 dòng). Mỗi dòng gồm:
   - lineText: Lời giải NGẮN GỌN, LOGIC, chuẩn mực như bài làm mẫu trên bảng (KHÔNG ghi số bước "Bước 1", "Bước 2", KHÔNG viết lời giải thích dài dòng trong lineText).
   - voiceExplanation: Lời giảng giải thích chi tiết của cô giáo cho dòng đó (sẽ đọc bằng giọng nói và hiện ở thanh lời văn cuối trang).
   - highlightSegments: Mảng các cặp điểm "A-B" cần tô sáng trên hình vẽ.
   - highlightPoints: Mảng tên các điểm cần tô sáng.
   - highlightPolygons: Mảng các đa giác cần tô màu bán trong suốt (nếu đang xét hai tam giác hoặc tứ giác).`;

/* ============================================================================
   CHUẨN HÓA DÒNG THỜI GIAN BÀI GIẢNG (BƯỚC VẼ HÌNH + DÒNG LỜI GIẢI)
   ============================================================================ */
function buildProblemTimeline(problem) {
  const drawSteps =
    Array.isArray(problem.drawingSteps) && problem.drawingSteps.length > 0
      ? problem.drawingSteps
      : [
          {
            caption: 'Dựng hình minh họa theo các giả thiết của đề bài.',
            voiceExplanation: 'Trước tiên, ta dựng hình minh họa đầy đủ các yếu tố của đề bài.',
            highlightSegments: [],
            highlightPoints: []
          }
        ];

  const solveSteps = Array.isArray(problem.solutionSteps) ? problem.solutionSteps : [];

  const items = [];
  drawSteps.forEach((ds, idx) => {
    items.push({
      phase: 'draw',
      phaseIndex: idx,
      phaseTotal: drawSteps.length,
      subtitleText: ds.caption || ds.voiceExplanation || '',
      voiceText: ds.voiceExplanation || ds.caption || '',
      meta: ds
    });
  });

  solveSteps.forEach((ss, idx) => {
    items.push({
      phase: 'solve',
      phaseIndex: idx,
      phaseTotal: solveSteps.length,
      subtitleText: ss.voiceExplanation || ss.lineText || '',
      voiceText: ss.voiceExplanation || ss.lineText || '',
      meta: ss
    });
  });

  return items;
}

/* ============================================================================
   BỘ VẼ HÌNH HỌC ĐỘNG TRÊN CANVAS
   ============================================================================ */
function renderGeometryScene(
  ctx,
  geometry,
  currentItem,
  drawAnimProgress = 1,
  pulsePhase = 0,
  lightMode = false
) {
  if (!geometry) return;
  const pointMap = {};
  (geometry.points || []).forEach((pt) => {
    pointMap[pt.id] = pt;
  });

  const isDrawPhase = currentItem?.phase === 'draw';
  const drawStepLimit = isDrawPhase ? currentItem.phaseIndex : 999;
  const solveStepLimit = !isDrawPhase ? currentItem?.phaseIndex ?? 999 : -1;

  const activeMeta = currentItem?.meta || {};
  const hlSegSet = new Set(
    (activeMeta.highlightSegments || []).flatMap((pair) => {
      const parts = pair.split('-').map((s) => s.trim());
      if (parts.length !== 2) return [];
      return [`${parts[0]}-${parts[1]}`, `${parts[1]}-${parts[0]}`];
    })
  );
  const hlPointSet = new Set(activeMeta.highlightPoints || []);
  const hlPolygons = !isDrawPhase ? activeMeta.highlightPolygons || [] : [];

  const mainStroke = lightMode ? '#0f172a' : '#f8fafc';
  const accentStroke = lightMode ? '#2563eb' : '#38bdf8';
  const redStroke = lightMode ? '#dc2626' : '#f87171';

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

  (geometry.circles || []).forEach((circ) => {
    const itemDrawStep = circ.drawStep ?? circ.revealAtStep ?? 0;
    if (itemDrawStep > drawStepLimit) return;
    const center = pointMap[circ.center];
    if (!center) return;

    const progress =
      isDrawPhase && itemDrawStep === drawStepLimit ? Math.max(0.05, drawAnimProgress) : 1;

    ctx.save();
    ctx.strokeStyle =
      isDrawPhase && itemDrawStep === drawStepLimit && !lightMode ? '#38bdf8' : mainStroke;
    ctx.lineWidth = 2.3;
    if (circ.style === 'dashed') ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, circ.radiusPx || 80, 0, Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  });

  (geometry.segments || []).forEach((seg) => {
    const itemDrawStep = seg.drawStep ?? seg.revealAtStep ?? 0;
    if (itemDrawStep > drawStepLimit) return;
    const p1 = pointMap[seg.from];
    const p2 = pointMap[seg.to];
    if (!p1 || !p2) return;

    const isNewlyDrawn = isDrawPhase && itemDrawStep === drawStepLimit;
    const progress = isNewlyDrawn ? Math.max(0.05, drawAnimProgress) : 1;
    const endX = p1.x + (p2.x - p1.x) * progress;
    const endY = p1.y + (p2.y - p1.y) * progress;

    const isHighlighted = hlSegSet.has(`${seg.from}-${seg.to}`);
    let strokeColor = mainStroke;
    if (seg.color === 'accent') strokeColor = accentStroke;
    else if (seg.color === 'red') strokeColor = redStroke;

    if ((isHighlighted || isNewlyDrawn) && !lightMode) {
      ctx.save();
      ctx.strokeStyle = isDrawPhase
        ? 'rgba(56, 189, 248, 0.36)'
        : 'rgba(250, 204, 21, 0.42)';
      ctx.lineWidth = 8 + 2.5 * Math.sin(pulsePhase * Math.PI * 2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (isHighlighted && !lightMode) {
      ctx.strokeStyle = isDrawPhase ? '#38bdf8' : '#facc15';
    } else if (isHighlighted && lightMode) {
      ctx.strokeStyle = '#d97706';
    } else {
      ctx.strokeStyle = strokeColor;
    }
    ctx.lineWidth = isHighlighted || isNewlyDrawn ? 3.3 : 2.3;
    ctx.lineCap = 'round';
    if (seg.style === 'dashed') ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();

    const ticksStep = seg.ticksFromStep ?? itemDrawStep;
    if (seg.ticks && seg.ticks > 0 && ticksStep <= drawStepLimit && progress >= 0.95) {
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

  (geometry.rightAngles || []).forEach((ra) => {
    const itemDrawStep = ra.drawStep ?? ra.revealAtStep ?? 0;
    const isVisibleInDraw = isDrawPhase && itemDrawStep <= drawStepLimit;
    const isVisibleInSolve =
      !isDrawPhase &&
      (ra.solveRevealStep === undefined || ra.solveRevealStep <= solveStepLimit);
    if (!isVisibleInDraw && !isVisibleInSolve) return;

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

  (geometry.angleArcs || []).forEach((arc) => {
    const itemDrawStep = arc.drawStep ?? arc.revealAtStep ?? 0;
    const isVisibleInDraw = isDrawPhase && itemDrawStep <= drawStepLimit;
    const isVisibleInSolve =
      !isDrawPhase &&
      (arc.solveRevealStep === undefined || arc.solveRevealStep <= solveStepLimit);
    if (!isVisibleInDraw && !isVisibleInSolve) return;

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

  (geometry.points || []).forEach((pt) => {
    const itemDrawStep = pt.drawStep ?? pt.revealAtStep ?? 0;
    if (itemDrawStep > drawStepLimit) return;
    const isHl = hlPointSet.has(pt.id);

    if (isHl && !lightMode) {
      ctx.save();
      ctx.fillStyle = isDrawPhase
        ? 'rgba(56, 189, 248, 0.3)'
        : 'rgba(250, 204, 21, 0.28)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9 + 3 * Math.sin(pulsePhase * Math.PI * 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (isHl && !lightMode) {
      ctx.fillStyle = isDrawPhase ? '#38bdf8' : '#facc15';
    } else if (isHl && lightMode) {
      ctx.fillStyle = '#d97706';
    } else {
      ctx.fillStyle = mainStroke;
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isHl ? 4.8 : 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = lightMode ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    if (pt.label) {
      ctx.font = "italic bold 16px 'Times New Roman', Georgia, serif";
      ctx.fillStyle =
        isHl && !lightMode
          ? isDrawPhase
            ? '#7dd3fc'
            : '#fde047'
          : isHl && lightMode
          ? '#b45309'
          : mainStroke;
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
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const [customProblems, setCustomProblems] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PROBLEMS_STORAGE);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Hợp nhất bài tự tạo (localStorage), bài mẫu đã lưu từ file JSON, và bài mẫu mặc định
  const problems = useMemo(() => {
    const savedFromRepo = Array.isArray(SAVED_SAMPLES) ? SAVED_SAMPLES : [];
    const seen = new Set();
    const merged = [];
    for (const item of [...customProblems, ...savedFromRepo, ...SAMPLE_PROBLEMS]) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
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
    if (Array.isArray(SAVED_SAMPLES) && SAVED_SAMPLES.length > 0 && SAVED_SAMPLES[0]?.id) {
      return SAVED_SAMPLES[0].id;
    }
    return SAMPLE_PROBLEMS[0].id;
  });

  const [currentTimelineIdx, setCurrentTimelineIdx] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState('auto'); // 'auto' | 'draw' | 'solve' | 'refine'
  const [showAllSolutionLines, setShowAllSolutionLines] = useState(false);
  const [isAutoTeaching, setIsAutoTeaching] = useState(false);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  const [audioBatchStatus, setAudioBatchStatus] = useState({
    isGenerating: false,
    readyCount: 0,
    totalCount: 0,
    statusNote: ''
  });
  const [isPackingSampleZip, setIsPackingSampleZip] = useState(false);

  const [showGrid, setShowGrid] = useState(true);
  const [isPresentation, setIsPresentation] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pulsePhase, setPulsePhase] = useState(0);
  const [drawAnimProgress, setDrawAnimProgress] = useState(1);

  // State Modal Nhập đề mới (Hỗ trợ cả Văn bản, File text, và Hình ảnh)
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [customImageAttachment, setCustomImageAttachment] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // State Tab Chat điều chỉnh với AI
  const [refineChatsByProblem, setRefineChatsByProblem] = useState({});
  const [refineInput, setRefineInput] = useState('');
  const [refineImageAttachment, setRefineImageAttachment] = useState(null);
  const [isRefiningAI, setIsRefiningAI] = useState(false);

  const [toastMsg, setToastMsg] = useState('');

  const canvasRef = useRef(null);
  const solutionListRef = useRef(null);
  const refineChatEndRef = useRef(null);
  const textFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const refineImageInputRef = useRef(null);

  const currentAudioRef = useRef(null);
  const playbackAbortRef = useRef(null);
  const batchAbortRef = useRef(null);
  // Lưu cả { url, pcm16, sampleRate } để nén thẳng ra .mp3 mà không cần gọi lại API
  const ttsStoreRef = useRef(new Map());
  const ttsInFlightRef = useRef(new Map());
  const autoAdvanceTimerRef = useRef(null);

  const activeProblem = useMemo(
    () => problems.find((p) => p.id === selectedProblemId) || problems[0],
    [problems, selectedProblemId]
  );

  const isCurrentCustom = useMemo(
    () => customProblems.some((p) => p.id === activeProblem.id),
    [customProblems, activeProblem.id]
  );

  const timelineItems = useMemo(() => buildProblemTimeline(activeProblem), [activeProblem]);
  const drawStepsCount = useMemo(
    () => timelineItems.filter((item) => item.phase === 'draw').length,
    [timelineItems]
  );
  const solveStepsCount = activeProblem.solutionSteps.length;
  const totalTimelineCount = timelineItems.length;

  const safeTimelineIdx = Math.min(currentTimelineIdx, Math.max(0, totalTimelineCount - 1));
  const currentItem = timelineItems[safeTimelineIdx] || timelineItems[0];

  const currentRefineMessages = useMemo(() => {
    return (
      refineChatsByProblem[activeProblem.id] || [
        {
          role: 'ai',
          text: `Đã sẵn sàng hình vẽ (${drawStepsCount} bước) và lời giải (${solveStepsCount} dòng). Bạn hãy xem thử hình bên trái và lời giải; nếu cần chỉnh tọa độ điểm, thêm nét vẽ hay sửa câu chữ nào hãy nhắn ngay bên dưới nhé!`
        }
      ]
    );
  }, [refineChatsByProblem, activeProblem.id, drawStepsCount, solveStepsCount]);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 5000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROBLEMS_STORAGE, JSON.stringify(customProblems));
    } catch {
      // Bỏ qua nếu trình duyệt chặn lưu trữ
    }
  }, [customProblems]);

  const countCachedSteps = useCallback((prob, items) => {
    if (prob.hasStaticAudio) return items.length;
    let ready = 0;
    items.forEach((item) => {
      const speech = formatNaturalLectureSpeech(item.voiceText);
      const key = `${prob.id}::${speech}`;
      if (ttsStoreRef.current.has(key)) ready++;
    });
    return ready;
  }, []);

  useEffect(() => {
    const ready = countCachedSteps(activeProblem, timelineItems);
    setAudioBatchStatus((prev) => ({
      ...prev,
      readyCount: ready,
      totalCount: timelineItems.length
    }));
  }, [activeProblem, timelineItems, countCachedSteps]);

  useEffect(() => {
    if (rightPanelTab === 'refine') {
      refineChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rightPanelTab, currentRefineMessages]);

  const handleOpenApiKeyModal = () => {
    setApiKeyInput(geminiApiKey);
    setApiKeyModalOpen(true);
  };

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

  const stopPlaybackOnly = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (playbackAbortRef.current) {
      playbackAbortRef.current.abort();
      playbackAbortRef.current = null;
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
    setIsSpeakingNow(false);
  }, []);

  useEffect(() => {
    const store = ttsStoreRef.current;
    return () => {
      stopPlaybackOnly();
      if (batchAbortRef.current) batchAbortRef.current.abort();
      store.forEach((entry) => {
        if (entry?.url) URL.revokeObjectURL(entry.url);
      });
      store.clear();
    };
  }, [stopPlaybackOnly]);

  useEffect(() => {
    let rafId;
    const loop = (now) => {
      setPulsePhase((now / 1400) % 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (currentItem?.phase !== 'draw') {
      setDrawAnimProgress(1);
      return;
    }
    let rafId;
    const startTime = performance.now();
    const duration = 680;
    setDrawAnimProgress(0.05);

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDrawAnimProgress(eased);
      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [safeTimelineIdx, currentItem?.phase]);

  useEffect(() => {
    if (currentItem?.phase !== 'solve' || rightPanelTab === 'refine') return;
    const container = solutionListRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-solve-idx="${currentItem.phaseIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentItem, rightPanelTab]);

  /* ==========================================================================
     HÀM GỌI GEMINI TTS CHO 1 CÂU (LƯU CẢ WAV URL VÀ DỮ LIỆU GỐC PCM16)
     ========================================================================== */
  const fetchOrGetSingleTtsEntry = useCallback(
    async (probId, rawVoiceText, apiKey, signal, onCooldownTick) => {
      const naturalSpeech = formatNaturalLectureSpeech(rawVoiceText);
      const cacheKey = `${probId}::${naturalSpeech}`;

      if (ttsStoreRef.current.has(cacheKey)) {
        return { entry: ttsStoreRef.current.get(cacheKey), error: null };
      }

      if (ttsInFlightRef.current.has(cacheKey)) {
        return ttsInFlightRef.current.get(cacheKey);
      }

      if (!apiKey) return { entry: null, error: 'NO_KEY' };

      const taskPromise = (async () => {
        const prompt = `Hãy đóng vai cô giáo dạy Toán THCS giọng nữ chuẩn miền Bắc (Hà Nội), dịu dàng, rõ ràng, truyền cảm, đọc lời giảng bài toán hình học sau cho học sinh hiểu bài:\n\n"${naturalSpeech}"`;
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

        for (let attempt = 0; attempt < 4; attempt++) {
          if (signal?.aborted) return { entry: null, error: 'ABORTED' };
          try {
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal
            });

            if (res.status === 400 || res.status === 403) {
              return { entry: null, error: 'INVALID_KEY' };
            }

            if (res.status === 429) {
              if (attempt < 3) {
                for (let sec = 15; sec >= 1; sec--) {
                  if (signal?.aborted) return { entry: null, error: 'ABORTED' };
                  onCooldownTick?.(sec);
                  await sleepWithSignal(1000, signal);
                }
                onCooldownTick?.(0);
                continue;
              }
              return { entry: null, error: 'RATE_LIMIT' };
            }

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const part = data?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType || '';
            if (audioData && mimeType.startsWith('audio/')) {
              const rateMatch = mimeType.match(/rate=(\d+)/i);
              const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
              const pcmBuffer = base64ToArrayBuffer(audioData);
              const pcm16 = new Int16Array(pcmBuffer);
              const wavBlob = pcmToWav(pcm16, sampleRate);
              const wavUrl = URL.createObjectURL(wavBlob);
              const entry = { url: wavUrl, pcm16, sampleRate };
              ttsStoreRef.current.set(cacheKey, entry);
              return { entry, error: null };
            }
          } catch (err) {
            if (err?.name === 'AbortError' || signal?.aborted) {
              return { entry: null, error: 'ABORTED' };
            }
            if (attempt < 3) {
              await sleepWithSignal(1200 * (attempt + 1), signal);
            }
          }
        }
        return { entry: null, error: 'NETWORK_OR_QUOTA' };
      })().finally(() => {
        ttsInFlightRef.current.delete(cacheKey);
      });

      ttsInFlightRef.current.set(cacheKey, taskPromise);
      return taskPromise;
    },
    []
  );

  /* ==========================================================================
     TẠO TOÀN BỘ ÂM THANH MỘT LƯỢT CÓ ĐIỀU TIẾT NHỊP
     ========================================================================== */
  const generateAllAudioInOneBatch = useCallback(
    async (targetProblem = activeProblem, showNotification = true) => {
      if (targetProblem.hasStaticAudio) {
        if (showNotification) {
          showToast('Bài mẫu này đã có sẵn file âm thanh tích hợp!');
        }
        return true;
      }

      const apiKey = geminiApiKey.trim();
      const items = buildProblemTimeline(targetProblem);

      if (!apiKey) {
        if (showNotification) {
          showToast('Vui lòng nhập Gemini API Key cá nhân để tạo giọng đọc AI!');
          setApiKeyInput('');
          setApiKeyModalOpen(true);
        }
        return false;
      }

      if (batchAbortRef.current) {
        batchAbortRef.current.abort();
      }
      const controller = new AbortController();
      batchAbortRef.current = controller;

      const initialReady = countCachedSteps(targetProblem, items);
      if (initialReady >= items.length) {
        setAudioBatchStatus({
          isGenerating: false,
          readyCount: items.length,
          totalCount: items.length,
          statusNote: ''
        });
        if (showNotification) {
          showToast(`Toàn bộ ${items.length}/${items.length} đoạn âm thanh đã sẵn sàng!`);
        }
        return true;
      }

      setAudioBatchStatus({
        isGenerating: true,
        readyCount: initialReady,
        totalCount: items.length,
        statusNote: ''
      });

      let fatalError = null;

      for (let idx = 0; idx < items.length; idx++) {
        if (controller.signal.aborted) return false;

        const item = items[idx];
        const speech = formatNaturalLectureSpeech(item.voiceText);
        const key = `${targetProblem.id}::${speech}`;

        if (ttsStoreRef.current.has(key)) {
          const currentReady = countCachedSteps(targetProblem, items);
          setAudioBatchStatus({
            isGenerating: true,
            readyCount: currentReady,
            totalCount: items.length,
            statusNote: ''
          });
          continue;
        }

        const result = await fetchOrGetSingleTtsEntry(
          targetProblem.id,
          item.voiceText,
          apiKey,
          controller.signal,
          (secLeft) => {
            if (controller.signal.aborted) return;
            const currentReady = countCachedSteps(targetProblem, items);
            setAudioBatchStatus({
              isGenerating: true,
              readyCount: currentReady,
              totalCount: items.length,
              statusNote: secLeft > 0 ? `Hồi lượt API (${secLeft}s)` : ''
            });
          }
        );

        if (controller.signal.aborted) return false;

        if (result.error === 'INVALID_KEY') {
          fatalError = 'INVALID_KEY';
          break;
        }

        if (result.error === 'RATE_LIMIT') {
          fatalError = 'RATE_LIMIT';
          break;
        }

        const currentReady = countCachedSteps(targetProblem, items);
        setAudioBatchStatus({
          isGenerating: true,
          readyCount: currentReady,
          totalCount: items.length,
          statusNote: ''
        });

        if (idx < items.length - 1) {
          await sleepWithSignal(550, controller.signal);
        }
      }

      if (controller.signal.aborted) return false;

      const finalReady = countCachedSteps(targetProblem, items);
      setAudioBatchStatus({
        isGenerating: false,
        readyCount: finalReady,
        totalCount: items.length,
        statusNote: ''
      });

      if (showNotification) {
        if (fatalError === 'INVALID_KEY') {
          showToast('Gemini API Key không hợp lệ. Hãy kiểm tra lại nút API Key!');
        } else if (fatalError === 'RATE_LIMIT') {
          showToast(
            `Google API tạm giới hạn lượt/phút (đã tạo ${finalReady}/${items.length} bước). Hệ thống dùng giọng trình duyệt cho các bước còn lại.`
          );
        } else if (finalReady > 0) {
          showToast(`Đã tạo xong ${finalReady}/${items.length} đoạn giọng giảng AI!`);
        } else {
          showToast('Không kết nối được Gemini TTS — Hệ thống tự chuyển sang giọng đọc trình duyệt.');
        }
      }
      return finalReady === items.length;
    },
    [activeProblem, geminiApiKey, countCachedSteps, fetchOrGetSingleTtsEntry, showToast]
  );

  /* ==========================================================================
     NÚT "LƯU FILE MẪU (.ZIP)" — TỰ NÉN MP3 SIÊU NHẸ & ĐÓNG GÓI TRỌN BỘ
     ========================================================================== */
  const handleSaveSamplePackageZip = async () => {
    if (isPackingSampleZip) return;
    setIsPackingSampleZip(true);
    stopPlaybackOnly();
    setIsAutoTeaching(false);

    try {
      const items = buildProblemTimeline(activeProblem);

      // 1. Nếu bài chưa có file tĩnh và còn thiếu âm thanh trong bộ nhớ thì tự tạo cho đủ
      if (!activeProblem.hasStaticAudio) {
        const readyNow = countCachedSteps(activeProblem, items);
        if (readyNow < items.length) {
          if (!geminiApiKey.trim()) {
            showToast('Cần nhập Gemini API Key để tạo âm thanh trước khi đóng gói bài mẫu!');
            setIsPackingSampleZip(false);
            setApiKeyModalOpen(true);
            return;
          }
          showToast('Đang hoàn tất các đoạn âm thanh trước khi nén MP3...');
          await generateAllAudioInOneBatch(activeProblem, false);
        }
      }

      // 2. Tải thư viện nén MP3 (lamejs) và nén ZIP (JSZip)
      showToast('Đang nén âm thanh sang MP3 siêu nhẹ và đóng gói bài mẫu...');
      await Promise.all([
        loadExternalScript(LAMEJS_CDN).catch(() => null),
        loadExternalScript(JSZIP_CDN)
      ]);

      if (!window.JSZip) {
        throw new Error('Không tải được trình nén ZIP.');
      }

      const zip = new window.JSZip();
      const audioFolder = zip.folder(`public/audio/${activeProblem.id}`);
      let mp3Count = 0;
      let wavCount = 0;

      // 3. Chuyển đổi từng bước sang MP3 (48kbps Mono) và đưa vào thư mục public/audio/<id>/
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const speech = formatNaturalLectureSpeech(item.voiceText);
        const key = `${activeProblem.id}::${speech}`;
        const entry = ttsStoreRef.current.get(key);

        if (entry?.pcm16) {
          const mp3Blob = encodePcm16ToMp3Blob(entry.pcm16, entry.sampleRate || 24000);
          if (mp3Blob) {
            audioFolder.file(`${idx}.mp3`, mp3Blob);
            mp3Count++;
          } else {
            const wavBlob = pcmToWav(entry.pcm16, entry.sampleRate || 24000);
            audioFolder.file(`${idx}.wav`, wavBlob);
            wavCount++;
          }
        } else if (activeProblem.hasStaticAudio) {
          // Nếu là bài mẫu sẵn có trên server thì fetch file mp3 về đưa vào gói
          try {
            const res = await fetch(`/audio/${activeProblem.id}/${idx}.mp3`);
            if (res.ok) {
              const blob = await res.blob();
              audioFolder.file(`${idx}.mp3`, blob);
              mp3Count++;
            }
          } catch {
            // Bỏ qua nếu không fetch được
          }
        }
      }

      // 4. Tạo bản ghi bài mẫu với hasStaticAudio: true và gộp vào src/data/savedSamples.json
      const approvedProblem = {
        ...activeProblem,
        hasStaticAudio: true
      };

      const existingSaved = Array.isArray(SAVED_SAMPLES) ? SAVED_SAMPLES : [];
      const mergedSaved = [
        approvedProblem,
        ...existingSaved.filter((p) => p.id !== approvedProblem.id)
      ];

      zip.file('src/data/savedSamples.json', JSON.stringify(mergedSaved, null, 2));
      zip.file(`bai_mau_rieng_${activeProblem.id}.json`, JSON.stringify(approvedProblem, null, 2));

      const guideText = `HƯỚNG DẪN ĐƯA BÀI MẪU "${approvedProblem.title}" LÊN GITHUB ĐỂ MỞ SIÊU NHANH
=============================================================================

Gói này đã tự động nén ${mp3Count} file MP3${wavCount > 0 ? ` (${wavCount} file WAV)` : ''} siêu nhẹ và cấu hình sẵn bài mẫu.

BẠN CHỈ CẦN LÀM 2 BƯỚC TRÊN GITHUB:
1. Mở thư mục "public/audio/${activeProblem.id}/" trong file ZIP này và tải toàn bộ các file âm thanh (0.mp3, 1.mp3...) vào đúng đường dẫn "public/audio/${activeProblem.id}/" trên GitHub.
2. Mở file "src/data/savedSamples.json" trên GitHub và thay toàn bộ nội dung bằng file "src/data/savedSamples.json" có trong gói ZIP này rồi bấm Commit changes.

Sau khi Cloudflare Pages cập nhật (~1 phút), học sinh và giáo viên mở trang web lên sẽ thấy ngay bài mẫu này ở đầu danh sách và phát giọng đọc ngay lập tức mà KHÔNG cần nhập API Key!
`;
      zip.file('HUONG_DAN_LUU_MAU.txt', guideText);

      // 5. Xuất tải file ZIP về máy
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `bai_mau_${activeProblem.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      // Cập nhật luôn trạng thái trên trình duyệt hiện tại
      setCustomProblems((prev) =>
        prev.map((p) => (p.id === activeProblem.id ? { ...p, hasStaticAudio: true } : p))
      );

      showToast(
        `Đã xuất gói bai_mau_${activeProblem.id}.zip (${mp3Count} file MP3 + savedSamples.json)!`
      );
    } catch (err) {
      showToast(`Lỗi khi đóng gói file mẫu: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsPackingSampleZip(false);
    }
  };

  // Phát âm thanh cho bước hiện tại
  const narrateTimelineStep = useCallback(
    async (tIdx, autoNextAfterFinish = false, forceVoice = false) => {
      const item = timelineItems[tIdx];
      if (!item) return;

      stopPlaybackOnly();

      const advanceIfNeeded = () => {
        if (!autoNextAfterFinish) return;
        if (tIdx < timelineItems.length - 1) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            setCurrentTimelineIdx(tIdx + 1);
          }, 550);
        } else {
          setIsAutoTeaching(false);
          showToast('Đã hoàn thành toàn bộ phần vẽ hình và lời giải!');
        }
      };

      if (!voiceEnabled && !forceVoice) {
        if (autoNextAfterFinish) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            advanceIfNeeded();
          }, 3000);
        }
        return;
      }

      const naturalSpeech = formatNaturalLectureSpeech(item.voiceText);
      const cacheKey = `${activeProblem.id}::${naturalSpeech}`;

      const playBrowserFallback = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const viVoice = getStrictVietnameseVoice();
          if (viVoice) {
            const utter = new SpeechSynthesisUtterance(naturalSpeech);
            utter.voice = viVoice;
            utter.lang = 'vi-VN';
            utter.rate = 0.96;
            utter.onend = () => {
              setIsSpeakingNow(false);
              advanceIfNeeded();
            };
            utter.onerror = () => {
              setIsSpeakingNow(false);
              advanceIfNeeded();
            };
            window.speechSynthesis.speak(utter);
            return;
          }
        }
        setIsSpeakingNow(false);
        advanceIfNeeded();
      };

      // 1. Ưu tiên phát từ bộ nhớ tạm nếu vừa mới tạo trên trình duyệt
      const cachedEntry = ttsStoreRef.current.get(cacheKey);
      if (cachedEntry?.url) {
        setIsSpeakingNow(true);
        const audio = new Audio(cachedEntry.url);
        currentAudioRef.current = audio;
        audio.onended = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          setIsSpeakingNow(false);
          advanceIfNeeded();
        };
        audio.onerror = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          playBrowserFallback();
        };
        audio.play().catch(() => {
          playBrowserFallback();
        });
        return;
      }

      // 2. Nếu bài mẫu đã lưu file tĩnh trong public/audio/<id>/<idx>.mp3 -> Phát ngay!
      if (activeProblem.hasStaticAudio) {
        setIsSpeakingNow(true);
        const staticMp3Url = `/audio/${activeProblem.id}/${tIdx}.mp3`;
        const audio = new Audio(staticMp3Url);
        currentAudioRef.current = audio;
        audio.onended = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          setIsSpeakingNow(false);
          advanceIfNeeded();
        };
        audio.onerror = () => {
          // Thử fallback sang .wav nếu người dùng lưu file wav
          const staticWavUrl = `/audio/${activeProblem.id}/${tIdx}.wav`;
          const wavAudio = new Audio(staticWavUrl);
          currentAudioRef.current = wavAudio;
          wavAudio.onended = () => {
            if (currentAudioRef.current === wavAudio) currentAudioRef.current = null;
            setIsSpeakingNow(false);
            advanceIfNeeded();
          };
          wavAudio.onerror = () => {
            if (currentAudioRef.current === wavAudio) currentAudioRef.current = null;
            playBrowserFallback();
          };
          wavAudio.play().catch(() => playBrowserFallback());
        };
        audio.play().catch(() => {
          playBrowserFallback();
        });
        return;
      }

      // 3. Các bài dùng API Key cá nhân
      const apiKey = geminiApiKey.trim();
      if (apiKey && !audioBatchStatus.isGenerating) {
        generateAllAudioInOneBatch(activeProblem, false);
      }

      const controller = new AbortController();
      playbackAbortRef.current = controller;
      setIsSpeakingNow(true);

      const { entry } = await fetchOrGetSingleTtsEntry(
        activeProblem.id,
        item.voiceText,
        apiKey,
        controller.signal
      );

      if (controller.signal.aborted) return;

      if (entry?.url) {
        const audio = new Audio(entry.url);
        currentAudioRef.current = audio;
        audio.onended = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          setIsSpeakingNow(false);
          advanceIfNeeded();
        };
        audio.onerror = () => {
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          playBrowserFallback();
        };
        audio.play().catch(() => {
          playBrowserFallback();
        });
        return;
      }

      playBrowserFallback();
    },
    [
      timelineItems,
      activeProblem,
      voiceEnabled,
      geminiApiKey,
      audioBatchStatus.isGenerating,
      stopPlaybackOnly,
      fetchOrGetSingleTtsEntry,
      generateAllAudioInOneBatch,
      showToast
    ]
  );

  useEffect(() => {
    if (!isAutoTeaching) return;
    narrateTimelineStep(safeTimelineIdx, true, false);
  }, [isAutoTeaching, safeTimelineIdx, narrateTimelineStep]);

  const handleSelectProblem = (probId) => {
    stopPlaybackOnly();
    if (batchAbortRef.current) {
      batchAbortRef.current.abort();
      batchAbortRef.current = null;
    }
    const nextProb = problems.find((p) => p.id === probId) || problems[0];
    const nextItems = buildProblemTimeline(nextProb);
    const nextReady = countCachedSteps(nextProb, nextItems);

    setAudioBatchStatus({
      isGenerating: false,
      readyCount: nextReady,
      totalCount: nextItems.length,
      statusNote: ''
    });

    setIsAutoTeaching(false);
    setSelectedProblemId(probId);
    setCurrentTimelineIdx(0);
    setRightPanelTab('auto');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDeleteCurrentCustomProblem = () => {
    if (!isCurrentCustom) return;
    stopPlaybackOnly();
    if (batchAbortRef.current) {
      batchAbortRef.current.abort();
      batchAbortRef.current = null;
    }
    setIsAutoTeaching(false);
    const remaining = customProblems.filter((p) => p.id !== activeProblem.id);
    setCustomProblems(remaining);
    const fallbackList = [...remaining, ...(Array.isArray(SAVED_SAMPLES) ? SAVED_SAMPLES : []), ...SAMPLE_PROBLEMS];
    const nextProb = fallbackList[0];
    const nextItems = buildProblemTimeline(nextProb);
    setAudioBatchStatus({
      isGenerating: false,
      readyCount: countCachedSteps(nextProb, nextItems),
      totalCount: nextItems.length,
      statusNote: ''
    });
    setSelectedProblemId(nextProb.id);
    setCurrentTimelineIdx(0);
    setRightPanelTab('auto');
    showToast('Đã xóa bài toán tự tạo khỏi danh sách.');
  };

  const handleGoToTimelineIdx = (idx) => {
    setIsAutoTeaching(false);
    setCurrentTimelineIdx(idx);
    narrateTimelineStep(idx, false, false);
  };

  const handleToggleAutoTeach = () => {
    if (isAutoTeaching) {
      stopPlaybackOnly();
      setIsAutoTeaching(false);
    } else {
      if (safeTimelineIdx >= totalTimelineCount - 1) {
        setCurrentTimelineIdx(0);
      }
      setIsAutoTeaching(true);
    }
  };

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

      renderGeometryScene(
        ctx,
        activeProblem.geometry,
        currentItem,
        drawAnimProgress,
        pulsePhase,
        false
      );

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
  }, [activeProblem, currentItem, drawAnimProgress, pulsePhase, showGrid, zoom, pan, isPresentation]);

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
        activeProblem.geometry,
        { phase: 'solve', phaseIndex: 999, meta: {} },
        1,
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

  /* ==========================================================================
     XỬ LÝ TẢI FILE VĂN BẢN (.TXT, .MD) & HÌNH ẢNH ĐỀ BÀI
     ========================================================================== */
  const handleUploadTextFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '').trim();
      if (content) {
        setCustomPromptInput(content);
        showToast(`Đã nạp nội dung từ tệp "${file.name}"!`);
      } else {
        showToast('Tệp văn bản trống.');
      }
    };
    reader.onerror = () => showToast('Không đọc được tệp văn bản.');
    reader.readAsText(file, 'UTF-8');
  };

  const handleUploadCustomImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imgObj = await readImageFileAsBase64(file);
      setCustomImageAttachment(imgObj);
      showToast(`Đã đính kèm ảnh "${imgObj.fileName}"!`);
    } catch (err) {
      showToast(err?.message || 'Lỗi chọn ảnh.');
    }
  };

  const handlePasteInCustomModal = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const imgObj = await readImageFileAsBase64(file);
            setCustomImageAttachment(imgObj);
            showToast('Đã dán ảnh chụp màn hình đề bài!');
          } catch {
            // Bỏ qua
          }
        }
        break;
      }
    }
  };

  /* ==========================================================================
     GỌI GEMINI 2.5 FLASH TẠO BÀI MỚI TỪ VĂN BẢN VÀ/HOẶC HÌNH ẢNH
     ========================================================================== */
  const callGeminiStructuredGeometry = async (parts, apiKey) => {
    const payload = {
      contents: [{ parts }],
      systemInstruction: { parts: [{ text: TEACHER_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PROBLEM_JSON_SCHEMA
      }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
          return JSON.parse(rawJson);
        }
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    return null;
  };

  const handleGenerateCustomProblem = async () => {
    const trimmed = customPromptInput.trim();
    if (!trimmed && !customImageAttachment) {
      showToast('Bạn hãy nhập đề bài, tải tệp văn bản hoặc tải ảnh đề bài lên nhé!');
      return;
    }

    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      showToast('Để thêm đề mới bằng AI, vui lòng nhập Gemini API Key miễn phí của bạn!');
      setApiKeyInput('');
      setApiKeyModalOpen(true);
      return;
    }

    setIsGeneratingAI(true);
    stopPlaybackOnly();
    if (batchAbortRef.current) {
      batchAbortRef.current.abort();
      batchAbortRef.current = null;
    }
    setIsAutoTeaching(false);

    const parts = [];
    if (customImageAttachment) {
      parts.push({
        inlineData: {
          mimeType: customImageAttachment.mimeType,
          data: customImageAttachment.base64
        }
      });
    }
    const promptInstruction = trimmed
      ? `Hãy đọc đề bài (và hình vẽ đính kèm nếu có), chia các bước vẽ hình tọa độ 2D và viết lời giải ngắn gọn, logic từng dòng cho bài toán sau:\n\n"${trimmed}"`
      : 'Hãy đọc nội dung đề bài và hình vẽ trong ảnh đính kèm, trích xuất đầy đủ đề bài, chia các bước vẽ hình tọa độ 2D và viết lời giải ngắn gọn, logic từng dòng.';
    parts.push({ text: promptInstruction });

    const parsed = await callGeminiStructuredGeometry(parts, apiKey);
    setIsGeneratingAI(false);

    if (parsed && parsed.solutionSteps && parsed.solutionSteps.length > 0) {
      const newId = `mau_${Date.now()}`;
      const createdProblem = {
        id: newId,
        hasStaticAudio: false,
        grade: parsed.grade || 'Toán THCS (AI)',
        title: parsed.title || 'Bài toán hình học mới',
        problemText: parsed.problemText || trimmed || 'Bài toán hình học từ hình ảnh',
        given: parsed.given || [],
        prove: parsed.prove || [],
        drawingSteps: parsed.drawingSteps || [],
        geometry: parsed.geometry,
        solutionSteps: parsed.solutionSteps
      };
      setCustomProblems((prev) => [createdProblem, ...prev]);
      setSelectedProblemId(newId);
      setCurrentTimelineIdx(0);
      setRightPanelTab('refine'); // Mở sẵn tab Chỉnh AI để bạn duyệt ngay
      setCustomModalOpen(false);
      setCustomPromptInput('');
      setCustomImageAttachment(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      showToast('Đã dựng xong hình & lời giải! Đang tự động tạo sẵn âm thanh...');
      generateAllAudioInOneBatch(createdProblem, true);
    } else {
      showToast('Không thể phân tích đề bài. Hãy kiểm tra lại Gemini API Key hoặc ảnh rõ nét hơn nhé!');
    }
  };

  /* ==========================================================================
     CHAT ĐIỀU CHỈNH VỚI AI (SỬA HÌNH VẼ, LỜI GIẢI, GIỌNG ĐỌC CHO VỪA Ý)
     ========================================================================== */
  const handleSendRefineMessage = async (overrideInstruction = null) => {
    const instruction = (overrideInstruction ?? refineInput).trim();
    if (!instruction && !refineImageAttachment) {
      showToast('Hãy nhập yêu cầu chỉnh sửa cho AI (ví dụ: chỉnh điểm, thêm nét vẽ, sửa lời giải)...');
      return;
    }

    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      showToast('Cần nhập Gemini API Key để trò chuyện điều chỉnh với AI!');
      setApiKeyModalOpen(true);
      return;
    }

    if (isRefiningAI) return;
    setIsRefiningAI(true);
    stopPlaybackOnly();
    setIsAutoTeaching(false);

    const userDisplayMsg = instruction || 'Điều chỉnh theo hình ảnh minh họa đính kèm';
    setRefineChatsByProblem((prev) => {
      const oldList = prev[activeProblem.id] || currentRefineMessages;
      return {
        ...prev,
        [activeProblem.id]: [...oldList, { role: 'user', text: userDisplayMsg }]
      };
    });

    const attachedImg = refineImageAttachment;
    if (!overrideInstruction) setRefineInput('');
    setRefineImageAttachment(null);

    const parts = [];
    if (attachedImg) {
      parts.push({
        inlineData: {
          mimeType: attachedImg.mimeType,
          data: attachedImg.base64
        }
      });
    }

    const currentCleanJson = {
      grade: activeProblem.grade,
      title: activeProblem.title,
      problemText: activeProblem.problemText,
      given: activeProblem.given,
      prove: activeProblem.prove,
      drawingSteps: activeProblem.drawingSteps,
      geometry: activeProblem.geometry,
      solutionSteps: activeProblem.solutionSteps
    };

    parts.push({
      text: `Dưới đây là dữ liệu JSON hiện tại của bài toán hình học:\n${JSON.stringify(
        currentCleanJson
      )}\n\nNgười dùng yêu cầu điều chỉnh như sau:\n"${userDisplayMsg}"\n\nHãy giữ nguyên các phần đã tốt và cập nhật chính xác tọa độ hình vẽ, các bước vẽ hình hoặc lời giải theo đúng yêu cầu trên. Trả về toàn bộ JSON hoàn chỉnh theo đúng cấu trúc.`
    });

    const parsed = await callGeminiStructuredGeometry(parts, apiKey);
    setIsRefiningAI(false);

    if (parsed && parsed.solutionSteps && parsed.solutionSteps.length > 0) {
      const updatedProblem = {
        ...activeProblem,
        hasStaticAudio: false, // Đánh dấu cần cập nhật lại audio cho các bước thay đổi
        grade: parsed.grade || activeProblem.grade,
        title: parsed.title || activeProblem.title,
        problemText: parsed.problemText || activeProblem.problemText,
        given: parsed.given || activeProblem.given,
        prove: parsed.prove || activeProblem.prove,
        drawingSteps: parsed.drawingSteps || activeProblem.drawingSteps,
        geometry: parsed.geometry || activeProblem.geometry,
        solutionSteps: parsed.solutionSteps || activeProblem.solutionSteps
      };

      // Lưu bản đã chỉnh sửa vào danh sách bài tùy chỉnh (nếu đang sửa bài mẫu thì tạo bản sao chỉnh sửa)
      setCustomProblems((prev) => {
        const exists = prev.some((p) => p.id === updatedProblem.id);
        if (exists) {
          return prev.map((p) => (p.id === updatedProblem.id ? updatedProblem : p));
        }
        return [updatedProblem, ...prev];
      });

      setRefineChatsByProblem((prev) => {
        const oldList = prev[activeProblem.id] || [];
        return {
          ...prev,
          [activeProblem.id]: [
            ...oldList,
            {
              role: 'ai',
              text: 'Đã cập nhật hình vẽ và lời giải theo đúng yêu cầu! Bạn kiểm tra lại bên trái nhé — nếu ưng ý rồi hãy bấm nút "Lưu file mẫu (.ZIP)" ở trên.'
            }
          ]
        };
      });

      showToast('Đã cập nhật theo yêu cầu! Đang tạo lại âm thanh cho các bước mới...');
      generateAllAudioInOneBatch(updatedProblem, false);
    } else {
      setRefineChatsByProblem((prev) => {
        const oldList = prev[activeProblem.id] || [];
        return {
          ...prev,
          [activeProblem.id]: [
            ...oldList,
            {
              role: 'ai',
              text: 'Xin lỗi, AI chưa xử lý được yêu cầu này. Bạn thử diễn đạt cụ thể hơn (ví dụ: dịch điểm M sang phải 30 đơn vị) nhé!'
            }
          ]
        };
      });
    }
  };

  const isAllAudioReady =
    activeProblem.hasStaticAudio ||
    (audioBatchStatus.totalCount > 0 && audioBatchStatus.readyCount >= audioBatchStatus.totalCount);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0b1120] text-slate-100 font-sans select-none">
      {/* ========================================================================
          THANH TIÊU ĐỀ & CÔNG CỤ TRÊN CÙNG (HEADER)
         ======================================================================== */}
      {!isPresentation && (
        <header className="h-14 shrink-0 bg-[#111827] border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-950/60 shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                Giải & Vẽ Hình Toán Hình Học THCS
              </h1>
              <p className="text-[11px] text-slate-400 truncate hidden xl:block">
                Vẽ hình từng bước • Lời giải ngắn gọn • Duyệt & Lưu bài mẫu MP3 siêu nhẹ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Trạng thái âm thanh */}
            {activeProblem.hasStaticAudio ? (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                title="Bài mẫu đã lưu sẵn file âm thanh nhẹ trên hệ thống, phát ngay không cần API Key"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">
                  Âm thanh có sẵn ({timelineItems.length}/{timelineItems.length})
                </span>
                <span className="lg:hidden">Có sẵn</span>
              </div>
            ) : (
              <button
                onClick={() => generateAllAudioInOneBatch(activeProblem, true)}
                disabled={audioBatchStatus.isGenerating}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isAllAudioReady
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : audioBatchStatus.isGenerating
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border-indigo-500/40'
                }`}
                title="Tạo sẵn toàn bộ âm thanh tất cả các bước bằng Gemini API Key"
              >
                {audioBatchStatus.isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {audioBatchStatus.statusNote
                        ? `${audioBatchStatus.statusNote} (${audioBatchStatus.readyCount}/${audioBatchStatus.totalCount})`
                        : `Tạo âm thanh (${audioBatchStatus.readyCount}/${audioBatchStatus.totalCount})`}
                    </span>
                  </>
                ) : (
                  <>
                    <Headphones className="w-3.5 h-3.5 text-sky-400" />
                    <span className="hidden lg:inline">
                      Âm thanh ({audioBatchStatus.readyCount}/{audioBatchStatus.totalCount})
                    </span>
                    <span className="lg:hidden">
                      {audioBatchStatus.readyCount}/{audioBatchStatus.totalCount}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Nút Lưu file mẫu (.ZIP) — tự nén MP3 & đóng gói JSON */}
            <button
              onClick={handleSaveSamplePackageZip}
              disabled={isPackingSampleZip || audioBatchStatus.isGenerating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition"
              title="Duyệt xong & Lưu file mẫu (.ZIP) gồm âm thanh nén MP3 siêu nhẹ + file JSON cấu hình"
            >
              {isPackingSampleZip ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PackageCheck className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">Lưu file mẫu</span>
            </button>

            <button
              onClick={handleOpenApiKeyModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                geminiApiKey
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
              title="Cài đặt Gemini API Key cá nhân"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{geminiApiKey ? 'API Key' : 'Nhập Key'}</span>
            </button>

            <button
              onClick={() => setCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nhập đề mới (AI)</span>
            </button>

            <button
              onClick={handleExportPNG}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Tải ảnh hình vẽ nền trắng"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xl:inline">PNG</span>
            </button>

            <button
              onClick={() => setIsPresentation(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
              title="Mở rộng toàn màn hình trình chiếu"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trình chiếu</span>
            </button>
          </div>
        </header>
      )}

      {/* ========================================================================
          KHU VỰC NỘI DUNG CHÍNH: BẢNG HÌNH VẼ (TRÁI) & LỜI GIẢI / CHỈNH AI (PHẢI)
         ======================================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* CỘT TRÁI: ĐỀ BÀI & CANVAS HÌNH VẼ */}
        <section className="flex-1 flex flex-col min-w-0 min-h-[45%] lg:min-h-0 bg-[#090d16] border-b lg:border-b-0 lg:border-r border-slate-800 relative">
          {!isPresentation && (
            <div className="shrink-0 bg-[#0f172a] border-b border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                <select
                  value={activeProblem.id}
                  onChange={(e) => handleSelectProblem(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-100 max-w-full truncate focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {problems.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.grade}] {p.title} {p.hasStaticAudio ? '★' : ''}
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
                <span className="text-[11px] font-mono text-slate-400 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
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

          <div className="shrink-0 bg-slate-900/75 border-b border-slate-800/80 px-4 py-2 space-y-1.5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px]">
                  <span className="font-bold text-sky-400 uppercase tracking-wider mr-1.5">GT:</span>
                  <span className="text-slate-300">{activeProblem.given.join(' ; ')}</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px]">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider mr-1.5">KL:</span>
                  <span className="text-slate-300">{activeProblem.prove.join(' ; ')}</span>
                </div>
              </div>
            )}
          </div>

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

            <div className="absolute top-3 left-3 pointer-events-none">
              {currentItem.phase === 'draw' ? (
                <div className="inline-flex items-center gap-2 bg-sky-950/90 backdrop-blur border border-sky-500/50 text-sky-200 px-3 py-1 rounded-full text-[11px] font-semibold shadow-lg">
                  <PenTool className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Vẽ hình: Bước {currentItem.phaseIndex + 1}/{currentItem.phaseTotal}
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-amber-950/85 backdrop-blur border border-amber-500/40 text-amber-200 px-3 py-1 rounded-full text-[11px] font-semibold shadow-lg">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hình vẽ hoàn chỉnh • Minh họa lời giải</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CỘT PHẢI: TAB 1. VẼ HÌNH | 2. LỜI GIẢI | 3. CHỈNH AI */}
        <aside className="w-full lg:w-[450px] xl:w-[500px] shrink-0 bg-[#0f172a] flex flex-col min-h-[45%] lg:min-h-0">
          <div className="shrink-0 bg-[#111827] border-b border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
              <button
                onClick={() => {
                  setRightPanelTab('auto');
                  handleGoToTimelineIdx(0);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  rightPanelTab !== 'refine' && currentItem.phase === 'draw'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Vẽ hình
              </button>
              <button
                onClick={() => {
                  setRightPanelTab('auto');
                  handleGoToTimelineIdx(drawStepsCount);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  rightPanelTab !== 'refine' && currentItem.phase === 'solve'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Lời giải
              </button>
              <button
                onClick={() => setRightPanelTab('refine')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition ${
                  rightPanelTab === 'refine'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-amber-300 hover:bg-slate-800'
                }`}
                title="Nhắn tin cho AI điều chỉnh hình vẽ, lời giải hoặc giọng đọc"
              >
                <Wand2 className="w-3 h-3" />
                <span>3. Chỉnh AI</span>
              </button>
            </div>

            {rightPanelTab !== 'refine' && (
              <button
                onClick={() => setShowAllSolutionLines((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  showAllSolutionLines
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Hiện lần lượt từng dòng hoặc hiện cả bài giải"
              >
                <Eye className="w-3 h-3" />
                <span>{showAllSolutionLines ? 'Cả bài' : 'Từng dòng'}</span>
              </button>
            )}
          </div>

          {/* NỘI DUNG BÊN TRONG CỘT PHẢI */}
          {rightPanelTab === 'refine' ? (
            /* TAB 3: Ô CHAT ĐIỀU CHỈNH VỚI AI & DUYỆT LƯU FILE MẪU */
            <div className="flex-1 flex flex-col min-h-0 bg-[#0b1221]">
              <div className="shrink-0 bg-slate-900/90 border-b border-slate-800 px-3.5 py-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Duyệt & Điều chỉnh bài với AI</span>
                </span>
                <button
                  onClick={handleSaveSamplePackageZip}
                  disabled={isPackingSampleZip || audioBatchStatus.isGenerating}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>OK • Lưu file mẫu (.ZIP)</span>
                </button>
              </div>

              {/* Lịch sử chat điều chỉnh */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {currentRefineMessages.map((msg, mIdx) => (
                  <div
                    key={mIdx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-800/95 text-slate-200 border border-slate-700/80 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isRefiningAI && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-sky-300 inline-flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>AI đang chỉnh sửa hình vẽ và lời giải...</span>
                    </div>
                  </div>
                )}
                <div ref={refineChatEndRef} />
              </div>

              {/* Gợi ý nhanh */}
              <div className="shrink-0 px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/60 flex gap-1.5 overflow-x-auto">
                {AI_REFINE_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendRefineMessage(chip)}
                    disabled={isRefiningAI}
                    className="shrink-0 text-[10.5px] px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Ảnh đính kèm trong khung chat (nếu có) */}
              {refineImageAttachment && (
                <div className="shrink-0 px-3 pt-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={refineImageAttachment.previewUrl}
                      alt="Ảnh đính kèm"
                      className="w-9 h-9 rounded object-cover border border-slate-700"
                    />
                    <span className="text-[11px] text-slate-300 truncate">
                      {refineImageAttachment.fileName}
                    </span>
                  </div>
                  <button
                    onClick={() => setRefineImageAttachment(null)}
                    className="p-1 text-slate-400 hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Ô nhập lệnh chỉnh sửa cho AI */}
              <div className="shrink-0 p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5">
                <input
                  ref={refineImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const imgObj = await readImageFileAsBase64(file);
                      setRefineImageAttachment(imgObj);
                    } catch {
                      // Bỏ qua
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => refineImageInputRef.current?.click()}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0 transition"
                  title="Gửi kèm ảnh hình vẽ mẫu để AI chỉnh theo"
                >
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                </button>
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendRefineMessage();
                    }
                  }}
                  placeholder="Nhắn AI chỉnh hình hoặc lời giải..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <button
                  onClick={() => handleSendRefineMessage()}
                  disabled={isRefiningAI}
                  className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold shrink-0 transition"
                  title="Gửi yêu cầu chỉnh sửa"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* TAB 1 & 2: HIỂN THỊ LỜI GIẢI NGẮN GỌN, LOGIC */
            <div ref={solutionListRef} className="flex-1 overflow-y-auto p-4">
              {currentItem.phase === 'draw' && !showAllSolutionLines ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-3">
                  <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-200">
                      Đang thực hiện vẽ hình trên bảng
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Lời giải ngắn gọn sẽ tự động hiển thị tại đây ngay sau khi hoàn tất phần vẽ hình.
                    </p>
                  </div>
                  <button
                    onClick={() => handleGoToTimelineIdx(drawStepsCount)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold transition"
                  >
                    <span>Chuyển sang trình bày lời giải</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="bg-slate-950/75 border border-slate-800/90 rounded-2xl p-4 space-y-1.5 shadow-inner">
                  {activeProblem.solutionSteps.map((step, sIdx) => {
                    const isSolvePhase = currentItem.phase === 'solve';
                    const activeSolveIdx = isSolvePhase ? currentItem.phaseIndex : -1;
                    const isVisible =
                      showAllSolutionLines || (isSolvePhase && sIdx <= activeSolveIdx);
                    const isActive = isSolvePhase && sIdx === activeSolveIdx;

                    if (!isVisible) return null;

                    return (
                      <div
                        key={sIdx}
                        data-solve-idx={sIdx}
                        onClick={() => handleGoToTimelineIdx(drawStepsCount + sIdx)}
                        className={`px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer border-l-2 ${
                          isActive
                            ? 'bg-blue-950/75 border-l-amber-400 text-white font-semibold shadow-sm'
                            : 'border-l-transparent text-slate-200 hover:bg-slate-900/90'
                        }`}
                      >
                        <p className="text-xs sm:text-[13.5px] leading-relaxed whitespace-pre-wrap">
                          {step.lineText}
                        </p>
                      </div>
                    );
                  })}

                  {!showAllSolutionLines &&
                    currentItem.phase === 'solve' &&
                    currentItem.phaseIndex < solveStepsCount - 1 && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleGoToTimelineIdx(safeTimelineIdx + 1)}
                          className="w-full py-2 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Hiện dòng tiếp theo</span>
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* THANH ĐIỀU KHIỂN PHÁT TỰ ĐỘNG GIẢNG */}
          <div className="shrink-0 bg-[#111827] border-t border-slate-800 px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  stopPlaybackOnly();
                  setIsAutoTeaching(false);
                  setCurrentTimelineIdx(0);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                title="Quay về từ đầu (Vẽ hình bước 1)"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleGoToTimelineIdx(Math.max(0, safeTimelineIdx - 1))}
                disabled={safeTimelineIdx === 0}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition"
                title="Lùi lại"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleToggleAutoTeach}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-950/50 transition"
              >
                {isAutoTeaching ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isAutoTeaching ? 'Tạm dừng' : 'Tự động giảng'}</span>
              </button>

              <button
                onClick={() =>
                  handleGoToTimelineIdx(Math.min(totalTimelineCount - 1, safeTimelineIdx + 1))
                }
                disabled={safeTimelineIdx >= totalTimelineCount - 1}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition"
                title="Tiếp theo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400">
              {safeTimelineIdx + 1} / {totalTimelineCount}
            </div>
          </div>
        </aside>
      </div>

      {/* ========================================================================
          THANH LỜI VĂN / PHỤ ĐỀ Ở CUỐI TRANG
         ======================================================================== */}
      <footer className="shrink-0 bg-[#0b1324] border-t border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {currentItem.phase === 'draw' ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold uppercase tracking-wide">
              <PenTool className="w-3.5 h-3.5" />
              <span>
                Vẽ hình • Bước {currentItem.phaseIndex + 1}/{currentItem.phaseTotal}
              </span>
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold uppercase tracking-wide">
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>
                Giảng giải • Dòng {currentItem.phaseIndex + 1}/{currentItem.phaseTotal}
              </span>
            </span>
          )}

          <p className="text-xs sm:text-sm text-slate-100 leading-snug line-clamp-2 font-medium">
            {currentItem.subtitleText}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => narrateTimelineStep(safeTimelineIdx, false, true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
            title="Đọc lại lời văn hiện tại"
          >
            <Volume2
              className={`w-3.5 h-3.5 ${isSpeakingNow ? 'animate-pulse text-emerald-400' : ''}`}
            />
            <span className="hidden sm:inline">{isSpeakingNow ? 'Đang đọc...' : 'Đọc lại'}</span>
          </button>

          <button
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              if (!next) {
                stopPlaybackOnly();
              } else {
                narrateTimelineStep(safeTimelineIdx, false, true);
              }
            }}
            className={`p-1.5 rounded-lg border transition ${
              voiceEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title={voiceEnabled ? 'Đang bật giọng đọc' : 'Đang tắt giọng đọc'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </footer>

      {/* ========================================================================
          MODAL CÀI ĐẶT GEMINI API KEY
         ======================================================================== */}
      {apiKeyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Cài đặt Gemini API Key cá nhân</h3>
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
                Các bài mẫu có sẵn âm thanh chạy trực tiếp không cần Key. Khi bạn muốn{' '}
                <strong>thêm đề mới bằng AI</strong> hoặc <strong>chat chỉnh sửa bài</strong>, hãy
                dán Gemini API Key miễn phí vào đây (lưu trực tiếp trên trình duyệt của bạn).
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
          MODAL NHẬP ĐỀ BÀI MỚI (VĂN BẢN, TẢI FILE TEXT, HOẶC HÌNH ẢNH)
         ======================================================================== */}
      {customModalOpen && (
        <div
          onPaste={handlePasteInCustomModal}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-3.5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Tạo Bài Mới Từ Văn Bản Hoặc Hình Ảnh
                </h3>
              </div>
              <button
                onClick={() => !isGeneratingAI && setCustomModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Dán đề bài vào ô dưới, tải tệp văn bản (<code>.txt</code>, <code>.md</code>), hoặc
              tải ảnh chụp đề bài/hình vẽ (có thể nhấn <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300">Ctrl + V</kbd> để dán ảnh trực tiếp).
            </p>

            {/* Hàng nút tải file văn bản & tải ảnh đề bài */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={textFileInputRef}
                type="file"
                accept=".txt,.md,.text,text/plain"
                onChange={handleUploadTextFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => textFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Tải file văn bản (.txt, .md)</span>
              </button>

              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadCustomImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Tải ảnh đề bài / hình vẽ</span>
              </button>
            </div>

            {/* Khung xem trước ảnh đã tải lên */}
            {customImageAttachment && (
              <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={customImageAttachment.previewUrl}
                    alt="Xem trước đề bài"
                    className="w-16 h-16 rounded-lg object-contain bg-slate-900 border border-slate-800 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-300 truncate">
                      {customImageAttachment.fileName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      AI sẽ tự động đọc đề bài và dựng lại hình vẽ từ ảnh này.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomImageAttachment(null)}
                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 shrink-0"
                  title="Gỡ ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Ô nhập nội dung văn bản đề bài */}
            <textarea
              rows={4}
              value={customPromptInput}
              onChange={(e) => setCustomPromptInput(e.target.value)}
              placeholder="Nhập hoặc dán đề bài toán hình học vào đây (hoặc ghi chú thêm nếu đã tải ảnh lên)..."
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
                    <span>AI đang dựng hình & giải toán...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Tạo hình, Lời giải & Âm thanh</span>
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
        <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-medium max-w-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
