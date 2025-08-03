#!/bin/sh

# Test script para verificar el funcionamiento del API de compresión en fly.io
# Uso: ./test.sh [URL_BASE]
# Ejemplo: ./test.sh https://compress-image.fly.dev

URL_BASE=${1:-http://localhost:8080}
IMAGEN_TEST="../ima.png"
IMAGEN_SALIDA="imagen_comprimida_test.webp"

echo "🔍 Probando API de compresión en: $URL_BASE"

# Verificar imagen de prueba
if [ ! -f "$IMAGEN_TEST" ]; then
  echo "❌ Error: Imagen de prueba no encontrada en $IMAGEN_TEST"
  exit 1
fi

# Probar el endpoint de estado
echo "\n📡 Verificando endpoint de estado..."
curl -s "$URL_BASE/" | json_pp

# Probar la compresión
echo "\n🖼️  Enviando imagen para compresión..."
curl -X POST -H "Content-Type: image/png" --data-binary @"$IMAGEN_TEST" "$URL_BASE/" -o "$IMAGEN_SALIDA" -v

# Verificar resultado
if [ -f "$IMAGEN_SALIDA" ]; then
  ORIGINAL_SIZE=$(wc -c < "$IMAGEN_TEST")
  COMPRESSED_SIZE=$(wc -c < "$IMAGEN_SALIDA")
  RATIO=$(echo "scale=2; (1 - $COMPRESSED_SIZE / $ORIGINAL_SIZE) * 100" | bc)
  
  echo "\n✅ Compresión completada:"
  echo "   - Tamaño original: $ORIGINAL_SIZE bytes"
  echo "   - Tamaño comprimido: $COMPRESSED_SIZE bytes"
  echo "   - Ratio de compresión: $RATIO%"
else
  echo "\n❌ Error: No se generó la imagen comprimida"
fi

echo "\n📊 Verificando estadísticas del servicio..."
curl -s "$URL_BASE/stats" | json_pp
