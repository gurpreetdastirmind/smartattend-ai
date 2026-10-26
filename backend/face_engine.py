import cv2 as cv
import numpy as np
import os

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
DET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
REC_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

_detector = None
_recognizer = None
MODEL_VERSION = "sface-2021dec"

def load_models():
    global _detector, _recognizer
    if not (os.path.exists(DET_PATH) and os.path.exists(REC_PATH)):
        raise FileNotFoundError(
            f"ONNX models missing. Place them in {MODELS_DIR}"
        )
    _detector = cv.FaceDetectorYN.create(DET_PATH, "", (320, 320),
                                         score_threshold=0.85,
                                         nms_threshold=0.3, top_k=5000)
    _recognizer = cv.FaceRecognizerSF.create(REC_PATH, "")

def detect_embeddings(bgr):
    if _detector is None:
        load_models()
    h, w = bgr.shape[:2]
    _detector.setInputSize((w, h))
    _, faces = _detector.detect(bgr)
    results = []
    if faces is None:
        return results
    for face in faces:
        aligned = _recognizer.alignCrop(bgr, face)
        emb = _recognizer.feature(aligned).astype(np.float32).ravel()
        n = max(float(np.linalg.norm(emb)), 1e-12)
        emb = emb / n
        x, y, fw, fh = face[:4].astype(int)
        results.append({
            "embedding": emb,
            "box": (int(x), int(y), int(fw), int(fh)),
            "score": float(face[14]),
        })
    return results

def detect_count(bgr):
    return len(detect_embeddings(bgr))

def annotate(bgr, faces, suggestions):
    """Draw boxes + labels, returns BGR image."""
    out = bgr.copy()
    for i, (f, sug) in enumerate(zip(faces, suggestions), start=1):
        x, y, w, h = f["box"]
        color = (0, 200, 0) if sug["label"] == "SUGGEST_PRESENT" else (0, 165, 255)
        cv.rectangle(out, (x, y), (x + w, y + h), color, 2)
        label = f"#{i} {sug.get('name') or sug['label']} ({sug.get('score', 0):.2f})"
        cv.putText(out, label, (x, max(20, y - 8)),
                   cv.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
    return out

def decode_image(data: bytes):
    arr = np.frombuffer(data, np.uint8)
    return cv.imdecode(arr, cv.IMREAD_COLOR)