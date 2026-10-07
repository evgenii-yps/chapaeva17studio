"""Метод A: MediaPipe PoseLandmarker (heavy) -> npz с 2D/3D-ландмарками по кадрам."""
import sys, numpy as np, cv2, time
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

src, model, out = sys.argv[1:4]
opts = vision.PoseLandmarkerOptions(
    base_options=mpp.BaseOptions(model_asset_path=model),
    running_mode=vision.RunningMode.VIDEO, num_poses=1,
    min_pose_detection_confidence=0.4, min_pose_presence_confidence=0.4, min_tracking_confidence=0.4)
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
img_l = np.full((n, 33, 4), np.nan, np.float32)   # x,y (норм.), z, visibility
wrl = np.full((n, 33, 4), np.nan, np.float32)     # метры, ориг. система MediaPipe; vis, pres
det = np.zeros(n, bool)
t0 = time.time()
with vision.PoseLandmarker.create_from_options(opts) as lm:
    for i in range(n):
        ok, bgr = cap.read()
        if not ok: break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(i * 1000 / fps))
        if res.pose_landmarks:
            det[i] = True
            img_l[i] = [[p.x, p.y, p.z, p.visibility] for p in res.pose_landmarks[0]]
            wrl[i] = [[p.x, p.y, p.z, p.visibility] for p in res.pose_world_landmarks[0]]
        if i % 200 == 0: print(i, n, f"{time.time()-t0:.0f}s", flush=True)
np.savez_compressed(out, img=img_l, world=wrl, det=det, fps=fps)
print("done", det.mean(), f"{time.time()-t0:.0f}s")
