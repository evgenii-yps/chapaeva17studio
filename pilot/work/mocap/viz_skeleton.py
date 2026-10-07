"""Контроль: скелет из *_joints.npz (вид спереди и сбоку) рядом с кадром исходника."""
import sys, numpy as np, cv2
npz, src, out = sys.argv[1:4]
times = [float(x) for x in sys.argv[4:]] or [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
J = np.load(npz)
BONES = [('Hips','Spine'),('Spine','Chest'),('Chest','Neck'),('Neck','Head'),('Head','Head_end'),
 ('Chest','LeftUpperArm'),('LeftUpperArm','LeftLowerArm'),('LeftLowerArm','LeftHand'),('LeftHand','LeftHand_end'),
 ('Chest','RightUpperArm'),('RightUpperArm','RightLowerArm'),('RightLowerArm','RightHand'),('RightHand','RightHand_end'),
 ('Hips','LeftUpperLeg'),('LeftUpperLeg','LeftLowerLeg'),('LeftLowerLeg','LeftFoot'),('LeftFoot','LeftToe'),('LeftToe','LeftToe_end'),
 ('Hips','RightUpperLeg'),('RightUpperLeg','RightLowerLeg'),('RightLowerLeg','RightFoot'),('RightFoot','RightToe'),('RightToe','RightToe_end')]
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
S = 360
tiles = []
for t in times:
    i = int(t * fps); cap.set(cv2.CAP_PROP_POS_FRAMES, i); ok, fr = cap.read()
    fr = cv2.resize(fr, (S, S))
    def draw(axis):  # axis 0: вид спереди (x,y), 1: сбоку (z,y)
        im = np.full((S, S, 3), 245, np.uint8)
        cv2.line(im, (0, int(S*0.9)), (S, int(S*0.9)), (150,150,150), 1)
        for a, b in BONES:
            def pt(k):
                p = J[k][i]
                u = p[0] if axis == 0 else p[2]
                return (int(S/2 + u*150), int(S*0.9 - p[1]*150))
            col = (200, 80, 40) if ('Left' in a or 'Left' in b) else ((40, 80, 200) if ('Right' in a or 'Right' in b) else (60, 60, 60))
            cv2.line(im, pt(a), pt(b), col, 3)
        cv2.putText(im, ('front x,y' if axis == 0 else 'side z,y'), (6, 18), 0, 0.5, (0,0,0), 1)
        return im
    row = np.hstack([fr, draw(0), draw(1)])
    cv2.putText(row, f"t={t}s", (6, S-8), 0, 0.6, (0,0,255), 2)
    tiles.append(row)
cols = 2
rows = [np.hstack(tiles[k:k+cols]) if len(tiles[k:k+cols]) == cols else np.hstack(tiles[k:k+cols] + [np.zeros_like(tiles[0])]) for k in range(0, len(tiles), cols)]
cv2.imwrite(out, np.vstack(rows[:3]))
