import time
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
import tensorflow as tf
from io import BytesIO
import base64

MODEL_PATH = "model/modelo_ai_vs_real.keras"
model = tf.keras.models.load_model(MODEL_PATH)

THRESHOLD = 0.60
THRESHOLD_MARGIN = 0.15
ELA_THRESHOLD = 20.0

ELA_THRESHOLDS = {
    "JPEG": 20.0,
    "PNG":  12.0,
    "WEBP": 14.0,
}


def ela_analysis(img: Image.Image, quality: int = 90) -> tuple[float, int, str]:
    img_rgb = img.convert("RGB")
    fmt = (img.format or "JPEG").upper()

    if fmt in ("PNG", "WEBP"):
        buffer_jpeg = BytesIO()
        img_rgb.save(buffer_jpeg, format="JPEG", quality=75)
        buffer_jpeg.seek(0)
        img_base = Image.open(buffer_jpeg).convert("RGB")

        buffer2 = BytesIO()
        img_base.save(buffer2, format="JPEG", quality=quality)
        buffer2.seek(0)
        img_compressed = Image.open(buffer2).convert("RGB")

        diff = ImageChops.difference(img_base, img_compressed)
        anomaly_threshold = 15
        amplifier = 1.2
    else:
        buffer = BytesIO()
        img_rgb.save(buffer, format="JPEG", quality=quality)
        buffer.seek(0)
        img_compressed = Image.open(buffer).convert("RGB")

        diff = ImageChops.difference(img_rgb, img_compressed)
        anomaly_threshold = 25
        amplifier = 1.0

    diff_array = np.array(diff).astype(np.float32) * amplifier
    ela_score = float(np.mean(diff_array))
    anomaly_count = int(np.sum(diff_array > anomaly_threshold))

    # Generar imagen ELA amplificada para visualización
    ela_visual = np.clip(diff_array * 10, 0, 255).astype(np.uint8)
    ela_pil = Image.fromarray(ela_visual)
    buffer_out = BytesIO()
    ela_pil.save(buffer_out, format="PNG")
    ela_b64 = base64.b64encode(buffer_out.getvalue()).decode("utf-8")

    return round(ela_score, 2), anomaly_count, ela_b64


def preprocess_image(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB").resize((224, 224))

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    buffer.seek(0)
    img = Image.open(buffer).convert("RGB")

    img_array = np.array(img, dtype=np.float32)

    return np.expand_dims(img_array, axis=0)


def analyze_image(img: Image.Image) -> dict:
    start = time.time()

    ela_score, anomaly_count, ela_imagen = ela_analysis(img)

    img_array = preprocess_image(img)
    prediction = float(model.predict(img_array, verbose=0)[0][0])

    fmt = (img.format or "JPEG").upper()
    ela_threshold = ELA_THRESHOLDS.get(fmt, ELA_THRESHOLD)

    if prediction < (THRESHOLD + THRESHOLD_MARGIN) and ela_score < ela_threshold:
        is_ai = False
        confidence = 70.0 + (ela_threshold - ela_score) * 1.5
        confidence = min(confidence, 99.0)

    elif prediction >= THRESHOLD:
        is_ai = True
        confidence = prediction * 100

    else:
        is_ai = False
        confidence = (1.0 - prediction) * 100

    confidence = round(confidence, 1)
    elapsed = round(time.time() - start, 2)

    return {
        "prediccion": "IA" if is_ai else "REAL",
        "confianza": confidence,
        "prediccion_cruda": round(prediction, 4),
        "ela_score": ela_score,
        "anomalias": anomaly_count,
        "tiempo": elapsed,
        "ela_imagen": ela_imagen,
    }


def analyze_image_simple(img: Image.Image) -> dict:
    start = time.time()

    img_array = preprocess_image(img)
    prediction = float(model.predict(img_array, verbose=0)[0][0])

    is_ai = prediction >= THRESHOLD
    confidence = prediction if is_ai else 1.0 - prediction

    elapsed = round(time.time() - start, 2)

    return {
        "prediccion": "IA" if is_ai else "REAL",
        "confianza": round(confidence * 100, 1),
        "prediccion_cruda": round(prediction, 4),
        "tiempo": elapsed,
    }