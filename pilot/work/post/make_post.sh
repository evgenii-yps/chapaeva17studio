#!/bin/bash
# Монтаж: pilot_lesson.mp4 (аватар + исходная звуковая дорожка + субтитры + титр) и comparison_split.mp4
# usage: make_post.sh render.mp4
set -euo pipefail
cd "$(dirname "$0")/../.."
R="${1:-work/scene/character.mp4}"
RF="${2:-$R}"   # вид с камеры исходника для сравнения (по умолчанию тот же рендер)
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
SRT=output/pilot_lesson.srt
STYLE="FontName=DejaVu Sans,FontSize=20,PrimaryColour=&H00FFFFFF&,OutlineColour=&H99000000&,BorderStyle=1,Outline=2,Shadow=0,MarginV=34,Alignment=2"
# 1) урок: видео персонажа + звук исходника
ffmpeg -v error -y -i "$R" -i input/source.mp4 -map 0:v:0 -map 1:a:0 \
  -vf "subtitles=$SRT:force_style='$STYLE',drawtext=fontfile=$FONT:text='Цигун':fontsize=64:fontcolor=white:alpha='if(lt(t,4),1,0)':x=(w-text_w)/2:y=70:shadowcolor=black@0.5:shadowx=2:shadowy=2,drawtext=fontfile=$FONT:text='Пилот · только внутренний тест':fontsize=18:fontcolor=white@0.75:x=18:y=h-32:shadowcolor=black@0.6:shadowx=1:shadowy=1" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart output/pilot_lesson.mp4
# 2) сравнение: исходник | персонаж
ffmpeg -v error -y -i input/source.mp4 -i "$RF" -filter_complex \
 "[0:v]scale=-2:720,drawtext=fontfile=$FONT:text='Исходник':fontsize=26:fontcolor=white:x=14:y=12:box=1:boxcolor=black@0.5[a];\
  [1:v]scale=-2:720,drawtext=fontfile=$FONT:text='Персонаж (MediaPipe → BVH → Blender)':fontsize=26:fontcolor=white:x=14:y=12:box=1:boxcolor=black@0.5[b];\
  [a][b]hstack=inputs=2[v]" -map "[v]" -map 0:a:0 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart output/comparison_split.mp4
ls -la output/*.mp4
