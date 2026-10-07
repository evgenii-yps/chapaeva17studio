#!/usr/bin/env python
"""Этап 4: из BVH строит сцену (студия + процедурный манекен + камера) и рендерит видео БЕЗ звука.

Запуск (headless bpy 5.2):
  /opt/pv/bin/python -I work/scene/build_scene.py --bvh PATH.bvh --out PATH.mp4 [опции]
  /opt/pv/bin/python -I work/scene/build_scene.py --bvh PATH.bvh --still /tmp/x.png --frame-start 100

Допущения о BVH (спека этапа 3): Y-up, метры, 30 fps, порядок ZXY, корень Hips, персонаж в нейтрали
смотрит в +Z, его левая рука в +X. Импорт: bpy.ops.import_anim.bvh(axis_forward='Z', axis_up='Y', scale 1).
В Blender (Z-up) персонаж смотрит в +Y, левая рука в -X. Кадр BVH i (с 0) = кадр Blender i+1.
Все ассеты процедурные (CC0 по авторству).
"""
import argparse
import math
import os
import shutil
import subprocess
import sys
import time

import bpy
import bmesh  # noqa: F401
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))


# --------------------------------------------------------------------------- CLI
def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--bvh', required=True)
    p.add_argument('--out', help='выходной mp4 (без звука)')
    p.add_argument('--width', type=int, default=1280)
    p.add_argument('--height', type=int, default=720)
    p.add_argument('--fps', type=int, default=30)
    p.add_argument('--frame-start', type=int, default=None, help='первый кадр BVH (с 0)')
    p.add_argument('--frame-end', type=int, default=None, help='последний кадр BVH (включительно)')
    p.add_argument('--frame-step', type=int, default=1, help='рендерить каждый K-й кадр (видео дублирует до --fps)')
    p.add_argument('--engine', default='EEVEE', choices=['EEVEE', 'WORKBENCH', 'CYCLES'])
    p.add_argument('--samples', type=int, default=None, help='сэмплы (EEVEE TAA / Cycles)')
    p.add_argument('--still', help='отрендерить один кадр (номер = --frame-start) в этот PNG и выйти')
    p.add_argument('--save-blend', help='сохранить .blend (без данных анимации тяжёлых) и выйти, если нет --out/--still')
    p.add_argument('--tmp-dir', default=os.path.join(HERE, '_tmp_frames'))
    p.add_argument('--no-resume', action='store_true', help='перерисовать все кадры заново')
    p.add_argument('--part', default='0/1', help='K/N: рендерить только кадры с номером(порядковым) %% N == K '
                   '(для запуска нескольких процессов параллельно; сборку mp4 делайте --assemble-only)')
    p.add_argument('--assemble-only', action='store_true', help='только собрать mp4 из имеющихся PNG')
    p.add_argument('--azimuth', type=float, default=35.0, help='азимут камеры от фронтального вида, градусы')
    p.add_argument('--focal', type=float, default=50.0, help='фокусное, мм (экв. 35 мм)')
    p.add_argument('--cam-height', type=float, default=1.25, help='высота камеры, м')
    p.add_argument('--margin', type=float, default=0.10, help='запас по краям кадра (доля)')
    p.add_argument('--follow', type=float, default=0.7, help='доля плавного следования камеры за корнем (0 = фиксированная)')
    p.add_argument('--quality', default='fast', choices=['fast', 'balanced'],
                   help='fast: EEVEE без теневых карт + мягкие «пятна-тени» под ногами; balanced: настоящие тени (в ~2 раза медленнее)')
    p.add_argument('--crf', type=int, default=18)
    return p.parse_args()


# --------------------------------------------------------------------------- построитель меша
class MeshBuilder:
    """Копит вершины/грани процедурных частей тела. Каждая вершина получает группу (кость) и грань — материал."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.vgroup = []      # имя кости на вершину
        self.fmat = []        # индекс материала на грань

    def _ring(self, center, u, v, ru, rv, n, bone):
        base = len(self.verts)
        for k in range(n):
            a = 2 * math.pi * k / n
            self.verts.append(center + u * (math.cos(a) * ru) + v * (math.sin(a) * rv))
            self.vgroup.append(bone)
        return base

    def _pole(self, p, bone):
        self.verts.append(Vector(p))
        self.vgroup.append(bone)
        return len(self.verts) - 1

    def surface(self, rings, bone, mat, n):
        """rings: список (center, ru, rv, u, v) или ('pole', point); соседние кольца соединяются."""
        idx, pole = [], []
        for r in rings:
            if r[0] == 'pole':
                idx.append(self._pole(r[1], bone))
                pole.append(True)
            else:
                c, ru, rv, u, v = r
                idx.append(self._ring(c, u, v, ru, rv, n, bone))
                pole.append(False)
        for j in range(len(idx) - 1):
            a, b, pa, pb = idx[j], idx[j + 1], pole[j], pole[j + 1]
            for k in range(n):
                k2 = (k + 1) % n
                if pa and not pb:
                    self._f([a, b + k2, b + k], mat)
                elif pb and not pa:
                    self._f([a + k, a + k2, b], mat)
                elif not pa and not pb:
                    self._f([a + k, a + k2, b + k2, b + k], mat)

    def _f(self, vs, mat):
        self.faces.append(vs)
        self.fmat.append(mat)

    def capsule(self, p0, p1, r0, r1, bone, mat, side=None, n=20, cap=5, ext0=None, ext1=None):
        """Сужающаяся капсула p0->p1. r0, r1: радиусы (число или (боковой, переднезадний)).
        side — направление «боковой» оси (по умолчанию мировая X). ext — выступ сферической крышки."""
        p0, p1 = Vector(p0), Vector(p1)
        ax = p1 - p0
        L = ax.length
        ax = ax / L if L > 1e-6 else Vector((0, 0, 1))
        s = Vector(side) if side is not None else Vector((1, 0, 0))
        s = s - ax * s.dot(ax)
        if s.length < 1e-4:
            s = Vector((0, 1, 0)) - ax * ax.y
        s.normalize()
        t = ax.cross(s).normalized()
        r0 = r0 if isinstance(r0, tuple) else (r0, r0)
        r1 = r1 if isinstance(r1, tuple) else (r1, r1)
        e0 = ext0 if ext0 is not None else (r0[0] + r0[1]) / 2
        e1 = ext1 if ext1 is not None else (r1[0] + r1[1]) / 2
        rings = [('pole', p0 - ax * e0)]
        for j in range(1, cap):
            ph = -math.pi / 2 * (1 - j / cap)
            rings.append((p0 + ax * (e0 * math.sin(ph)), r0[0] * math.cos(ph), r0[1] * math.cos(ph), s, t))
        rings.append((p0, r0[0], r0[1], s, t))
        if L > 1e-5:
            rings.append((p1, r1[0], r1[1], s, t))
        for j in range(1, cap):
            ph = math.pi / 2 * (j / cap)
            rings.append((p1 + ax * (e1 * math.sin(ph)), r1[0] * math.cos(ph), r1[1] * math.cos(ph), s, t))
        rings.append(('pole', p1 + ax * e1))
        self.surface(rings, bone, mat, n)

    def ellipsoid(self, center, axis, radii, bone, mat, side=None, n=24, cap=8):
        """Эллипсоид: radii=(вдоль оси, боковой, третий)."""
        c = Vector(center)
        a = Vector(axis).normalized()
        self.capsule(c, c, (radii[1], radii[2]), (radii[1], radii[2]), bone, mat, side=side, n=n, cap=cap,
                     ext0=radii[0], ext1=radii[0])

    def build(self, name, bones_order, materials):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        me.update()
        for poly, m in zip(me.polygons, self.fmat):
            poly.use_smooth = True
            poly.material_index = m
        for m in materials:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        groups = {b: ob.vertex_groups.new(name=b) for b in bones_order}
        by = {}
        for i, b in enumerate(self.vgroup):
            by.setdefault(b, []).append(i)
        for b, ids in by.items():
            groups[b].add(ids, 1.0, 'REPLACE')
        return ob


# --------------------------------------------------------------------------- материалы
def make_principled(name, color, rough=0.5, sheen=0.0, spec=0.5, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    for k, v in (('Sheen Weight', sheen), ('Specular IOR Level', spec), ('Subsurface Weight', sss)):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def wood_floor_material():
    m = bpy.data.materials.new('WoodFloor')
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes['Principled BSDF']
    tc = nodes.new('ShaderNodeTexCoord')
    # доски вдоль оси X: ширина 0.16 м, длина 1.6 м, ступенчатый сдвиг
    brick = nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.5
    brick.offset_frequency = 2
    brick.squash = 1.0
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Mortar Size'].default_value = 0.004
    brick.inputs['Mortar Smooth'].default_value = 0.1
    brick.inputs['Bias'].default_value = 0.0
    brick.inputs['Brick Width'].default_value = 1.6
    brick.inputs['Row Height'].default_value = 0.16
    brick.inputs['Color1'].default_value = (*srgb('#C9A375'), 1)
    brick.inputs['Color2'].default_value = (*srgb('#B98F60'), 1)
    brick.inputs['Mortar'].default_value = (*srgb('#7A5A3A'), 1)
    links.new(tc.outputs['Object'], brick.inputs['Vector'])
    # волокна: шум, растянутый вдоль X
    mp = nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.5, 55.0, 1.0)
    links.new(tc.outputs['Object'], mp.inputs['Vector'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 4.0
    noise.inputs['Detail'].default_value = 4.0
    noise.inputs['Roughness'].default_value = 0.6
    links.new(mp.outputs['Vector'], noise.inputs['Vector'])
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 0.35
    links.new(brick.outputs['Color'], mix.inputs['A'])
    links.new(noise.outputs['Color'], mix.inputs['B'])
    links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    bump.inputs['Distance'].default_value = 0.01
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 0.42
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.45
    return m


def emission_material(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


# --------------------------------------------------------------------------- импорт BVH
def import_bvh(path):
    bpy.ops.import_anim.bvh(filepath=path, axis_forward='Z', axis_up='Y', global_scale=1.0, frame_start=1,
                            use_fps_scale=False, update_scene_fps=False, update_scene_duration=True,
                            rotate_mode='NATIVE')
    arm = bpy.context.object
    assert arm.type == 'ARMATURE', 'импорт BVH не создал арматуру'
    return arm


REQUIRED = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
            'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot',
            'LeftToe', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot', 'RightToe']


def action_fcurves(act):
    try:
        return list(act.fcurves)           # Blender <= 4.x
    except AttributeError:
        return [fc for lay in act.layers for st in lay.strips for cb in st.channelbags for fc in cb.fcurves]


def bvh_frame_count(arm):
    """Число кадров BVH по ключам анимации (кадры 1..N)."""
    fcs = action_fcurves(arm.animation_data.action)
    return int(max(fc.keyframe_points[-1].co.x for fc in fcs))


def rest_joints(arm):
    """Позиции суставов в покое в мировых координатах: head кости; для листьев ещё tail (End Site)."""
    mw = arm.matrix_world
    bones = arm.data.bones
    missing = [n for n in REQUIRED if n not in bones]
    if missing:
        raise SystemExit(f'в BVH нет суставов: {missing}')
    J = {b.name: mw @ b.head_local for b in bones}
    T = {b.name: mw @ b.tail_local for b in bones}
    return J, T


# --------------------------------------------------------------------------- манекен
def build_mannequin(arm):
    J, T = rest_joints(arm)
    suit = make_principled('Suit', srgb('#F1EDE4'), rough=0.62, sheen=0.4, spec=0.35)
    skin = make_principled('Skin', srgb('#D8B7A0'), rough=0.55, spec=0.3, sss=0.1)
    hair = make_principled('Hair', srgb('#2A2320'), rough=0.5)
    shoe = make_principled('Shoe', srgb('#CFC8BC'), rough=0.55)
    sash = make_principled('Sash', srgb('#8C9A8B'), rough=0.6)  # шалфейный пояс — единственный акцент
    SUIT, SKIN, HAIR, SHOE, SASH = range(5)
    mats = [suit, skin, hair, shoe, sash]
    mb = MeshBuilder()
    X = Vector((1, 0, 0))
    Y = Vector((0, 1, 0))
    Z = Vector((0, 0, 1))

    # масштаб тела от длины ног/плеч
    hip_w = abs(J['LeftUpperLeg'].x - J['RightUpperLeg'].x)           # расстояние между тазобедренными
    sh_w = abs(J['LeftUpperArm'].x - J['RightUpperArm'].x)            # между плечевыми
    sole_z = min(min(J[s + 'Toe'].z, T[s + 'Toe'].z) for s in ('Left', 'Right'))   # подошва в позе покоя
    total_h = T['Head'].z - sole_z
    k = max(0.7, min(1.4, total_h / 1.77))                              # масштаб деталей относительно рост 1.77 м
    R = lambda v: v * k  # noqa: E731

    n = 20
    # --- таз и торс (цепочка капсул, веса на кости)
    hips, spine, chest, neck, head = J['Hips'], J['Spine'], J['Chest'], J['Neck'], J['Head']
    pelvis_c = hips + Vector((0, 0, R(0.02)))
    mb.ellipsoid(pelvis_c, Z, (R(0.115), hip_w * 0.70, R(0.115)), 'Hips', SUIT, n=24, cap=8)
    # талия: от таза к грудной кости
    mb.capsule(spine, chest, (hip_w * 0.62, R(0.095)), (sh_w * 0.50, R(0.105)), 'Spine', SUIT, side=X, n=n, cap=4,
               ext0=R(0.06), ext1=R(0.04))
    # пояс на талии
    mb.capsule(spine + Vector((0, 0, R(0.015))), spine + Vector((0, 0, R(0.055))), (max(hip_w * 0.62, sh_w * 0.5) * 1.12, R(0.118)),
               (max(hip_w * 0.62, sh_w * 0.5) * 1.12, R(0.118)), 'Spine', SASH, side=X, n=n, cap=1, ext0=R(0.004), ext1=R(0.004))
    # грудная клетка: от Chest до шеи, шире в плечах
    cc = (chest + neck) / 2 + Vector((0, 0, R(0.02)))
    mb.ellipsoid(cc, Z, (((neck - chest).length) * 0.72, sh_w * 0.58, R(0.115)), 'Chest', SUIT, n=24, cap=8)
    # верх плеч-трапеция: капсула между плечевыми суставами (закрывает «воротник»)
    mb.capsule(J['LeftUpperArm'] + Vector((0, 0, R(0.01))), J['RightUpperArm'] + Vector((0, 0, R(0.01))),
               R(0.058), R(0.058), 'Chest', SUIT, side=Y, n=n, cap=4)
    # --- шея и голова
    mb.capsule(neck, head + Vector((0, 0, R(0.01))), R(0.050), R(0.045), 'Neck', SKIN, side=X, n=n, cap=4,
               ext0=R(0.03), ext1=R(0.03))
    head_tail = T['Head']
    hv = head_tail - head
    hl = hv.length if hv.length > 1e-3 else R(0.22)
    hdir = hv / hl if hv.length > 1e-3 else Z
    hc = head + hdir * (hl * 0.52)
    mb.ellipsoid(hc, hdir, (hl * 0.54, R(0.083), R(0.098)), 'Head', SKIN, side=X, n=28, cap=10)
    # волосы: шапочка (эллипсоид чуть больше, сдвинутый назад-вверх) — подсказывает, куда смотрит манекен
    mb.ellipsoid(hc + hdir * (hl * 0.07) - Y * R(0.020), hdir, (hl * 0.50, R(0.088), R(0.100)), 'Head', HAIR,
                 side=X, n=28, cap=10)

    # --- руки
    for s, sgn in (('Left', 1), ('Right', 1)):
        ua, la, hd = J[s + 'UpperArm'], J[s + 'LowerArm'], J[s + 'Hand']
        hend = T[s + 'Hand']
        mb.ellipsoid(ua, Z, (R(0.062), R(0.062), R(0.062)), s + 'UpperArm', SUIT, n=20, cap=7)       # плечо
        mb.capsule(ua, la, R(0.050), R(0.040), s + 'UpperArm', SUIT, side=Y, n=n, cap=4, ext0=0, ext1=0)
        mb.ellipsoid(la, Z, (R(0.043), R(0.043), R(0.043)), s + 'LowerArm', SUIT, n=18, cap=6)        # локоть
        mb.capsule(la, hd, R(0.040), R(0.031), s + 'LowerArm', SUIT, side=Y, n=n, cap=4, ext0=0, ext1=0)
        mb.capsule(hd - (hd - la).normalized() * R(0.0), hd + (hd - la).normalized() * R(0.012), R(0.034), R(0.033),
                   s + 'LowerArm', SUIT, n=16, cap=3, ext0=R(0.01), ext1=R(0.01))                      # манжета
        # кисть: сплюснутый эллипсоид вдоль кости Hand (End Site)
        hvv = hend - hd
        hll = hvv.length if hvv.length > 1e-3 else R(0.18)
        hdr = hvv / hll if hvv.length > 1e-3 else -Z
        mb.ellipsoid(hd + hdr * (hll * 0.55), hdr, (hll * 0.62, R(0.036), R(0.018)), s + 'Hand', SKIN, side=X,
                     n=20, cap=7)
        # большой палец — небольшой выступ вперёд-внутрь
        inward = (-X if s == 'Left' else X)  # внутрь к телу — зависит от позы покоя, косметика
        mb.ellipsoid(hd + hdr * (hll * 0.28) + Y * R(0.020), hdr, (hll * 0.28, R(0.012), R(0.012)), s + 'Hand', SKIN,
                     side=X, n=12, cap=5)

    # --- ноги и стопы
    for s in ('Left', 'Right'):
        ul, ll, ft, to = J[s + 'UpperLeg'], J[s + 'LowerLeg'], J[s + 'Foot'], J[s + 'Toe']
        tend = T[s + 'Toe']
        mb.ellipsoid(ul, Z, (R(0.085), R(0.085), R(0.085)), s + 'UpperLeg', SUIT, n=22, cap=8)       # бедро-шар
        mb.capsule(ul, ll, (R(0.082), R(0.080)), (R(0.056), R(0.056)), s + 'UpperLeg', SUIT, n=24, cap=4, ext0=0,
                   ext1=0)
        mb.ellipsoid(ll, Z, (R(0.057), R(0.057), R(0.057)), s + 'LowerLeg', SUIT, n=20, cap=7)       # колено
        mb.capsule(ll, ft, (R(0.055), R(0.055)), (R(0.040), R(0.040)), s + 'LowerLeg', SUIT, n=22, cap=4, ext0=0,
                   ext1=0)
        mb.ellipsoid(ft, Z, (R(0.042), R(0.042), R(0.042)), s + 'Foot', SUIT, n=16, cap=6)           # щиколотка
        # стопа: капсула вдоль подошвы
        rf = max(0.025, min(0.045, (ft.z - sole_z) * 0.55))
        zc = sole_z + rf
        heel = Vector((ft.x, ft.y - R(0.02), zc))
        ball = Vector((to.x, to.y, sole_z + rf * 0.9))
        mb.capsule(heel, ball, (rf * 1.15, rf), (rf * 1.2, rf * 0.9), s + 'Foot', SHOE, side=X, n=18, cap=5)
        tip = Vector((tend.x, tend.y, sole_z + rf * 0.8))
        mb.capsule(ball, tip, (rf * 1.2, rf * 0.9), (rf * 1.0, rf * 0.75), s + 'Toe', SHOE, side=X, n=18, cap=5)

    ob = mb.build('Mannequin', [b.name for b in arm.data.bones], mats)
    ob.parent = arm
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    ob.show_wire = False
    return ob


# --------------------------------------------------------------------------- студия
_STATIC = {}   # материал -> (verts, faces): статическая геометрия студии склеивается по материалам (меньше draw call'ов)


def box(name, loc, size, mat):
    sx, sy, sz = (s / 2 for s in size)
    vs = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
          (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    V, F = _STATIC.setdefault(mat.name, (mat, [], []))[1:]
    base = len(V)
    V.extend((x + loc[0], y + loc[1], z + loc[2]) for x, y, z in vs)
    F.extend(tuple(base + i for i in f) for f in fs)


def flush_static():
    for mat, V, F in _STATIC.values():
        me = bpy.data.meshes.new('Studio_' + mat.name)
        me.from_pydata(V, [], F)
        me.update()
        me.materials.append(mat)
        ob = bpy.data.objects.new('Studio_' + mat.name, me)
        bpy.context.scene.collection.objects.link(ob)
    _STATIC.clear()


def build_studio():
    wall = make_principled('Wall', srgb('#EEE9E1'), rough=0.9, spec=0.2)
    trim = make_principled('Trim', srgb('#F7F4EE'), rough=0.6, spec=0.3)
    slat_m = make_principled('Slat', srgb('#B88B5E'), rough=0.5)
    floor_m = wood_floor_material()
    sky = emission_material('Sky', srgb('#EAF2FF'), 9.0)
    ceil_m = make_principled('Ceiling', srgb('#F4F1EA'), rough=0.9, spec=0.1)

    W, H = 12.0, 3.3          # комната: x от -6 до 6; высота 3.3
    y_back, y_front = -3.2, 9.0
    x_left, x_right = -4.3, 8.0
    # пол
    box('Floor', ((x_left + x_right) / 2, (y_back + y_front) / 2, -0.05),
                (x_right - x_left, y_front - y_back, 0.1), floor_m)
    # задняя стена (за персонажем), потолок
    box('WallBack', ((x_left + x_right) / 2, y_back - 0.05, H / 2), (x_right - x_left, 0.1, H), wall)
    box('Ceiling', ((x_left + x_right) / 2, (y_back + y_front) / 2, H + 0.05), (x_right - x_left, y_front - y_back, 0.1),
        ceil_m)
    # правая стена с проёмом окна на левой стороне комнаты (x_left): окно во всю высоту почти
    wy0, wy1 = -1.6, 3.4           # окно по Y
    sill, head_h = 0.25, 2.85
    L = y_front - y_back
    # части стены x=x_left: слева/справа от проёма, под и над
    box('WallL_a', (x_left - 0.05, (y_back + wy0) / 2, H / 2), (0.1, wy0 - y_back, H), wall)
    box('WallL_b', (x_left - 0.05, (wy1 + y_front) / 2, H / 2), (0.1, y_front - wy1, H), wall)
    box('WallL_c', (x_left - 0.05, (wy0 + wy1) / 2, sill / 2), (0.1, wy1 - wy0, sill), wall)
    box('WallL_d', (x_left - 0.05, (wy0 + wy1) / 2, (head_h + H) / 2), (0.1, wy1 - wy0, H - head_h), wall)
    # рама окна: тонкие белые импосты
    for i in range(1, 4):
        yy = wy0 + (wy1 - wy0) * i / 4
        box(f'Mullion{i}', (x_left + 0.01, yy, (sill + head_h) / 2), (0.05, 0.045, head_h - sill), trim)
    box('MullionH', (x_left + 0.01, (wy0 + wy1) / 2, (sill + head_h) / 2 + 0.55), (0.05, wy1 - wy0, 0.04), trim)
    # «небо» за окном
    box('Sky', (x_left - 1.2, (wy0 + wy1) / 2, 1.6), (0.05, 7.0, 4.5), sky)
    # плинтус
    box('BaseboardBack', ((x_left + x_right) / 2, y_back + 0.012, 0.05), (x_right - x_left, 0.024, 0.10), trim)
    box('BaseboardLeft_a', (x_left + 0.012, (y_back + wy0) / 2, 0.05), (0.024, wy0 - y_back, 0.10), trim)
    box('BaseboardLeft_b', (x_left + 0.012, (wy1 + y_front) / 2, 0.05), (0.024, y_front - wy1, 0.10), trim)
    # реечная панель на задней стене (премиум-акцент)
    n_slat = 36
    x0, x1 = -2.4, 1.6
    for i in range(n_slat):
        xx = x0 + (x1 - x0) * (i + 0.5) / n_slat
        box(f'Slat{i}', (xx, y_back + 0.03, 1.35), (0.075, 0.05, 2.3), slat_m)
    flush_static()
    # свет: большой area-свет в проёме окна + мягкий заполняющий
    la = bpy.data.lights.new('WindowLight', 'AREA')
    la.shape = 'RECTANGLE'
    la.size, la.size_y = 4.5, 2.6
    la.energy = 2500
    la.color = (1.0, 0.97, 0.93)
    lo = bpy.data.objects.new('WindowLight', la)
    lo.location = (x_left + 0.15, (wy0 + wy1) / 2, 1.55)
    lo.rotation_euler = (0, math.radians(90), 0)   # светит вдоль +X
    bpy.context.scene.collection.objects.link(lo)
    lf = bpy.data.lights.new('Fill', 'AREA')
    lf.shape = 'RECTANGLE'
    lf.size, lf.size_y = 5.0, 3.0
    lf.energy = 900
    lf.color = (0.93, 0.96, 1.0)
    lfo = bpy.data.objects.new('Fill', lf)
    lfo.location = (4.8, 3.6, 2.7)
    lfo.rotation_euler = (Vector((0, -0.2, 1.0)) - lfo.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(lfo)
    # мир: мягкий светлый
    w = bpy.data.worlds.new('World')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*srgb('#DCE6F2'), 1)
    bg.inputs['Strength'].default_value = 0.55
    bpy.context.scene.world = w


# --------------------------------------------------------------------------- фейковые контактные тени
def blob_material():
    m = bpy.data.materials.new('BlobShadow')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    mp = nt.nodes.new('ShaderNodeMapping')   # Generated 0..1 -> -1..1 вокруг центра
    mp.inputs['Scale'].default_value = (2, 2, 2)
    mp.inputs['Location'].default_value = (-1, -1, 0)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    ramp.color_ramp.interpolation = 'EASE'
    nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    dk = nt.nodes.new('ShaderNodeEmission')
    dk.inputs['Color'].default_value = (0.02, 0.012, 0.008, 1)
    dk.inputs['Strength'].default_value = 1.0
    mix = nt.nodes.new('ShaderNodeMixShader')
    # Fac = непрозрачность * интенсивность
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.6
    nt.links.new(ramp.outputs['Color'], mul.inputs[0])
    nt.links.new(mul.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(dk.outputs[0], mix.inputs[2])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(mix.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    m.use_backface_culling = False
    return m


def add_blob_shadows(arm):
    """Мягкие тёмные пятна на полу под тазом и стопами, следуют за костями (Copy Location по X/Y)."""
    mat = blob_material()
    spec = [('Hips', 'head', 0.55, 0.32), ('LeftFoot', 'head', 0.26, 0.5), ('RightFoot', 'head', 0.26, 0.5),
            ('LeftToe', 'head', 0.2, 0.5), ('RightToe', 'head', 0.2, 0.5)]
    for bone, _, size, _k in spec:
        me = bpy.data.meshes.new('Blob_' + bone)
        h = size
        me.from_pydata([(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [], [(0, 1, 2, 3)])
        me.uv_layers.new(name='UV')
        me.materials.append(mat)
        ob = bpy.data.objects.new('Blob_' + bone, me)
        ob.location = (0, 0, 0.004)
        bpy.context.scene.collection.objects.link(ob)
        c = ob.constraints.new('COPY_LOCATION')
        c.target = arm
        c.subtarget = bone
        c.use_z = False
        ob.visible_shadow = False


# --------------------------------------------------------------------------- рамка кадра/камера
def sample_motion(arm, f0, f1, step):
    """Для выборки кадров: [(frame, hips_world, [точки суставов])]."""
    sc = bpy.context.scene
    mw = arm.matrix_world
    out = []
    f = f0
    names = [b.name for b in arm.pose.bones]
    while f <= f1:
        sc.frame_set(f)
        pts = []
        for n in names:
            pb = arm.pose.bones[n]
            pts.append(mw @ pb.head)
            pts.append(mw @ pb.tail)
        out.append((f, mw @ arm.pose.bones['Hips'].head, pts))
        f += step
    sc.frame_set(f0)
    return out


def gauss_smooth(vals, sigma):
    if sigma <= 0 or len(vals) < 3:
        return list(vals)
    rad = int(3 * sigma) + 1
    w = [math.exp(-0.5 * (i / sigma) ** 2) for i in range(-rad, rad + 1)]
    out = []
    for i in range(len(vals)):
        acc = tot = 0.0
        for j, wj in zip(range(i - rad, i + rad + 1), w):
            jj = min(max(j, 0), len(vals) - 1)
            acc += vals[jj] * wj
            tot += wj
        out.append(acc / tot)
    return out


def setup_camera(motion, az_deg, focal, cam_h, width, height, margin, follow, sample_step, fps):
    sc = bpy.context.scene
    cam_d = bpy.data.cameras.new('Camera')
    cam_d.lens = focal
    cam_d.sensor_width = 36.0
    cam_d.sensor_fit = 'HORIZONTAL'
    cam_d.clip_start, cam_d.clip_end = 0.1, 60
    cam_d.dof.use_dof = False
    cam = bpy.data.objects.new('Camera', cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    az = math.radians(az_deg)
    # камера на мировой +X (персонаж смотрит в +Y): окно в левой стене x<0 остаётся в кадре справа-вдали.
    # Горизонтальный взгляд (pitch=0, вертикали не заваливаются), кадрирование — lens shift.
    fwd_dir = Vector((-math.sin(az), -math.cos(az), 0))
    right = fwd_dir.cross(Vector((0, 0, 1))).normalized()
    cam.rotation_euler = Matrix((right, Vector((0, 0, 1)), -fwd_dir)).transposed().to_euler()
    allp = [p for _, _, pts in motion for p in pts]
    ctr = Vector(((min(p.x for p in allp) + max(p.x for p in allp)) / 2,
                  (min(p.y for p in allp) + max(p.y for p in allp)) / 2, 0))
    # плавное следование за корнем вдоль «правого» вектора камеры (доля follow, сглаживание ~1.2 с)
    lat = [h.dot(right) for _, h, _ in motion]
    lat_s = gauss_smooth(lat, 1.2 * fps / sample_step)
    mean_lat = sum(lat) / len(lat)
    offs = [follow * (v - mean_lat) for v in lat_s]
    aspect = height / width
    half = 18.0 / focal    # tan(hfov/2)

    def fit(dist):
        pos = ctr - fwd_dir * dist
        pos.z = cam_h
        us, vs = [], []
        for (_, _, pts), off in zip(motion, offs):
            for p in pts:
                d = p - pos
                depth = d.dot(fwd_dir)
                if depth < 0.2:
                    return None
                us.append((d.dot(right) - off) / depth / half)
                vs.append(d.z / depth / half)
        return pos, min(us), max(us), min(vs), max(vs)

    lo_d, hi_d = 1.0, 40.0
    for _ in range(30):
        mid = (lo_d + hi_d) / 2
        r = fit(mid)
        ok = False
        if r:
            _, u0, u1, v0, v1 = r
            ok = ((u1 - u0) / 2 <= 1 - margin) and ((v1 - v0) / 2 <= aspect * (1 - margin))
        if ok:
            hi_d = mid
        else:
            lo_d = mid
    pos, u0, u1, v0, v1 = fit(hi_d)
    cam.location = pos
    cam_d.shift_x = (u0 + u1) / 2 / 2
    cam_d.shift_y = (v0 + v1) / 2 / 2
    if follow > 0:
        for (f, _, _), off in zip(motion, offs):
            cam.location = pos + right * off
            cam.keyframe_insert('location', frame=f)
        cam.location = pos
        for fc in action_fcurves(cam.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    return cam, hi_d


# --------------------------------------------------------------------------- рендер-настройки
def setup_render(args):
    sc = bpy.context.scene
    r = sc.render
    r.resolution_x, r.resolution_y = args.width, args.height
    r.resolution_percentage = 100
    r.fps = args.fps
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGB'
    r.image_settings.compression = 15
    r.film_transparent = False
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'None'
    except Exception:
        pass
    if args.engine == 'EEVEE':
        r.engine = 'BLENDER_EEVEE'
        e = sc.eevee
        e.taa_render_samples = args.samples or 4
        e.use_shadows = args.quality != 'fast'
        e.use_raytracing = False
        e.use_fast_gi = False if hasattr(e, 'use_fast_gi') else None
        e.shadow_ray_count = 1
        e.shadow_step_count = 6
        e.gi_diffuse_bounces = 1
        e.use_volumetric_shadows = False
    elif args.engine == 'WORKBENCH':
        r.engine = 'BLENDER_WORKBENCH'
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'MATERIAL'
        sh.show_shadows = True
        sh.shadow_intensity = 0.4
        sh.use_dof = False
        sc.display.render_aa = str(args.samples or 8) if str(args.samples or 8) in ('OFF', '5', '8', '11', '16', '32') else '8'
    else:
        r.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = args.samples or 4
        sc.cycles.use_denoising = True
        sc.cycles.max_bounces = 4
        sc.cycles.use_adaptive_sampling = True


# --------------------------------------------------------------------------- main
def run_ffmpeg(frames_dir, frame_ids, out, fps, step, crf):
    # frames_dir содержит f_%06d.png по индексам кадров BVH; используем concat-список
    lst = os.path.join(frames_dir, 'list.txt')
    dur = step / fps
    with open(lst, 'w') as fh:
        for i in frame_ids:
            fh.write(f"file 'f_{i:06d}.png'\nduration {dur:.6f}\n")
        fh.write(f"file 'f_{frame_ids[-1]:06d}.png'\n")
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', f'fps={fps},format=yuv420p',
           '-frames:v', str(len(frame_ids) * step), '-c:v', 'libx264', '-crf', str(crf), '-preset', 'medium', '-movflags', '+faststart', '-an', out]
    subprocess.check_call(cmd)


def main():
    args = parse_args()
    t_start = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    arm = import_bvh(os.path.abspath(args.bvh))
    n_frames = bvh_frame_count(arm)         # импортёр: ключи на кадрах 1..N
    f_first = args.frame_start if args.frame_start is not None else 0
    f_last = args.frame_end if args.frame_end is not None else n_frames - 1
    f_last = min(f_last, n_frames - 1)
    step = max(1, args.frame_step)
    sc.frame_start, sc.frame_end = 1, n_frames
    print(f'BVH: {n_frames} кадров, кости: {len(arm.data.bones)}')

    build_mannequin(arm)
    build_studio()
    if args.engine == 'EEVEE' and args.quality == 'fast':
        add_blob_shadows(arm)
    # рамка по ВСЕМУ движению (а не только по рендеримому диапазону), чтобы кадр не прыгал
    sstep = max(1, n_frames // 300)
    motion = sample_motion(arm, 1, n_frames, sstep)
    cam, dist = setup_camera(motion, args.azimuth, args.focal, args.cam_height, args.width, args.height, args.margin,
                             args.follow, sstep, args.fps)
    pts = [p for _, _, ps in motion for p in ps]
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    print(f'bbox движения (Blender, м): x[{min(xs):.2f},{max(xs):.2f}] y[{min(ys):.2f},{max(ys):.2f}] '
          f'z[{min(zs):.2f},{max(zs):.2f}]; камера на расстоянии {dist:.2f} м, follow={args.follow}')
    setup_render(args)

    if args.save_blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.save_blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend), compress=True)
        print('saved', args.save_blend)

    if args.still:
        sc.frame_set(f_first + 1)
        sc.render.filepath = os.path.abspath(args.still)
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        dt = time.time() - t0
        print(f'STILL_TIME {dt:.2f} s (engine={args.engine}, {args.width}x{args.height}); '
              f'всего с загрузкой {time.time() - t_start:.1f} s')
        return

    if not args.out:
        return
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fdir = os.path.abspath(args.tmp_dir)
    os.makedirs(fdir, exist_ok=True)
    ids = list(range(f_first, f_last + 1, step))
    if not args.assemble_only:
        pk, pn = (int(x) for x in args.part.split('/'))
        todo = [i for j, i in enumerate(ids) if j % pn == pk]
        done = skipped = 0
        t0 = time.time()
        for i in todo:
            path = os.path.join(fdir, f'f_{i:06d}.png')
            if (not args.no_resume) and os.path.exists(path) and os.path.getsize(path) > 0:
                skipped += 1
                continue
            sc.frame_set(i + 1)
            sc.render.filepath = path + '.part.png'
            bpy.ops.render.render(write_still=True)
            os.replace(path + '.part.png', path)
            done += 1
            if done % 10 == 0 or done <= 3:
                el = time.time() - t0
                left = (len(todo) - skipped - done) * el / done
                print(f'[{pk}/{pn}] {done + skipped}/{len(todo)}  {el / done:.2f} с/кадр, осталось ~{left / 60:.1f} мин', flush=True)
        print(f'готово: отрендерено {done}, пропущено {skipped}')
        if pn > 1:
            print('--part: сборку mp4 выполните отдельным запуском с --assemble-only')
            return
    missing = [i for i in ids if not os.path.exists(os.path.join(fdir, f'f_{i:06d}.png'))]
    if missing:
        raise SystemExit(f'нет кадров для сборки: {len(missing)} шт., первый {missing[0]}')
    run_ffmpeg(fdir, ids, out, args.fps, step, args.crf)
    print('mp4:', out)


main()
