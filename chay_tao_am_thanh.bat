@echo off
chcp 65001 > nul
echo Dang cai dat thu vien edge-tts (neu chua co)...
pip install -q edge-tts
echo Dang tao file am thanh full_audio.mp3 va dong goi bai giang...
python tao_am_thanh_edge_tts.py
pause
