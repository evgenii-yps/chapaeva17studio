"""Сверка FK Blender (после импорта BVH) с целевыми позициями суставов npz: python -I check_fk.py BVH NPZ
Преобразование: Blender (x, y, z) = (-X_bvh, Z_bvh, Y_bvh)."""
import sys
import bpy
import numpy as np
bvh, npz = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_anim.bvh(filepath=bvh, axis_forward='Z', axis_up='Y', global_scale=1.0, frame_start=1,
                        use_fps_scale=False, update_scene_fps=False, update_scene_duration=True, rotate_mode='NATIVE')
arm = bpy.context.object
d = np.load(npz)
sc = bpy.context.scene
errs = {}
for f in range(0, d['Hips'].shape[0], 15):
    sc.frame_set(f + 1)
    for b in arm.pose.bones:
        if b.name not in d.files:
            continue
        p = arm.matrix_world @ b.head
        t = d[b.name][f]
        q = np.array([-t[0], t[2], t[1]])
        errs.setdefault(b.name, []).append(np.linalg.norm(np.array(p) - q))
print('max/mean ошибка FK, м (Blender vs npz) по суставам:')
for k, v in errs.items():
    print(f'  {k:14s} max {max(v):.4f}  mean {np.mean(v):.4f}')
allv = np.concatenate(list(errs.values()))
print('ВСЕГО: max %.4f mean %.4f' % (allv.max(), allv.mean()))
# высота подошвы (пол): мин. Z по Toe
zmin = min(min((arm.matrix_world @ arm.pose.bones[n].head).z for n in ('LeftToe', 'RightToe')) for f in [sc.frame_set(i) or i for i in range(1, 1666, 15)])
print('min Z Toe за всё движение (должно быть ~0):', round(zmin, 4))
