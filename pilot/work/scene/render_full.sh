#!/bin/bash
# Полный рендер видео персонажа без звука: 4 параллельных процесса (по 1 потоку llvmpipe) + сборка mp4.
# Использование: work/scene/render_full.sh [BVH] [OUT.mp4] [доп. аргументы build_scene.py]
# Возобновляется: уже готовые PNG в work/scene/_tmp_frames/ пропускаются (повторный запуск продолжит).
cd "$(dirname "$0")/../.." || exit 1
BVH=${1:-work/mocap/mocap_final.bvh}
OUT=${2:-work/scene/character.mp4}
shift 2 2>/dev/null
N=${SHARDS:-4}
mkdir -p work/scene/_tmp_logs
ARGS="--bvh $BVH --out $OUT --samples ${SAMPLES:-3} --quality ${QUALITY:-fast} $*"
for k in $(seq 0 $((N-1))); do
  LP_NUM_THREADS=1 /opt/pv/bin/python -I work/scene/build_scene.py $ARGS --part $k/$N > work/scene/_tmp_logs/render_$k.log 2>&1 &
done
wait
/opt/pv/bin/python -I work/scene/build_scene.py $ARGS --assemble-only 2>&1 | grep -v EGL
