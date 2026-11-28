/* ============================================================================
   BỘ ĐÓNG GÓI MP4 THUẦN JAVASCRIPT (ISO-BMFF: H.264 AVC + AAC-LC)
   - Không phụ thuộc thư viện ngoài, tương thích 100% WebCodecs (Chrome/Edge)
   - Tạo tệp .mp4 chuẩn phát mượt trên Windows, Zalo, PowerPoint, YouTube
   ============================================================================ */

function concatUint8Arrays(arrays) {
  let total = 0;
  for (const arr of arrays) total += arr.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.byteLength;
  }
  return out;
}

function fourCC(str) {
  return new Uint8Array([
    str.charCodeAt(0) & 0xff,
    str.charCodeAt(1) & 0xff,
    str.charCodeAt(2) & 0xff,
    str.charCodeAt(3) & 0xff
  ]);
}

function u32(val) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, val >>> 0, false);
  return buf;
}

function u16(val) {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, val & 0xffff, false);
  return buf;
}

function i16(val) {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setInt16(0, val, false);
  return buf;
}

function box(type, ...payloads) {
  const body = concatUint8Arrays(payloads);
  return concatUint8Arrays([u32(8 + body.byteLength), fourCC(type), body]);
}

function fullBox(type, version, flags, ...payloads) {
  const vf = new Uint8Array([
    version & 0xff,
    (flags >>> 16) & 0xff,
    (flags >>> 8) & 0xff,
    flags & 0xff
  ]);
  return box(type, vf, ...payloads);
}

function unityMatrix() {
  return concatUint8Arrays([
    u32(0x00010000), u32(0), u32(0),
    u32(0), u32(0x00010000), u32(0),
    u32(0), u32(0), u32(0x40000000)
  ]);
}

function buildStts(durations) {
  const entries = [];
  for (const d of durations) {
    const dur = Math.max(1, Math.round(d));
    if (entries.length > 0 && entries[entries.length - 1].delta === dur) {
      entries[entries.length - 1].count++;
    } else {
      entries.push({ count: 1, delta: dur });
    }
  }
  const parts = [u32(entries.length)];
  for (const e of entries) {
    parts.push(u32(e.count), u32(e.delta));
  }
  return fullBox('stts', 0, 0, ...parts);
}

function buildStss(keyIndices1Based) {
  const list = keyIndices1Based.length > 0 ? keyIndices1Based : [1];
  const parts = [u32(list.length)];
  for (const idx of list) parts.push(u32(idx));
  return fullBox('stss', 0, 0, ...parts);
}

function buildStsc(sampleCount) {
  if (sampleCount <= 0) {
    return fullBox('stsc', 0, 0, u32(0));
  }
  return fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
}

function buildStsz(sizes) {
  const parts = [u32(0), u32(sizes.length)];
  for (const sz of sizes) parts.push(u32(sz));
  return fullBox('stsz', 0, 0, ...parts);
}

function buildStco(offsets) {
  const parts = [u32(offsets.length)];
  for (const off of offsets) parts.push(u32(off));
  return fullBox('stco', 0, 0, ...parts);
}

function buildEsds(audioSpecificConfig) {
  const asc =
    audioSpecificConfig && audioSpecificConfig.byteLength > 0
      ? new Uint8Array(audioSpecificConfig)
      : new Uint8Array([0x11, 0x90]);

  const decSpecInfo = concatUint8Arrays([
    new Uint8Array([0x05, asc.byteLength]),
    asc
  ]);

  const decConfigLen = 13 + decSpecInfo.byteLength;
  const decConfig = concatUint8Arrays([
    new Uint8Array([
      0x04,
      decConfigLen,
      0x40,
      0x15,
      0x00, 0x00, 0x00
    ]),
    u32(128000),
    u32(128000),
    decSpecInfo
  ]);

  const slConfig = new Uint8Array([0x06, 0x01, 0x02]);
  const esDescrLen = 3 + decConfig.byteLength + slConfig.byteLength;
  const esDescr = concatUint8Arrays([
    new Uint8Array([0x03, esDescrLen, 0x00, 0x02, 0x00]),
    decConfig,
    slConfig
  ]);

  return fullBox('esds', 0, 0, esDescr);
}

export class SimpleMp4Muxer {
  constructor({ width, height, fps = 24, sampleRate = 48000, channels = 2 }) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.sampleRate = sampleRate;
    this.channels = channels;

    this.videoSamples = [];
    this.audioSamples = [];
    this.avcC = null;
    this.audioSpecificConfig = null;
  }

  addVideoChunk(chunk, meta) {
    if (meta?.decoderConfig?.description && !this.avcC) {
      this.avcC = new Uint8Array(meta.decoderConfig.description);
    }
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const defaultTicks = Math.round(90000 / this.fps);
    const durationTicks =
      chunk.duration && chunk.duration > 0
        ? Math.round((chunk.duration / 1_000_000) * 90000)
        : defaultTicks;

    this.videoSamples.push({
      data,
      durationTicks,
      isKey: chunk.type === 'key'
    });
  }

  addAudioChunk(chunk, meta) {
    if (meta?.decoderConfig?.description && !this.audioSpecificConfig) {
      this.audioSpecificConfig = new Uint8Array(meta.decoderConfig.description);
    }
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const durationTicks =
      chunk.duration && chunk.duration > 0
        ? Math.round((chunk.duration / 1_000_000) * this.sampleRate)
        : 1024;

    this.audioSamples.push({
      data,
      durationTicks
    });
  }

  finalize() {
    const ftyp = box(
      'ftyp',
      fourCC('isom'),
      u32(0x00000200),
      fourCC('isom'),
      fourCC('iso2'),
      fourCC('avc1'),
      fourCC('mp41')
    );

    const hasAudio = this.audioSamples.length > 0;
    const videoTotalTicks = this.videoSamples.reduce((s, v) => s + v.durationTicks, 0);
    const videoDurationMs = Math.max(1, Math.round((videoTotalTicks / 90000) * 1000));

    const audioTotalTicks = this.audioSamples.reduce((s, a) => s + a.durationTicks, 0);
    const audioDurationMs = hasAudio
      ? Math.max(1, Math.round((audioTotalTicks / this.sampleRate) * 1000))
      : 0;

    const movieDurationMs = Math.max(videoDurationMs, audioDurationMs);

    const buildMoov = (videoOffsets, audioOffsets) => {
      const mvhd = fullBox(
        'mvhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(1000),
        u32(movieDurationMs),
        u32(0x00010000),
        u16(0x0100),
        new Uint8Array(10),
        unityMatrix(),
        new Uint8Array(24),
        u32(hasAudio ? 3 : 2)
      );

      const vTkhd = fullBox(
        'tkhd',
        0,
        3,
        u32(0),
        u32(0),
        u32(1),
        u32(0),
        u32(videoDurationMs),
        new Uint8Array(8),
        i16(0),
        i16(0),
        i16(0),
        u16(0),
        unityMatrix(),
        u32(this.width << 16),
        u32(this.height << 16)
      );

      const vMdhd = fullBox(
        'mdhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(90000),
        u32(videoTotalTicks),
        u16(0x55c4),
        u16(0)
      );

      const vHdlr = fullBox(
        'hdlr',
        0,
        0,
        u32(0),
        fourCC('vide'),
        new Uint8Array(12),
        new TextEncoder().encode('VideoHandler\0')
      );

      const vmhd = fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0));
      const dref = fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1));
      const dinf = box('dinf', dref);

      const avcCBox = box('avcC', this.avcC || new Uint8Array([1, 0x42, 0, 0x1f, 0xff, 0xe1, 0, 0, 0]));
      const compressorName = new Uint8Array(32);
      const avc1 = box(
        'avc1',
        new Uint8Array(6),
        u16(1),
        u16(0),
        u16(0),
        new Uint8Array(12),
        u16(this.width),
        u16(this.height),
        u32(0x00480000),
        u32(0x00480000),
        u32(0),
        u16(1),
        compressorName,
        u16(0x0018),
        i16(-1),
        avcCBox
      );

      const vStsd = fullBox('stsd', 0, 0, u32(1), avc1);
      const vStts = buildStts(this.videoSamples.map((v) => v.durationTicks));
      const keyFrames = [];
      this.videoSamples.forEach((v, idx) => {
        if (v.isKey) keyFrames.push(idx + 1);
      });
      const vStss = buildStss(keyFrames);
      const vStsc = buildStsc(this.videoSamples.length);
      const vStsz = buildStsz(this.videoSamples.map((v) => v.data.byteLength));
      const vStco = buildStco(videoOffsets);

      const vStbl = box('stbl', vStsd, vStts, vStss, vStsc, vStsz, vStco);
      const vMinf = box('minf', vmhd, dinf, vStbl);
      const vMdia = box('mdia', vMdhd, vHdlr, vMinf);
      const vTrak = box('trak', vTkhd, vMdia);

      if (!hasAudio) {
        return box('moov', mvhd, vTrak);
      }

      const aTkhd = fullBox(
        'tkhd',
        0,
        3,
        u32(0),
        u32(0),
        u32(2),
        u32(0),
        u32(audioDurationMs),
        new Uint8Array(8),
        i16(0),
        i16(0),
        i16(0x0100),
        u16(0),
        unityMatrix(),
        u32(0),
        u32(0)
      );

      const aMdhd = fullBox(
        'mdhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(this.sampleRate),
        u32(audioTotalTicks),
        u16(0x55c4),
        u16(0)
      );

      const aHdlr = fullBox(
        'hdlr',
        0,
        0,
        u32(0),
        fourCC('soun'),
        new Uint8Array(12),
        new TextEncoder().encode('SoundHandler\0')
      );

      const smhd = fullBox('smhd', 0, 0, i16(0), u16(0));
      const aDref = fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1));
      const aDinf = box('dinf', aDref);

      const esdsBox = buildEsds(this.audioSpecificConfig);
      const mp4a = box(
        'mp4a',
        new Uint8Array(6),
        u16(1),
        new Uint8Array(8),
        u16(this.channels),
        u16(16),
        u16(0),
        u16(0),
        u32(this.sampleRate << 16),
        esdsBox
      );

      const aStsd = fullBox('stsd', 0, 0, u32(1), mp4a);
      const aStts = buildStts(this.audioSamples.map((a) => a.durationTicks));
      const aStsc = buildStsc(this.audioSamples.length);
      const aStsz = buildStsz(this.audioSamples.map((a) => a.data.byteLength));
      const aStco = buildStco(audioOffsets);

      const aStbl = box('stbl', aStsd, aStts, aStsc, aStsz, aStco);
      const aMinf = box('minf', smhd, aDinf, aStbl);
      const aMdia = box('mdia', aMdhd, aHdlr, aMinf);
      const aTrak = box('trak', aTkhd, aMdia);

      return box('moov', mvhd, vTrak, aTrak);
    };

    const dummyVideoOffsets = new Array(this.videoSamples.length).fill(0);
    const dummyAudioOffsets = new Array(this.audioSamples.length).fill(0);
    const dummyMoov = buildMoov(dummyVideoOffsets, dummyAudioOffsets);

    const mdatHeaderSize = 8;
    let currentOffset = ftyp.byteLength + dummyMoov.byteLength + mdatHeaderSize;

    const realVideoOffsets = [];
    const mdatPayloads = [];
    for (const v of this.videoSamples) {
      realVideoOffsets.push(currentOffset);
      mdatPayloads.push(v.data);
      currentOffset += v.data.byteLength;
    }

    const realAudioOffsets = [];
    for (const a of this.audioSamples) {
      realAudioOffsets.push(currentOffset);
      mdatPayloads.push(a.data);
      currentOffset += a.data.byteLength;
    }

    const finalMoov = buildMoov(realVideoOffsets, realAudioOffsets);
    const mdatBody = concatUint8Arrays(mdatPayloads);
    const mdat = concatUint8Arrays([u32(8 + mdatBody.byteLength), fourCC('mdat'), mdatBody]);

    return concatUint8Arrays([ftyp, finalMoov, mdat]);
  }
}
