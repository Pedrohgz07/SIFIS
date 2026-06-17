import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from PIL import Image
from analyzer import analyze_image

app = Flask(__name__)

# ── Configuración ───────────────────────────────────────────────────────────
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB máximo
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


# ── Funciones auxiliares ────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Rutas ───────────────────────────────────────────────────────────────────

@app.route("/")
def inicio():
    return render_template("inicio.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


@app.route("/analizar", methods=["POST"])
def analizar():
    # Validar que venga un archivo
    if "imagen" not in request.files:
        return jsonify({"error": "No se recibió ninguna imagen"}), 400

    file = request.files["imagen"]

    if file.filename == "":
        return jsonify({"error": "Archivo vacío"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Formato no permitido. Usa JPG, PNG o WEBP"}), 400

    try:
        img = Image.open(file.stream)
        resultado = analyze_image(img)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": f"Error al procesar la imagen: {str(e)}"}), 500


@app.route("/como-funciona")
def como_funciona():
    return render_template("como-funciona.html")


@app.route("/acerca")
def acerca():
    return render_template("acerca.html")


# ── Arranque ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)