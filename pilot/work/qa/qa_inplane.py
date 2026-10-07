"""QA: ошибка положения суставов в плоскости кадра (x,y), см: FK-скелет BVH против 2D-ориентиров исходника.
Камера рендера character_front.mp4 совпадает с камерой исходника, поэтому сравнение в плоскости корректно.
usage: qa_inplane.py mp_raw.npz out.md joints_a.npz[:label] [joints_b.npz:label]
"""
import sys, numpy as np
raw = np.load(sys.argv[1]); IMG = raw['img']; W = raw['world']
FPS = 30
# масштаб м/ед. кадра: по длине торса (как в build_bvh)
hp = (IMG[:, 23, :2] + IMG[:, 24, :2]) / 2; sh = (IMG[:, 11, :2] + IMG[:, 12, :2]) / 2
l2 = np.linalg.norm(sh - hp, axis=1)
Tw = np.linalg.norm((W[:, 11, :3] + W[:, 12, :3]) / 2 - (W[:, 23, :3] + W[:, 24, :3]) / 2, axis=1)
top = l2 > np.percentile(l2, 70); s = float(np.median(Tw[top] / l2[top]))
MAP = {'плечо L': (11, 'LeftUpperArm'), 'плечо R': (12, 'RightUpperArm'), 'локоть L': (13, 'LeftLowerArm'), 'локоть R': (14, 'RightLowerArm'),
       'запястье L': (15, 'LeftHand'), 'запястье R': (16, 'RightHand'), 'бедро L': (23, 'LeftUpperLeg'), 'бедро R': (24, 'RightUpperLeg'),
       'колено L': (25, 'LeftLowerLeg'), 'колено R': (26, 'RightLowerLeg'), 'щиколотка L': (27, 'LeftFoot'), 'щиколотка R': (28, 'RightFoot')}
PH = [("1", 0, 3), ("2", 3, 9), ("3", 9, 14), ("4", 14, 19), ("5", 19, 21), ("6", 21, 26), ("7", 26, 34), ("8", 34, 39), ("9", 39, 46), ("10", 46, 50), ("11", 50, 53), ("12", 53, 55.5)]
def err(jn):
    J = np.load(jn); N = min(len(IMG), len(J['Hips']))
    src = {k: np.stack([(IMG[:N, i, 0] - hp[:N, 0]) * s, -(IMG[:N, i, 1] - hp[:N, 1]) * s], 1) for k, (i, _) in MAP.items()}
    avt = {k: (J[b][:N] - J['Hips'][:N])[:, :2] for k, (_, b) in MAP.items()}
    e = {k: np.linalg.norm(src[k] - avt[k], axis=1) * 100 for k in MAP}   # см
    return e, N
specs = [a.split(':') for a in sys.argv[3:]]
out = ["# Ошибка положения суставов в плоскости кадра (см)", "",
       "Сравнение: FK-скелет BVH (рендер character_front.mp4 снят с камеры исходника) против 2D-ориентиров MediaPipe на исходнике, относительно таза. Это проверка точности ретаргетинга **в плоскости кадра**; она не зависит от детекции на манекене. Эталон — снова оценка MediaPipe (не разметка вручную).", ""]
for spec in specs:
    jn = spec[0]; label = spec[1] if len(spec) > 1 else jn
    e, N = err(jn)
    allm = np.mean([np.mean(v) for v in e.values()])
    out.append(f"## {label}: средняя ошибка по всем суставам **{allm:.1f} см**\n")
    out.append("| Фаза | " + " | ".join(MAP) + " | среднее |"); out.append("|---|" + "---|" * (len(MAP) + 1))
    for pn, a, b in PH:
        i0, i1 = int(a * FPS), min(int(b * FPS), N)
        row = [np.mean(e[k][i0:i1]) for k in MAP]
        out.append(f"| {pn} | " + " | ".join(f"{v:.0f}" for v in row) + f" | **{np.mean(row):.1f}** |")
    out.append("")
    print(label, 'средняя ошибка в плоскости, см: %.1f' % allm, '| по суставам:', {k: round(float(np.mean(v)), 1) for k, v in e.items()})
open(sys.argv[2], 'w').write("\n".join(out))
