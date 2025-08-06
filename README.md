# Image Compression API - Docker Container

API de compresión de imágenes usando Sharp, optimizada para despliegue en fly.io.

## Características

- ✅ Compresión real PNG/JPEG → WebP grayscale
- ✅ Optimización iterativa de calidad para alcanzar ≤100KB (TARGET_SIZE configurable)
- ✅ Resize automático si es necesario
- ✅ OCR Enhancement con compresión inteligente
- ✅ Headers detallados con métricas de compresión
- ✅ Estadísticas de uso del servicio
- ✅ Listo para despliegue en fly.io

## Uso Local

### Construir y ejecutar el contenedor

```bash
# Limpiar contenedores existentes
docker stop compress-test 2>/dev/null || true && docker rm compress-test 2>/dev/null || true

# Construir y ejecutar
docker build -t compress-image:latest . && docker run -d -p 8080:8080 --name compress-test compress-image:latest

# Verificar que está funcionando
curl http://localhost:8080/
```

### Desarrollo sin Docker

```bash
npm install
node server.js
```

El servidor estará disponible en http://localhost:8080

## Endpoints

- `GET /` - Health check y documentación de la API
- `POST /` - Comprimir imagen básica (WebP grayscale, ≤100KB)
- `POST /upload-enhance` - Optimización para OCR (PNG optimizado para texto, ≤100KB)
- `GET /stats` - Estadísticas detalladas del servicio

## Ejemplos de uso

### Compresión básica

```bash
curl -X POST -H "Content-Type: image/png" --data-binary @imagen.png http://localhost:8080/ -o comprimida.webp
```

### Optimización para OCR

```bash
curl -X POST -H "Content-Type: image/jpeg" --data-binary @flyer.jpg http://localhost:8080/upload-enhance -o optimizada_ocr.png
```

### Respuesta

La API devuelve la imagen comprimida en formato WebP con los siguientes headers:

- `X-Original-Size` - Tamaño original en bytes
- `X-Compressed-Size` - Tamaño comprimido en bytes
- `X-Compression-Ratio` - Ratio de compresión (%)
- `X-Processing-Time` - Tiempo de procesamiento (ms)
- `X-Final-Quality` - Calidad final utilizada
- `X-Original-Format` - Formato original de la imagen

## Despliegue en fly.io

1. Instalar Flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. Iniciar sesión: `flyctl auth login`
3. Lanzar la aplicación: `flyctl launch`
4. Desplegar: `flyctl deploy`

## Tecnologías

- Node.js 20
- Express
- Sharp (procesamiento de imágenes)
- Docker Alpine
