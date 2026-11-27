import asyncio
import json
import os
import re
import zipfile
import edge_tts

# Giọng nữ miền Bắc chuẩn: vi-VN-HoaiMyNeural
VOICE = "vi-VN-HoaiMyNeural"
RATE = "-4%"

BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
SAMPLERATES = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12050, 8000],
}


def chuan_hoa_loi_doc(text: str) -> str:
    """Chuyển ký hiệu toán học & LaTeX sang lời đọc tự nhiên tiếng Việt."""
    s = str(text or "")
    s = s.replace("$", "")
    s = re.sub(r"\\dfrac\{([^{}]+)\}\{([^{}]+)\}", r"\1 phần \2", s)
    s = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"\1 phần \2", s)
    s = re.sub(r"\\sqrt\{([^{}]+)\}", r"căn bậc hai của \1", s)
    s = re.sub(r"\\widehat\{([^{}]+)\}", r"góc \1", s)
    s = s.replace("\\triangle", "tam giác ").replace("△", "tam giác ")
    s = s.replace("\\perp", " vuông góc với ").replace("⊥", " vuông góc với ")
    s = s.replace("\\parallel", " song song với ").replace("∥", " song song với ")
    s = s.replace("∠", "góc ")
    s = s.replace("\\Rightarrow", "suy ra ").replace("⇒", "suy ra ")
    s = s.replace("\\Leftrightarrow", "khi và chỉ khi ").replace("⇔", "khi và chỉ khi ")
    s = s.replace("^\\circ", " độ ").replace("°", " độ ")
    s = s.replace("=", " bằng ")
    s = re.sub(r"\b([A-Z])([A-Z])([A-Z])\b", r"\1 \2 \3", s)
    s = re.sub(r"\b([A-Z])([A-Z])\b", r"\1 \2", s)
    return re.sub(r"\s+", " ", s).strip()


def tach_khung_mp3_va_thoi_luong(mp3_bytes: bytes):
    """Tách các frame MP3 chuẩn và tính chính xác tuyệt đối thời lượng (giây)."""
    pos = 0
    if mp3_bytes[:3] == b"ID3":
        size = (
            ((mp3_bytes[6] & 0x7F) << 21)
            | ((mp3_bytes[7] & 0x7F) << 14)
            | ((mp3_bytes[8] & 0x7F) << 7)
            | (mp3_bytes[9] & 0x7F)
        )
        pos = 10 + size

    frames = []
    total_samples = 0
    sr_used = 24000

    while pos + 4 <= len(mp3_bytes):
        if mp3_bytes[pos] == 0xFF and (mp3_bytes[pos + 1] & 0xE0) == 0xE0:
            b1, b2 = mp3_bytes[pos + 1], mp3_bytes[pos + 2]
            ver = (b1 >> 3) & 0x03
            layer = (b1 >> 1) & 0x03
            br_idx = (b2 >> 4) & 0x0F
            sr_idx = (b2 >> 2) & 0x03
            pad = (b2 >> 1) & 0x01
            if ver in SAMPLERATES and layer == 1 and 0 < br_idx < 15 and sr_idx < 3:
                sr = SAMPLERATES[ver][sr_idx]
                br = (BITRATES_V1_L3[br_idx] if ver == 3 else BITRATES_V2_L3[br_idx]) * 1000
                samples = 1152 if ver == 3 else 576
                frame_len = int((samples // 8) * br // sr + pad)
                if frame_len > 0 and pos + frame_len <= len(mp3_bytes):
                    frames.append(mp3_bytes[pos : pos + frame_len])
                    total_samples += samples
                    sr_used = sr
                    pos += frame_len
                    continue
        pos += 1

    return frames, (total_samples / sr_used)


async def tao_goi_bai_giang_1_file_am_thanh(data_json_path: str = "data.json"):
    with open(data_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    steps = []
    for st in data.get("drawingSteps", []):
        steps.append(st.get("voiceExplanation") or st.get("caption") or "")
    for st in data.get("solutionSteps", []):
        steps.append(st.get("voiceExplanation") or st.get("lineText") or "")

    os.makedirs("audio", exist_ok=True)
    all_frames = []
    audio_timeline = []
    cursor_sec = 0.0

    for idx, raw_text in enumerate(steps):
        speech = chuan_hoa_loi_doc(raw_text)
        tmp_mp3 = f"audio/_tmp_{idx}.mp3"
        print(f"[{idx + 1}/{len(steps)}] Đang đọc: {speech}")
        comm = edge_tts.Communicate(speech, VOICE, rate=RATE)
        await comm.save(tmp_mp3)

        with open(tmp_mp3, "rb") as f:
            mp3_bytes = f.read()
        os.remove(tmp_mp3)

        frames, dur = tach_khung_mp3_va_thoi_luong(mp3_bytes)
        start_sec = round(cursor_sec, 3)
        cursor_sec += dur
        end_sec = round(cursor_sec, 3)

        all_frames.extend(frames)
        audio_timeline.append({
            "stepIndex": idx,
            "startSec": start_sec,
            "endSec": end_sec
        })

    full_mp3_path = os.path.join("audio", "full_audio.mp3")
    with open(full_mp3_path, "wb") as f:
        for fr in all_frames:
            f.write(fr)

    data["hasStaticAudio"] = True
    data["audioFile"] = "full_audio.mp3"
    data["audioTimeline"] = audio_timeline
    data.pop("audioManifest", None)

    with open(data_json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    lesson_id = data.get("id") or "bai-giang-hinh-hoc"
    zip_name = f"{lesson_id}.zip"
    with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(data_json_path, arcname=f"{lesson_id}/data.json")
        zf.write(full_mp3_path, arcname=f"{lesson_id}/audio/full_audio.mp3")

    print(f"\nHoàn tất! Đã tạo 1 file duy nhất '{full_mp3_path}' ({cursor_sec:.2f}s) và gói '{zip_name}'.")


if __name__ == "__main__":
    asyncio.run(tao_goi_bai_giang_1_file_am_thanh("data.json"))
