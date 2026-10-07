"""Постобработка MediaPipe-захвата и экспорт BVH.

Вход : mp_raw.npz (extract_mediapipe.py)
Выход: <out>.bvh, <out>_joints.npz (целевые позиции суставов), <out>_metrics.json

Конвенция BVH (согласована со сценой): Y-up, метры, 30 fps, порядок ZXY,
персонаж в нейтрали (T-поза) смотрит в +Z, левая рука персонажа в +X.
"""
import sys, json
import numpy as np
from scipy.spatial.transform import Rotation as R, Slerp
from scipy.signal import savgol_filter

src, out = sys.argv[1], sys.argv[2]
d = np.load(src)
W, IMG, FPS = d['world'], d['img'], float(d['fps'])
N = len(W)
dt = 1.0 / FPS

# ---------- 00. артефакт исходника: первые кадры повёрнуты (склейка). Заменяем удержанием первой нормальной позы
def _tilt(t):
    sh = (IMG[t, 11, :2] + IMG[t, 12, :2]) / 2; hp = (IMG[t, 23, :2] + IMG[t, 24, :2]) / 2
    v = sh - hp
    return abs(np.degrees(np.arctan2(v[0], -v[1])))
first_good = next((t for t in range(min(20, N)) if _tilt(t) < 8), 0)
if first_good > 0:
    W[:first_good] = W[first_good]; IMG[:first_good] = IMG[first_good]
rotated_head_frames = first_good

# ---------- 0. коррекция перепутанных лево/право (типичный сбой MediaPipe в профиль)
PAIRS = [(11, 12), (13, 14), (15, 16), (23, 24), (25, 26), (27, 28), (31, 32), (29, 30), (7, 8), (19, 20), (17, 18), (21, 22), (1, 4), (2, 5), (3, 6), (9, 10)]
swap_frames = []
def _swap(arr, t):
    for a, b in PAIRS:
        arr[t, [a, b]] = arr[t, [b, a]]
state = False
prev = W[0, :, :3].copy()
for t in range(1, N):
    cur = W[t, :, :3]
    keep = sum(np.linalg.norm(cur[a] - prev[a]) + np.linalg.norm(cur[b] - prev[b]) for a, b in PAIRS[:11])
    swp = sum(np.linalg.norm(cur[b] - prev[a]) + np.linalg.norm(cur[a] - prev[b]) for a, b in PAIRS[:11])
    if swp < 0.6 * keep and keep > 0.25:
        _swap(W, t); _swap(IMG, t)
        swap_frames.append(t)
    prev = W[t, :, :3].copy()
# после первого переключения остальные кадры следуют за исправленным предыдущим -> пары флипов (туда-обратно) исправляются целиком

# ---------- 1. конверсия осей MediaPipe -> сцена: x=x, y=-y, z=-z (MP z: больше = дальше от камеры)
P = W[:, :, :3].copy()
P[:, :, 1] *= -1
P[:, :, 2] *= -1
VIS = W[:, :, 3]

# ---------- 2. One Euro фильтр
def one_euro(x, fps, mincutoff=1.2, beta=0.6, dcutoff=1.0):
    """x: (T, ...) -> сглаженный ряд."""
    def alpha(cut):
        tau = 1.0 / (2 * np.pi * cut)
        return 1.0 / (1.0 + tau * fps)
    y = np.empty_like(x)
    y[0] = x[0]
    dx_prev = np.zeros_like(x[0])
    for i in range(1, len(x)):
        dx = (x[i] - y[i - 1]) * fps
        a_d = alpha(dcutoff)
        dx_hat = a_d * dx + (1 - a_d) * dx_prev
        cut = mincutoff + beta * np.abs(dx_hat)
        a = alpha(cut)
        y[i] = a * x[i] + (1 - a) * y[i - 1]
        dx_prev = dx_hat
    return y

def jitter(x):
    """среднее |2-я разность| (м/кадр^2) по суставам - мера дрожания."""
    a = np.diff(x, 2, axis=0)
    return float(np.nanmean(np.linalg.norm(a, axis=-1)))

# маска «неуверенных» точек -> интерполяция по времени
conf = VIS > 0.5
Pi = P.copy()
t = np.arange(N)
for j in range(33):
    for k in range(3):
        ok = conf[:, j]
        if ok.sum() >= 2 and (~ok).any():
            Pi[:, j, k] = np.interp(t, t[ok], P[ok, j, k])
Pf = one_euro(Pi, FPS)
# лёгкий SG поверх, чтобы убрать остаточные ступеньки
Pf = savgol_filter(Pf, 7, 2, axis=0)

# ---------- 3. ключевые точки
def mid(a, b): return (a + b) / 2
H = mid(Pf[:, 23], Pf[:, 24])               # таз
NK = mid(Pf[:, 11], Pf[:, 12])              # основание шеи (между плеч)
EAR = mid(Pf[:, 7], Pf[:, 8])
SHL, SHR = Pf[:, 11], Pf[:, 12]
ELL, ELR = Pf[:, 13], Pf[:, 14]
WRL, WRR = Pf[:, 15], Pf[:, 16]
HDL = mid(Pf[:, 19], Pf[:, 17])             # середина ладони (указательный+мизинец)
HDR = mid(Pf[:, 20], Pf[:, 18])
HPL, HPR = Pf[:, 23], Pf[:, 24]
KNL, KNR = Pf[:, 25], Pf[:, 26]
ANL, ANR = Pf[:, 27], Pf[:, 28]
TOL, TOR = Pf[:, 31], Pf[:, 32]            # носок (foot_index)

def norm(v): return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)
med = lambda a: float(np.nanmedian(a))
mlen = lambda a, b: med(np.linalg.norm(a - b, axis=-1))

# ---------- 4. фиксированные длины костей (медиана, симметризация)
torso = mlen(NK, H)
L = dict(
    torso=torso,
    shoulder_half=(mlen(SHL, SHR)) / 2,
    hip_half=(mlen(HPL, HPR)) / 2,
    ua=(mlen(SHL, ELL) + mlen(SHR, ELR)) / 2,
    la=(mlen(ELL, WRL) + mlen(ELR, WRR)) / 2,
    hand=(mlen(WRL, HDL) + mlen(WRR, HDR)) / 2,
    ul=(mlen(HPL, KNL) + mlen(HPR, KNR)) / 2,
    ll=(mlen(KNL, ANL) + mlen(KNR, ANR)) / 2,
    foot=(mlen(ANL, TOL) + mlen(ANR, TOR)) / 2,
    neck_head=mlen(EAR, NK),
)
ANKLE_H = 0.07
# масштаб: приводим рост к реалистичному? Оставляем метрику MediaPipe (м), но фиксируем
height = L['ul'] + L['ll'] + ANKLE_H + L['torso'] + L['neck_head'] + 0.12
L['height_est'] = height

# ---------- 5. кадр (x,y) -> матрица ориентации; rest = единичная
def frame(xax, yax):
    x = norm(xax)
    z = norm(np.cross(x, yax))
    y = np.cross(z, x)
    return np.stack([x, y, z], axis=-1)       # столбцы = оси в мировых координатах

def swing(d_rest, d_now):
    """кратчайший поворот d_rest -> d_now (T,3) -> Rotation."""
    d_rest = np.broadcast_to(norm(np.asarray(d_rest, float)), d_now.shape)
    a = norm(d_now)
    axis = np.cross(d_rest, a)
    s = np.linalg.norm(axis, axis=-1, keepdims=True)
    c = np.sum(d_rest * a, axis=-1, keepdims=True)
    ang = np.arctan2(s, c)
    axis = np.where(s > 1e-8, axis / (s + 1e-12), np.array([0, 0, 1.0]))
    return R.from_rotvec(axis * ang)

up = NK - H
Hips_g = R.from_matrix(frame(HPL - HPR, up))
Chest_g = R.from_matrix(frame(SHL - SHR, up))
Head_g_raw = R.from_matrix(frame(Pf[:, 7] - Pf[:, 8], EAR - NK))

def slerp_pair(a, b, w=0.5):
    out = []
    for i in range(len(a)):
        s = Slerp([0, 1], R.from_quat([a[i].as_quat(), b[i].as_quat()]))
        out.append(s([w]).as_quat()[0])
    return R.from_quat(np.array(out))

# поправка «нейтрального» положения головы: средний поворот головы относительно груди = нейтраль
rel_head = Chest_g.inv() * Head_g_raw
C_head = rel_head.mean()
Head_g = Chest_g * (C_head.inv() * rel_head)
Spine_g = slerp_pair(list(Hips_g), list(Chest_g), 0.5)
Neck_g = slerp_pair(list(Chest_g), list(Head_g), 0.5)

def child_swing(parent_g, d_world_unit_rest, d_world_now):
    """глобальная ориентация потомка: swing в системе родителя, без твиста."""
    d_local = parent_g.inv().apply(norm(d_world_now))
    sw = swing(d_world_unit_rest, d_local)
    return parent_g * sw

# длины/направления в rest (T-поза)
REST = dict(
    UA_L=(1, 0, 0), UA_R=(-1, 0, 0), LA_L=(1, 0, 0), LA_R=(-1, 0, 0), HA_L=(1, 0, 0), HA_R=(-1, 0, 0),
    UL=(0, -1, 0), LL=(0, -1, 0),
    FOOT=(0, -ANKLE_H, L['foot'])
)
UA_L_g = child_swing(Chest_g, REST['UA_L'], ELL - SHL)
UA_R_g = child_swing(Chest_g, REST['UA_R'], ELR - SHR)
LA_L_g = child_swing(UA_L_g, REST['LA_L'], WRL - ELL)
LA_R_g = child_swing(UA_R_g, REST['LA_R'], WRR - ELR)
HA_L_g = child_swing(LA_L_g, REST['HA_L'], HDL - WRL)
HA_R_g = child_swing(LA_R_g, REST['HA_R'], HDR - WRR)
UL_L_g = child_swing(Hips_g, REST['UL'], KNL - HPL)
UL_R_g = child_swing(Hips_g, REST['UL'], KNR - HPR)
LL_L_g = child_swing(UL_L_g, REST['LL'], ANL - KNL)
LL_R_g = child_swing(UL_R_g, REST['LL'], ANR - KNR)
FT_L_g = child_swing(LL_L_g, REST['FOOT'], TOL - ANL)
FT_R_g = child_swing(LL_R_g, REST['FOOT'], TOR - ANR)

# ---------- 6. скелет (rest-офсеты в системе родителя)
T = torso
OFF = {
    'Hips': (0, 0, 0),
    'Spine': (0, 0.15 * T, 0),
    'Chest': (0, 0.35 * T, 0),
    'Neck': (0, 0.50 * T, 0),
    'Head': (0, 0.35 * L['neck_head'], 0),
    'Head_end': (0, 0.65 * L['neck_head'] + 0.12, 0),
    'LeftUpperArm': (L['shoulder_half'], 0.50 * T, 0),
    'RightUpperArm': (-L['shoulder_half'], 0.50 * T, 0),
    'LeftLowerArm': (L['ua'], 0, 0), 'RightLowerArm': (-L['ua'], 0, 0),
    'LeftHand': (L['la'], 0, 0), 'RightHand': (-L['la'], 0, 0),
    'LeftHand_end': (L['hand'], 0, 0), 'RightHand_end': (-L['hand'], 0, 0),
    'LeftUpperLeg': (L['hip_half'], 0, 0), 'RightUpperLeg': (-L['hip_half'], 0, 0),
    'LeftLowerLeg': (0, -L['ul'], 0), 'RightLowerLeg': (0, -L['ul'], 0),
    'LeftFoot': (0, -L['ll'], 0), 'RightFoot': (0, -L['ll'], 0),
    'LeftToe': (0, -ANKLE_H, L['foot']), 'RightToe': (0, -ANKLE_H, L['foot']),
    'LeftToe_end': (0, 0, 0.06), 'RightToe_end': (0, 0, 0.06),
}
HIER = [  # (joint, parent)
    ('Hips', None), ('Spine', 'Hips'), ('Chest', 'Spine'), ('Neck', 'Chest'), ('Head', 'Neck'),
    ('LeftUpperArm', 'Chest'), ('LeftLowerArm', 'LeftUpperArm'), ('LeftHand', 'LeftLowerArm'),
    ('RightUpperArm', 'Chest'), ('RightLowerArm', 'RightUpperArm'), ('RightHand', 'RightLowerArm'),
    ('LeftUpperLeg', 'Hips'), ('LeftLowerLeg', 'LeftUpperLeg'), ('LeftFoot', 'LeftLowerLeg'), ('LeftToe', 'LeftFoot'),
    ('RightUpperLeg', 'Hips'), ('RightLowerLeg', 'RightUpperLeg'), ('RightFoot', 'RightLowerLeg'), ('RightToe', 'RightFoot'),
]
END = {'Head': 'Head_end', 'LeftHand': 'LeftHand_end', 'RightHand': 'RightHand_end',
       'LeftToe': 'LeftToe_end', 'RightToe': 'RightToe_end'}
GLOBAL = {'Hips': Hips_g, 'Spine': Spine_g, 'Chest': Chest_g, 'Neck': Neck_g, 'Head': Head_g,
          'LeftUpperArm': UA_L_g, 'LeftLowerArm': LA_L_g, 'LeftHand': HA_L_g,
          'RightUpperArm': UA_R_g, 'RightLowerArm': LA_R_g, 'RightHand': HA_R_g,
          'LeftUpperLeg': UL_L_g, 'LeftLowerLeg': LL_L_g, 'LeftFoot': FT_L_g,
          'RightUpperLeg': UL_R_g, 'RightLowerLeg': LL_R_g, 'RightFoot': FT_R_g}
# Toe: наследует ориентацию Foot (локально = identity)
GLOBAL['LeftToe'] = FT_L_g
GLOBAL['RightToe'] = FT_R_g
PARENT = dict(HIER)
LOCAL = {}
for j, p in HIER:
    LOCAL[j] = GLOBAL[j] if p is None else GLOBAL[p].inv() * GLOBAL[j]

# ---------- 7. FK позиции относительно таза (для контакта с полом / root)
def fk_positions(root_pos):
    pos = {}
    for j, p in HIER:
        off = np.array(OFF[j], float)
        if p is None:
            pos[j] = root_pos
        else:
            pos[j] = pos[p] + GLOBAL[p].apply(off)
    for j, e in END.items():
        pos[e] = pos[j] + GLOBAL[j].apply(np.array(OFF[e], float))
    return pos

zero = np.zeros((N, 3))
rel = fk_positions(zero)

# высота корня: самая низкая точка стоп = пол (Y=0)
foot_pts = np.stack([rel[k][:, 1] for k in ('LeftFoot', 'RightFoot', 'LeftToe', 'RightToe')], 1)
low = foot_pts.min(1)
root_y = -low + 0.0
root_y = savgol_filter(root_y, 9, 2)

# контакт: стопа опорная, если её нижняя точка не выше FLOOR_TOL над самой низкой точкой стоп; гистерезис по времени
FLOOR_TOL = 0.05
yL = np.minimum(rel['LeftFoot'][:, 1], rel['LeftToe'][:, 1])
yR = np.minimum(rel['RightFoot'][:, 1], rel['RightToe'][:, 1])
ylow = np.minimum(yL, yR)
plantL = (yL - ylow) < FLOOR_TOL
plantR = (yR - ylow) < FLOOR_TOL
def _close(m, k=3):  # убрать одиночные пропуски/всплески контакта
    m = m.copy()
    for _ in range(2):
        mm = np.convolve(m.astype(float), np.ones(2 * k + 1) / (2 * k + 1), 'same') > 0.5
        m = mm
    return m
plantL, plantR = _close(plantL), _close(plantR)
stance_left = plantL & ~plantR  # для обратной совместимости метрик

# root XZ: фиксация опорных стоп (интегрирование смещений), затем комплементарная фильтрация X с положением таза в кадре
cx = (IMG[:, 23, 0] + IMG[:, 24, 0]) / 2
cx = one_euro(np.where(np.isnan(cx), np.nanmedian(cx), cx), FPS, 1.0, 0.3)
sh2 = (IMG[:, 11, :2] + IMG[:, 12, :2]) / 2
hp2 = (IMG[:, 23, :2] + IMG[:, 24, :2]) / 2
len2 = np.linalg.norm(sh2 - hp2, axis=1)
top = len2 > np.percentile(len2, 70)
m_per_unit = float(np.median(np.linalg.norm((NK - H)[top], axis=1) / len2[top]))
img_x = (cx - np.median(cx)) * m_per_unit

dxz = np.zeros((N, 2))
for i in range(1, N):
    ds = []
    for plant, k in ((plantL, 'LeftFoot'), (plantR, 'RightFoot')):
        if plant[i] and plant[i - 1]:
            ds.append(-(rel[k][i] - rel[k][i - 1])[[0, 2]])
    if ds:
        dxz[i] = np.mean(ds, axis=0)
lock = np.cumsum(dxz, axis=0)
tt = np.arange(N)
# Z: убрать линейный дрейф интегрирования
root_z = lock[:, 1] - np.polyval(np.polyfit(tt, lock[:, 1], 1), tt)
# X: низкие частоты — из изображения, высокие — из фиксации стоп (комплементарный фильтр)
from scipy.signal import butter, filtfilt
bb, aa = butter(2, 0.3 / (FPS / 2))
root_x = filtfilt(bb, aa, img_x) + (lock[:, 0] - filtfilt(bb, aa, lock[:, 0]))
root_z = savgol_filter(root_z, 9, 2)
root_x = savgol_filter(root_x, 9, 2)

root = np.stack([root_x, root_y, root_z], 1)
pos = fk_positions(root)

# ---------- 8. скольжение стоп: метрика (до/после фиксации root)
def slide_metric(posd):
    """средняя скорость опорных стоп в плоскости пола (м/с); чем меньше, тем лучше."""
    v = []
    for i in range(1, N):
        for plant, k in ((plantL, 'LeftFoot'), (plantR, 'RightFoot')):
            if plant[i] and plant[i - 1]:
                v.append(np.linalg.norm((posd[k][i] - posd[k][i - 1])[[0, 2]]) * FPS)
    return float(np.mean(v))
slide_after = slide_metric(pos)
pos_noroot = fk_positions(np.stack([np.zeros(N), root_y, np.zeros(N)], 1))
slide_before = slide_metric(pos_noroot)

# ---------- 9. запись BVH
def euler_zxy(rot):
    return rot.as_euler('ZXY', degrees=True)  # intrinsic Rz*Rx*Ry

with open(out + '.bvh', 'w') as f:
    def write_joint(j, depth):
        ind = '  ' * depth
        off = OFF[j]
        kw = 'ROOT' if depth == 0 else 'JOINT'
        f.write(f"{ind}{kw} {j}\n{ind}{{\n{ind}  OFFSET {off[0]:.5f} {off[1]:.5f} {off[2]:.5f}\n")
        if depth == 0:
            f.write(f"{ind}  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n")
        else:
            f.write(f"{ind}  CHANNELS 3 Zrotation Xrotation Yrotation\n")
        kids = [c for c, p in HIER if p == j]
        for c in kids:
            write_joint(c, depth + 1)
        if j in END:
            e = OFF[END[j]]
            f.write(f"{ind}  End Site\n{ind}  {{\n{ind}    OFFSET {e[0]:.5f} {e[1]:.5f} {e[2]:.5f}\n{ind}  }}\n")
        f.write(f"{ind}}}\n")
    f.write("HIERARCHY\n")
    write_joint('Hips', 0)
    f.write(f"MOTION\nFrames: {N}\nFrame Time: {dt:.6f}\n")
    order = [j for j, _ in HIER]
    eul = {j: euler_zxy(LOCAL[j]) for j in order}
    for i in range(N):
        row = [root[i, 0], root[i, 1], root[i, 2]]
        row += list(eul['Hips'][i])
        for j in order[1:]:
            row += list(eul[j][i])
        f.write(' '.join(f"{v:.4f}" for v in row) + '\n')

np.savez_compressed(out + '_src_keypoints.npz', Pf=Pf, vis=VIS)
np.savez_compressed(out + '_joints.npz', **{k: v for k, v in pos.items()}, root=root)

# ---------- 10. метрики
raw_j = jitter(Pi[:, [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]])
fil_j = jitter(Pf[:, [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]])
low_conf = ~(VIS[:, [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32]] > 0.5).all(1)
segs = []
i = 0
while i < N:
    if low_conf[i]:
        j = i
        while j < N and low_conf[j]: j += 1
        if (j - i) >= 5: segs.append([round(i / FPS, 2), round(j / FPS, 2)])
        i = j
    else:
        i += 1
metrics = dict(
    frames=N, fps=FPS, detect_rate=float(d['det'].mean()),
    conf_frames_ratio_all_key_joints=float(1 - low_conf.mean()),
    mean_visibility={k: round(float(np.nanmean(VIS[:, i])), 3) for k, i in dict(
        L_elbow=13, R_elbow=14, L_wrist=15, R_wrist=16, L_knee=25, R_knee=26, L_ankle=27, R_ankle=28).items()},
    jitter_raw_m_per_frame2=raw_j, jitter_filtered_m_per_frame2=fil_j,
    jitter_reduction=float(1 - fil_j / raw_j),
    foot_slide_before_m_s=slide_before, foot_slide_after_m_s=slide_after,
    low_conf_segments_s=segs, source_rotated_head_frames_held=rotated_head_frames, lr_swap_corrections_frames=swap_frames, m_per_img_unit=m_per_unit, bone_lengths_m={k: round(v, 3) for k, v in L.items()},
    root_x_range_m=[float(root_x.min()), float(root_x.max())], root_z_range_m=[float(root_z.min()), float(root_z.max())],
)
json.dump(metrics, open(out + '_metrics.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(metrics, indent=1, ensure_ascii=False))
