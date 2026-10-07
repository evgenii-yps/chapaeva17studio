"""QA: технические проверки итоговых файлов -> JSON (читает qa-отчёт-сборщик).
usage: qa_tech.py render_front_mp_raw.npz out.json
"""
import sys, json, subprocess, re, numpy as np
def probe(path):
    o = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,duration,start_time,nb_frames', '-show_entries', 'format=duration', '-of', 'json', path], capture_output=True, text=True).stdout
    return json.loads(o)
def blacks(path):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-vf', 'blackdetect=d=0.1:pic_th=0.98', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return len(re.findall('black_start', o))
res = {}
for f in ['pilot_lesson.mp4', 'comparison_split.mp4']:
    p = probe('output/' + f)
    v = next(s for s in p['streams'] if s['codec_type'] == 'video'); a = next((s for s in p['streams'] if s['codec_type'] == 'audio'), None)
    res[f] = dict(size=f"{v['width']}x{v['height']}", fps=v['r_frame_rate'], video_dur=float(v['duration']), audio_dur=float(a['duration']) if a else None,
                  av_start_offset=(float(a['start_time']) - float(v['start_time'])) if a else None, black_segments=blacks('output/' + f))
src = probe('input/source.mp4'); sa = next(s for s in src['streams'] if s['codec_type'] == 'audio')
res['source_audio_dur'] = float(sa['duration'])
# персонаж в кадре: ключевые суставы (плечи/локти/кисти/бёдра/колени/щиколотки/нос) внутри кадра с полем 1 %
d = np.load(sys.argv[1]); I = d['img']; det = d['det']
key = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
inside = ((I[:, key, 0] > 0.01) & (I[:, key, 0] < 0.99) & (I[:, key, 1] > 0.01) & (I[:, key, 1] < 0.99)).all(1) | ~det
res['character_detect_rate_on_render'] = float(det.mean())
res['character_all_key_joints_inside_frame_ratio'] = float(inside[det].mean())
res['frames_with_joint_near_border'] = int((~inside & det).sum())
json.dump(res, open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False))
