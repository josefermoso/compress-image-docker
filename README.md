# Image Compression API - Docker Container

API de compresión de imágenes usando Sharp, optimizada para despliegue en fly.io.

## Características

- ✅ Compresión real PNG/JPEG → WebP grayscale
- ✅ Optimización iterativa de calidad para alcanzar ≤300KB
- ✅ Resize automático si es necesario
- ✅ Headers detallados con métricas de compresión
- ✅ Estadísticas de uso del servicio
- ✅ Listo para despliegue en fly.io

## Uso Local

### Construir la imagen Docker

```bash
docker build -t compress-image:latest .
```

### Ejecutar el contenedor

```bash
docker run -p 8080:8080 compress-image:latest
```

El servidor estará disponible en http://localhost:8080

## Endpoints

- `GET /` - Health check y documentación
- `POST /` - Comprimir imagen (enviar datos binarios directamente)
- `GET /stats` - Estadísticas del servicio

## Ejemplo de uso

### Usando curl

```bash
curl -X POST -H "Content-Type: image/png" --data-binary @ruta/a/imagen.png http://localhost:8080/ -o imagen_comprimida.webp
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
