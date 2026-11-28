/* ============================================================================
   DỊCH VỤ LƯU TRỮ TRỰC TIẾP LÊN GITHUB & ĐÓNG GÓI 1 FILE ÂM THANH DUY NHẤT
   - Ghép toàn bộ lời giảng thành 1 tệp full_audio.mp3 + bảng mốc thời gian audioTimeline
   - Mỗi bài học lưu thành thư mục riêng:
       public/lessons/<lop>/<ten-bai-slug>/data.json
       public/lessons/<lop>/<ten-bai-slug>/audio/full_audio.mp3
   - Cập nhật mục lục public/lessons/index.json trong 1 commit duy nhất
   ============================================================================ */

import { pcmToWavBlob } from './geminiService.js';

export const GITHUB_CONFIG_STORAGE = 'toan_hinh_github_config';
const LAMEJS_CDN = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.js';
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

export function loadSavedGithubConfig() {
  try {
    const raw = localStorage.getItem(GITHUB_CONFIG_STORAGE);
    if (!raw) return { token: '', owner: '', repo: '', branch: 'main' };
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token || '',
      owner: parsed.owner || '',
      repo: parsed.repo || '',
      branch: parsed.branch || 'main'
    };
  } catch {
    return { token: '', owner: '', repo: '', branch: 'main' };
  }
}

export function saveGithubConfigToLocal(cfg) {
  localStorage.setItem(
    GITHUB_CONFIG_STORAGE,
    JSON.stringify({
      token: (cfg.token || '').trim(),
      owner: (cfg.owner || '').trim(),
      repo: (cfg.repo || '').trim(),
      branch: (cfg.branch || 'main').trim() || 'main'
    })
  );
}

export function slugifyVietnamese(str) {
  return (
    String(str || 'bai-toan')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `bai-${Date.now()}`
  );
}

export function loadExternalScript(src) {
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

function resamplePcm16(pcm16, fromRate, toRate) {
  if (!pcm16 || fromRate === toRate || !fromRate || !toRate) return pcm16;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(pcm16.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(pcm16.length - 1, idx0 + 1);
    const frac = srcPos - idx0;
    out[i] = Math.round(pcm16[idx0] * (1 - frac) + pcm16[idx1] * frac);
  }
  return out;
}

export function encodePcm16ToMp3Blob(pcm16, sampleRate = 24000) {
  if (typeof window === 'undefined' || !window.lamejs || !window.lamejs.Mp3Encoder) {
    return null;
  }
  try {
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
    return new Blob(mp3Chunks, { type: 'audio/mpeg' });
  } catch {
    return null;
  }
}

export async function buildUnifiedAudioPackage(totalSteps, audioEntriesMap, pauseSec = 0.25) {
  if (!audioEntriesMap || audioEntriesMap.size === 0 || totalSteps <= 0) {
    return null;
  }

  await loadExternalScript(LAMEJS_CDN).catch(() => null);

  let targetSampleRate = 24000;
  for (let i = 0; i < totalSteps; i++) {
    const entry = audioEntriesMap.get(i);
    if (entry?.sampleRate) {
      targetSampleRate = entry.sampleRate;
      break;
    }
  }

  const pauseSamples = Math.round(pauseSec * targetSampleRate);
  const chunks = [];
  const audioTimeline = [];
  let cursorSamples = 0;

  for (let idx = 0; idx < totalSteps; idx++) {
    const entry = audioEntriesMap.get(idx);
    const startSec = Number((cursorSamples / targetSampleRate).toFixed(3));

    if (entry?.pcm16 && entry.pcm16.length > 0) {
      const normalizedPcm = resamplePcm16(entry.pcm16, entry.sampleRate || targetSampleRate, targetSampleRate);
      chunks.push(normalizedPcm);
      cursorSamples += normalizedPcm.length;

      if (idx < totalSteps - 1 && pauseSamples > 0) {
        chunks.push(new Int16Array(pauseSamples));
        cursorSamples += pauseSamples;
      }
    } else {
      const fallbackSamples = Math.round(2.5 * targetSampleRate);
      chunks.push(new Int16Array(fallbackSamples));
      cursorSamples += fallbackSamples;
    }

    const endSec = Number((cursorSamples / targetSampleRate).toFixed(3));
    audioTimeline.push({
      stepIndex: idx,
      startSec,
      endSec
    });
  }

  const totalSamples = chunks.reduce((acc, arr) => acc + arr.length, 0);
  if (totalSamples === 0) return null;

  const mergedPcm = new Int16Array(totalSamples);
  let offset = 0;
  for (const arr of chunks) {
    mergedPcm.set(arr, offset);
    offset += arr.length;
  }

  const mp3Blob = encodePcm16ToMp3Blob(mergedPcm, targetSampleRate);
  const blob = mp3Blob || pcmToWavBlob(mergedPcm, targetSampleRate);
  const ext = mp3Blob ? 'mp3' : 'wav';
  const fileName = `full_audio.${ext}`;
  const totalDurationSec = Number((totalSamples / targetSampleRate).toFixed(3));

  return {
    blob,
    fileName,
    ext,
    audioTimeline,
    totalDurationSec
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  return arrayBufferToBase64(bytes.buffer);
}

function base64ToUtf8(b64) {
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function testGithubConnection(config) {
  const { token, owner, repo, branch } = config;
  if (!token || !owner || !repo) {
    throw new Error('Vui lòng nhập đầy đủ GitHub Token, Tên chủ sở hữu (Owner) và Tên Repository.');
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch || 'main'}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub Token không hợp lệ hoặc đã hết hạn (401).');
    if (res.status === 404)
      throw new Error(`Không tìm thấy repo "${owner}/${repo}" hoặc nhánh "${branch || 'main'}" (404).`);
    throw new Error(`Lỗi kiểm tra GitHub (HTTP ${res.status}).`);
  }

  return true;
}

async function createGithubBlob({ owner, repo, token, base64Content }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: base64Content,
      encoding: 'base64'
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Không tạo được blob trên GitHub (${res.status}): ${err.message || ''}`);
  }
  const data = await res.json();
  return data.sha;
}

export async function saveLessonDirectToGithub({
  config,
  lessonData,
  metadata,
  timelineItems,
  audioEntriesMap,
  onProgress
}) {
  const { token, owner, repo, branch = 'main' } = config;
  if (!token || !owner || !repo) {
    throw new Error('Chưa cấu hình GitHub Token / Repository trong phần Cài đặt.');
  }

  const gradeSlug = slugifyVietnamese(metadata.grade || lessonData.grade || 'toan-7');
  const titleSlug = slugifyVietnamese(metadata.title || lessonData.title || 'bai-toan');
  const lessonId = `${gradeSlug}-${titleSlug}`;
  const folderRelPath = `public/lessons/${gradeSlug}/${titleSlug}`;
  const publicJsonPath = `/lessons/${gradeSlug}/${titleSlug}/data.json`;
  const publicAudioBasePath = `/lessons/${gradeSlug}/${titleSlug}/audio`;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  onProgress?.('Đang kết nối nhánh GitHub...');
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers
  });
  if (!refRes.ok) {
    throw new Error(
      `Không truy cập được nhánh "${branch}" trên GitHub (${refRes.status}). Hãy kiểm tra Token và quyền Contents: Read & Write.`
    );
  }
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
    headers
  });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  onProgress?.('Đang đọc mục lục bài mẫu hiện có...');
  let existingIndex = [];
  const indexRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/public/lessons/index.json?ref=${encodeURIComponent(branch)}`,
    { headers }
  );
  if (indexRes.ok) {
    const indexFile = await indexRes.json();
    if (indexFile?.content) {
      try {
        existingIndex = JSON.parse(base64ToUtf8(indexFile.content));
        if (!Array.isArray(existingIndex)) existingIndex = [];
      } catch {
        existingIndex = [];
      }
    }
  }

  const treeEntries = [];
  let hasAnyAudio = false;
  let audioFile = 'full_audio.mp3';
  let audioTimeline = [];

  if (audioEntriesMap && audioEntriesMap.size > 0) {
    onProgress?.('Đang ghép & nén 1 tệp âm thanh duy nhất...');
    const unified = await buildUnifiedAudioPackage(timelineItems.length, audioEntriesMap, 0.25);
    if (unified) {
      onProgress?.(`Đang tải tệp ${unified.fileName} (${unified.totalDurationSec.toFixed(1)}s) lên GitHub...`);
      const buf = await unified.blob.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const blobSha = await createGithubBlob({ owner, repo, token, base64Content: b64 });

      treeEntries.push({
        path: `${folderRelPath}/audio/${unified.fileName}`,
        mode: '100644',
        type: 'blob',
        sha: blobSha
      });

      hasAnyAudio = true;
      audioFile = unified.fileName;
      audioTimeline = unified.audioTimeline;
    }
  }

  onProgress?.('Đang lưu tệp dữ liệu bài toán (data.json)...');
  const cleanLessonData = Object.fromEntries(
    Object.entries(lessonData).filter(([k]) => !k.startsWith('_'))
  );

  const finalLessonJson = {
    ...cleanLessonData,
    id: lessonId,
    grade: metadata.grade,
    topic: metadata.topic,
    title: metadata.title,
    hasStaticAudio: hasAnyAudio,
    audioBasePath: publicAudioBasePath,
    audioFile: hasAnyAudio ? audioFile : '',
    audioTimeline: hasAnyAudio ? audioTimeline : [],
    updatedAt: new Date().toISOString()
  };
  delete finalLessonJson.audioManifest;

  const dataJsonSha = await createGithubBlob({
    owner,
    repo,
    token,
    base64Content: utf8ToBase64(JSON.stringify(finalLessonJson, null, 2))
  });

  treeEntries.push({
    path: `${folderRelPath}/data.json`,
    mode: '100644',
    type: 'blob',
    sha: dataJsonSha
  });

  const newCatalogItem = {
    id: lessonId,
    grade: metadata.grade,
    topic: metadata.topic,
    title: metadata.title,
    path: publicJsonPath,
    audioBasePath: publicAudioBasePath,
    audioFile: hasAnyAudio ? audioFile : '',
    hasStaticAudio: hasAnyAudio,
    updatedAt: finalLessonJson.updatedAt
  };

  const filteredIndex = existingIndex.filter((item) => item.id !== lessonId);
  const updatedIndex = [newCatalogItem, ...filteredIndex];

  const indexJsonSha = await createGithubBlob({
    owner,
    repo,
    token,
    base64Content: utf8ToBase64(JSON.stringify(updatedIndex, null, 2))
  });

  treeEntries.push({
    path: 'public/lessons/index.json',
    mode: '100644',
    type: 'blob',
    sha: indexJsonSha
  });

  onProgress?.('Đang xác nhận lưu vào kho GitHub...');
  const newTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries
    })
  });
  if (!newTreeRes.ok) {
    throw new Error(`Không tạo được Git Tree (${newTreeRes.status}).`);
  }
  const newTreeData = await newTreeRes.json();

  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `Thêm bài mẫu [${metadata.grade}] ${metadata.title}`,
      tree: newTreeData.sha,
      parents: [latestCommitSha]
    })
  });
  if (!newCommitRes.ok) {
    throw new Error(`Không tạo được Commit trên GitHub (${newCommitRes.status}).`);
  }
  const newCommitData = await newCommitRes.json();

  const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitData.sha
    })
  });
  if (!updateRefRes.ok) {
    throw new Error(`Không cập nhật được nhánh ${branch} (${updateRefRes.status}).`);
  }

  return {
    lesson: finalLessonJson,
    catalogItem: newCatalogItem,
    commitSha: newCommitData.sha
  };
}

export async function downloadLessonZipBackup({
  lessonData,
  metadata,
  timelineItems,
  audioEntriesMap
}) {
  await loadExternalScript(JSZIP_CDN);

  if (!window.JSZip) {
    throw new Error('Không tải được thư viện nén ZIP.');
  }

  const gradeSlug = slugifyVietnamese(metadata?.grade || lessonData.grade || 'toan-7');
  const titleSlug = slugifyVietnamese(metadata?.title || lessonData.title || 'bai-toan');
  const folderPath = `public/lessons/${gradeSlug}/${titleSlug}`;

  const zip = new window.JSZip();
  let hasAnyAudio = false;
  let audioFile = 'full_audio.mp3';
  let audioTimeline = [];

  if (audioEntriesMap && audioEntriesMap.size > 0) {
    const unified = await buildUnifiedAudioPackage(timelineItems.length, audioEntriesMap, 0.25);
    if (unified) {
      zip.file(`${folderPath}/audio/${unified.fileName}`, unified.blob);
      hasAnyAudio = true;
      audioFile = unified.fileName;
      audioTimeline = unified.audioTimeline;
    }
  }

  const cleanLessonData = Object.fromEntries(
    Object.entries(lessonData).filter(([k]) => !k.startsWith('_'))
  );

  const finalJson = {
    ...cleanLessonData,
    id: `${gradeSlug}-${titleSlug}`,
    grade: metadata?.grade || lessonData.grade,
    topic: metadata?.topic || lessonData.topic,
    title: metadata?.title || lessonData.title,
    hasStaticAudio: hasAnyAudio,
    audioFile: hasAnyAudio ? audioFile : '',
    audioTimeline: hasAnyAudio ? audioTimeline : []
  };
  delete finalJson.audioManifest;

  zip.file(`${folderPath}/data.json`, JSON.stringify(finalJson, null, 2));

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${gradeSlug}-${titleSlug}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
