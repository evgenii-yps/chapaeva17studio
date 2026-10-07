# Лицензии ассетов и инструментов

| Что | Источник | Лицензия | Коммерческое использование | Заметка |
|---|---|---|---|---|
| Исходное видео (цигун) | заказчик (чужой автор) | права автора ролика | **НЕТ — только внутренний тест пилота** | В кадре логотип «exhale» и титр «Цигун». Ограничение вынесено в REPORT.md. В продукцию не идёт |
| MediaPipe (код) | PyPI `mediapipe` | Apache-2.0 | да | |
| MediaPipe Pose Landmarker heavy (веса) | storage.googleapis.com/mediapipe-models | Apache-2.0 (по model card) `[ПРЕДПОЛОЖЕНИЕ: проверить model card перед продакшном]` | да | |
| bpy / Blender | PyPI `bpy` | GPL-3.0 (код Blender); результаты рендера свободны | да (рендеры не наследуют GPL) | |
| FFmpeg | системный пакет | LGPL/GPL (по сборке) | да как инструмент | |
| PySceneDetect | PyPI | BSD-3 | да | |
| yt-dlp, SciPy, NumPy, OpenCV | PyPI | Unlicense / BSD / Apache-2 | да | |
| faster-whisper | PyPI (код MIT) | MIT; веса не загружены | — | не использовалось (нет весов) |
| Метод B (WHAM/4D-Humans/HMR2, SMPL/SMPL-X) | не использовался | модели SMPL — **некоммерческая** лицензия MPI; HMR2/WHAM — также исследовательские | **риск для продакшна** | зафиксировано как риск; в пилоте не применялось |
| Silero TTS | не использовался | CC BY-NC (модели) / MIT (код) `[ПРЕДПОЛОЖЕНИЕ]` | риск: NC | не применялось |
| 3D-манекен, студия, материалы, текстура пола (этап 4) | `work/scene/build_scene.py` (процедурно в bpy) | CC0 по авторству (создано в рамках пилота, внешних ассетов/HDRI/текстур нет) | да | |
| Mesa llvmpipe/EGL (apt: libegl1, libegl-mesa0, libgl1-mesa-dri) | apt Ubuntu | MIT и др. permissive | да (только инструмент рендера) | требуется для EEVEE без GPU |
