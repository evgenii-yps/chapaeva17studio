"""QA: сравнение углов ключевых суставов (исходник vs BVH-скелет vs повторная детекция на рендере).
usage: qa_compare.py src_keypoints.npz joints.npz out.md [render_mp_raw.npz]
"""
import sys, json, numpy as np
from scipy.signal import savgol_filter
src_kp, joints_npz, out_md = sys.argv[1:4]
rend_npz = sys.argv[4] if len(sys.argv) > 4 else None
FPS = 30
PHASES = [("1 Стойка, ладони у груди", 0, 3), ("2 Выпад, толчок ладонью", 3, 9), ("3 Руки в стороны, широкий выпад", 9, 14),
          ("4 Серия выпадов", 14, 19), ("5 Низкая стойка, руки над головой", 19, 21), ("6 Выпад, рука над головой", 21, 26),
          ("7 Серия выпадов, руки вперёд", 26, 34), ("8 Выпады, рука вверх", 34, 39), ("9 Одна нога: колено, махи", 39, 46),
          ("10 Низкий выпад, наклон", 46, 50), ("11 Низкая стойка, руки вверх, присед", 50, 53), ("12 Вставание, завершение", 53, 55.5)]

def ang(a, b, c):
    u, v = a - b, c - b
    cs = np.sum(u * v, -1) / (np.linalg.norm(u, axis=-1) * np.linalg.norm(v, axis=-1) + 1e-9)
    return np.degrees(np.arccos(np.clip(cs, -1, 1)))

def angles(P):
    """P: dict имя -> (T,3). Возвращает dict имя угла -> (T,)."""
    up = P['neck'] - P['hips']
    out = {}
    for s in 'LR':
        out[f'локоть {s}'] = ang(P[f'sh{s}'], P[f'el{s}'], P[f'wr{s}'])
        out[f'колено {s}'] = ang(P[f'hp{s}'], P[f'kn{s}'], P[f'an{s}'])
        out[f'плечо-корпус {s}'] = ang(P['hips'] + 0 * up, P['neck'], P[f'el{s}']) * 0 + ang(P['hips'], P[f'sh{s}'], P[f'el{s}'])
        out[f'бедро-корпус {s}'] = ang(P['neck'], P[f'hp{s}'], P[f'kn{s}'])
    out['наклон корпуса от вертикали'] = np.degrees(np.arccos(np.clip(up[:, 1] / (np.linalg.norm(up, axis=-1) + 1e-9), -1, 1)))
    return out

def from_mp(Pw, swap_ok=True):
    g = lambda i: Pw[:, i, :3]
    return dict(hips=(g(23) + g(24)) / 2, neck=(g(11) + g(12)) / 2, shL=g(11), shR=g(12), elL=g(13), elR=g(14), wrL=g(15), wrR=g(16),
                hpL=g(23), hpR=g(24), knL=g(25), knR=g(26), anL=g(27), anR=g(28))

def from_joints(J):
    return dict(hips=J['Hips'], neck=J['Neck'], shL=J['LeftUpperArm'], shR=J['RightUpperArm'], elL=J['LeftLowerArm'], elR=J['RightLowerArm'],
                wrL=J['LeftHand'], wrR=J['RightHand'], hpL=J['LeftUpperLeg'], hpR=J['RightUpperLeg'], knL=J['LeftLowerLeg'], knR=J['RightLowerLeg'],
                anL=J['LeftFoot'], anR=J['RightFoot'])

ref = angles(from_mp(np.load(src_kp)['Pf']))
J = np.load(joints_npz)
bvh = angles(from_joints(J))
N = min(len(next(iter(ref.values()))), len(next(iter(bvh.values()))))
res = None
if rend_npz:
    raw = np.load(rend_npz)['world'][:, :, :3].copy()
    # оси как у эталона (y вверх, z к камере)
    raw[:, :, 1] *= -1; raw[:, :, 2] *= -1
    # пропуски детекции -> интерполяция по времени
    tt = np.arange(len(raw))
    for j in range(33):
        for k in range(3):
            ok = ~np.isnan(raw[:, j, k])
            if ok.any() and (~ok).any():
                raw[:, j, k] = np.interp(tt, tt[ok], raw[ok, j, k])
    # коррекция перепутанных лево/право (на безликом манекене в профиль MediaPipe путает стороны)
    PAIRS = [(11, 12), (13, 14), (15, 16), (23, 24), (25, 26), (27, 28), (31, 32), (7, 8), (19, 20), (17, 18)]
    nsw = 0
    prev = raw[0].copy()
    for t in range(1, len(raw)):
        keep = sum(np.linalg.norm(raw[t, a] - prev[a]) + np.linalg.norm(raw[t, b] - prev[b]) for a, b in PAIRS)
        swp = sum(np.linalg.norm(raw[t, b] - prev[a]) + np.linalg.norm(raw[t, a] - prev[b]) for a, b in PAIRS)
        if swp < 0.6 * keep and keep > 0.25:
            for a, b in PAIRS: raw[t, [a, b]] = raw[t, [b, a]]
            nsw += 1
        prev = raw[t].copy()
    print('коррекций лево/право на рендере:', nsw)
    for j in range(33):
        raw[:, j] = savgol_filter(raw[:, j], 9, 2, axis=0)
    res = angles(from_mp(raw))
    N = min(N, len(next(iter(res.values()))))

names = list(ref.keys())
def table(other, title):
    L = [f"### {title}", "", "| Фаза | " + " | ".join(n.replace(' ', '&nbsp;') for n in names) + " | среднее |", "|---|" + "---|" * (len(names) + 1)]
    allv = []
    for pn, a, b in PHASES:
        i0, i1 = int(a * FPS), min(int(b * FPS), N)
        row = [np.nanmean(np.abs(ref[n][i0:i1] - other[n][i0:i1])) for n in names]
        allv.append(row)
        L.append(f"| {pn} | " + " | ".join(f"{v:.0f}" for v in row) + f" | **{np.mean(row):.0f}** |")
    tot = np.mean(allv, axis=0)
    L.append("| **Весь ролик** | " + " | ".join(f"**{v:.0f}**" for v in tot) + f" | **{tot.mean():.0f}** |")
    corr = np.nanmean([np.corrcoef(ref[n][:N], other[n][:N])[0, 1] for n in names])
    L += ["", f"Средняя корреляция Пирсона по кривым углов: **{corr:.2f}**.", ""]
    return "\n".join(L), float(tot.mean()), float(corr)

md = ["# Сравнение углов суставов (градусы, средняя абсолютная ошибка по фазам)", "",
      "Эталон — углы по сглаженным 3D-ключевым точкам исходника (MediaPipe, метод A). Это **не независимая разметка**: эталон сам является оценкой модели; сравнение показывает потери при ретаргетинге/рендере, а не абсолютную точность относительно реального тела.", ""]
t1, m1, c1 = table(bvh, "A. BVH-скелет (после ретаргетинга с фиксированными длинами костей) против эталона")
md.append(t1)
summary = dict(bvh_mae=m1, bvh_corr=c1)
if res:
    t2, m2, c2 = table(res, "B. Повторная детекция MediaPipe на отрендеренном персонаже против эталона (сквозная проверка)")
    md.append(t2); summary.update(render_mae=m2, render_corr=c2, lr_swaps_on_render=nsw)
    md.append("Примечание: на манекене MediaPipe может ошибаться сам (нетипичная внешность, другой ракурс камеры 3/4), поэтому раздел B — оценка сверху по ошибке.")
open(out_md, 'w').write("\n".join(md))
json.dump(summary, open(out_md.replace('.md', '.json'), 'w'), indent=1)
print(json.dumps(summary, indent=1))
