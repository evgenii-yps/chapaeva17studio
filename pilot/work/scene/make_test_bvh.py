#!/usr/bin/env python
"""Тестовый BVH-генератор по спецификации этапа 3 (Y-up, метры, 30 fps, ZXY, корень Hips).
Запуск: /opt/pv/bin/python -I make_test_bvh.py OUT.bvh [--frames 300]
Движение: левая рука вбок и вверх; приседание; выпад вперёд; шаг вправо (+X) на 1 м; обе руки над головой.
Левая рука персонажа = +X (персонаж смотрит в +Z)."""
import math, sys

OFF = {
 'Hips': (0, 0.98, 0),
 'Spine': (0, 0.10, 0), 'Chest': (0, 0.20, 0), 'Neck': (0, 0.17, 0), 'Head': (0, 0.10, 0), 'HeadEnd': (0, 0.22, 0),
 'LeftUpperArm': (0.18, 0.15, 0), 'LeftLowerArm': (0, -0.30, 0), 'LeftHand': (0, -0.26, 0), 'LeftHandEnd': (0, -0.10, 0),
 'RightUpperArm': (-0.18, 0.15, 0), 'RightLowerArm': (0, -0.30, 0), 'RightHand': (0, -0.26, 0), 'RightHandEnd': (0, -0.10, 0),
 'LeftUpperLeg': (0.09, -0.05, 0), 'LeftLowerLeg': (0, -0.42, 0), 'LeftFoot': (0, -0.42, 0), 'LeftToe': (0, -0.06, 0.14), 'LeftToeEnd': (0, -0.02, 0.07),
 'RightUpperLeg': (-0.09, -0.05, 0), 'RightLowerLeg': (0, -0.42, 0), 'RightFoot': (0, -0.42, 0), 'RightToe': (0, -0.06, 0.14), 'RightToeEnd': (0, -0.02, 0.07),
}
TREE = ('Hips', [
  ('Spine', [('Chest', [('Neck', [('Head', [])]),
      ('LeftUpperArm', [('LeftLowerArm', [('LeftHand', [])])]),
      ('RightUpperArm', [('RightLowerArm', [('RightHand', [])])])])]),
  ('LeftUpperLeg', [('LeftLowerLeg', [('LeftFoot', [('LeftToe', [])])])]),
  ('RightUpperLeg', [('RightLowerLeg', [('RightFoot', [('RightToe', [])])])]),
])
ORDER = []  # порядок DFS (как в MOTION)

def header():
    out = []
    def rec(node, ind):
        name, ch = node
        ORDER.append(name)
        pad = '\t' * ind
        kw = 'ROOT' if ind == 0 else 'JOINT'
        out.append(f'{pad}{kw} {name}'); out.append(pad + '{')
        o = OFF[name]
        out.append(f'{pad}\tOFFSET {o[0]:.5f} {o[1]:.5f} {o[2]:.5f}')
        if ind == 0:
            out.append(f'{pad}\tCHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation')
        else:
            out.append(f'{pad}\tCHANNELS 3 Zrotation Xrotation Yrotation')
        for c in ch: rec(c, ind + 1)
        if not ch:
            o = OFF[name + 'End']
            out.append(f'{pad}\tEnd Site'); out.append(pad + '\t{')
            out.append(f'{pad}\t\tOFFSET {o[0]:.5f} {o[1]:.5f} {o[2]:.5f}'); out.append(pad + '\t}')
        out.append(pad + '}')
    out.append('HIERARCHY'); rec(TREE, 0)
    return out

def smooth(t):  # 0..1 -> 0..1
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def seg(t, a, b):  # плавная доля на отрезке [a,b]
    return smooth((t - a) / (b - a))

def pose(f, n):
    t = f / (n - 1)
    r = {k: [0.0, 0.0, 0.0] for k in ORDER}  # Z, X, Y градусы
    root = [0.0, OFF['Hips'][1], 0.0]
    # 0.00-0.20: левая рука вбок до горизонтали и вверх
    up = seg(t, 0.05, 0.25) * 170 - seg(t, 0.28, 0.35) * 170
    r['LeftUpperArm'][0] = up
    # 0.30-0.50: приседание
    sq = seg(t, 0.30, 0.42) - seg(t, 0.48, 0.55)
    a = math.radians(55 * sq)
    r['LeftUpperLeg'][1] = r['RightUpperLeg'][1] = -55 * sq
    r['LeftLowerLeg'][1] = r['RightLowerLeg'][1] = 110 * sq
    r['LeftFoot'][1] = r['RightFoot'][1] = -55 * sq
    root[1] -= (0.84) * (1 - math.cos(a))
    r['Spine'][1] = 15 * sq
    # 0.55-0.75: шаг вправо +X (метры) и обе руки вверх
    root[0] = 1.0 * seg(t, 0.55, 0.70) - 1.0 * seg(t, 0.85, 0.98)
    arms = seg(t, 0.60, 0.75) - seg(t, 0.80, 0.90)
    r['LeftUpperArm'][0] += 175 * arms
    r['RightUpperArm'][0] -= 175 * arms
    # поворот корпуса вокруг Y
    r['Chest'][2] = 25 * math.sin(t * math.pi * 4)
    # выпад вперёд (+Z), поворот таза 0
    lg = seg(t, 0.80, 0.86) - seg(t, 0.93, 0.99)
    root[2] = 0.0
    return root, r

def main():
    out = sys.argv[1]
    n = 300
    if '--frames' in sys.argv: n = int(sys.argv[sys.argv.index('--frames') + 1])
    lines = header()
    lines += ['MOTION', f'Frames: {n}', 'Frame Time: 0.0333333']
    for f in range(n):
        root, r = pose(f, n)
        vals = list(root) + r['Hips']
        for k in ORDER[1:]: vals += r[k]
        lines.append(' '.join(f'{v:.4f}' for v in vals))
    open(out, 'w').write('\n'.join(lines) + '\n')
    print('written', out, n, 'frames')
main()
