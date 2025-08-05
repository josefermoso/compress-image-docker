# CLAUDE.md

Este archivo proporciona guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

## Visión General del Proyecto

Este es un servicio de compresión de imágenes Docker containerizado que utiliza Sharp para procesamiento de imágenes, optimizado para despliegue en fly.io. Es parte del sistema de OCR de flyers para reducir el tamaño de imágenes antes del procesamiento.

## Comandos de Desarrollo

### Flujo de Trabajo Principal
- `docker build -t compress-image:latest .` - Construir la imagen Docker
- `docker run -p 8080:8080 compress-image:latest` - Ejecutar el contenedor localmente
- `./test.sh` - Ejecutar script de prueba con imagen de ejemplo

### Despliegue en Fly.io
- `flyctl auth login` - Autenticarse con Fly.io
- `flyctl launch` - Lanzar nueva aplicación
- `flyctl deploy` - Desplegar cambios
- `flyctl logs` - Ver logs en tiempo real

### Desarrollo Local
- `npm install` - Instalar dependencias
- `node server.js` - Ejecutar servidor localmente (sin Docker)

## Arquitectura del Servicio

### Componentes Clave
- `server.js` - Servidor Express principal con endpoints de compresión
- `Dockerfile` - Configuración de contenedor Alpine optimizada
- `fly.toml` - Configuración de despliegue para Fly.io

### Flujo de Procesamiento
1. **Recepción de Imagen**: Acepta datos binarios RAW via POST /
2. **Detección de Formato**: Analiza Content-Type para determinar formato original
3. **Compresión Iterativa**: Ajusta calidad desde 80% hasta alcanzar ≤300KB
4. **Conversión a WebP Grayscale**: Formato optimizado para OCR
5. **Resize si es Necesario**: Reduce dimensiones si aún excede 300KB
6. **Retorna Imagen Comprimida**: Con headers de métricas detalladas

## Endpoints de la API

### POST / - Comprimir Imagen
- **Input**: Datos binarios de imagen (PNG, JPEG, WebP, GIF, AVIF)
- **Output**: Imagen comprimida en formato WebP grayscale
- **Headers de Respuesta**:
  - `Content-Type: image/webp`
  - `X-Original-Size` - Tamaño original en bytes
  - `X-Compressed-Size` - Tamaño comprimido en bytes
  - `X-Compression-Ratio` - Ratio de compresión (%)
  - `X-Processing-Time` - Tiempo de procesamiento (ms)
  - `X-Final-Quality` - Calidad final utilizada
  - `X-Original-Format` - Formato original de la imagen

### GET / - Health Check
- **Output**: JSON con información del servicio, endpoints disponibles y tecnologías

### GET /stats - Estadísticas del Servicio
- **Output**: Métricas de uso incluyendo:
  - `requestsProcessed` - Total de requests procesados
  - `imagesCompressed` - Total de imágenes comprimidas
  - `bytesSaved` - Total de bytes ahorrados
  - `averageCompressionRatio` - Ratio promedio de compresión
  - `processingErrors` - Total de errores
  - `uptime` - Tiempo activo del servicio

## Configuración

### Variables de Entorno
- `PORT` - Puerto del servidor (default: 8080)

### Constantes de Configuración
- `MAX_FILE_SIZE` - Tamaño máximo de archivo: 50MB
- `TARGET_SIZE` - Tamaño objetivo de compresión: 300KB
- `qualities` - Niveles de calidad: [80, 60, 40, 20, 10]
- `resizeFactors` - Factores de redimensionamiento: [0.9, 0.8, 0.7, 0.6, 0.5]

### Optimizaciones Sharp
- `effort: 6` - Máximo esfuerzo de compresión WebP
- `smartSubsample: true` - Submuestreo inteligente
- `reductionEffort: 6` - Máximo esfuerzo de reducción
- `kernel: lanczos3` - Kernel de redimensionamiento de alta calidad

## Ejemplo de Uso

```bash
# Comprimir imagen local
curl -X POST \
  -H "Content-Type: image/png" \
  --data-binary @imagen.png \
  http://localhost:8080/ \
  -o imagen_comprimida.webp

# Verificar estadísticas
curl http://localhost:8080/stats

# Health check
curl http://localhost:8080/
```

## Integración con Sistema Principal

Este servicio está diseñado para integrarse con el sistema de OCR de flyers (`flyers-api`):

1. **ImageProcessor** en `flyers-api/src/services/imageProcessor.ts` puede usar este endpoint
2. Las imágenes se comprimen a WebP grayscale optimizado para OCR
3. Los headers de respuesta proporcionan métricas para logging y monitoreo
4. El formato WebP resultante es compatible con los modelos de AI de Cloudflare

## Tecnologías

- **Node.js 20** - Runtime
- **Express** - Framework web
- **Sharp** - Procesamiento de imágenes con libvips
- **Docker Alpine** - Contenedor ligero
- **Fly.io** - Plataforma de despliegue

## Notas de Desarrollo

### Manejo de Errores
- Validación de datos de entrada
- Logging detallado de errores Sharp
- Estadísticas de errores para monitoreo
- Respuestas HTTP apropiadas

### Optimización de Performance
- Middleware de compresión gzip
- Cache headers para imágenes procesadas
- Procesamiento en memoria sin archivos temporales
- Configuración Sharp optimizada para velocidad

### Logging
- Morgan middleware para logs de requests
- Console logs detallados del proceso de compresión
- Métricas de performance y tamaños

## Problemas Comunes

### Errores de Memoria
Si procesas imágenes muy grandes, considera ajustar:
- `MAX_FILE_SIZE` - Reducir límite de tamaño
- Limits de memoria en `fly.toml`

### Timeouts
Para imágenes complejas que tardan mucho:
- Ajustar timeout en el reverse proxy
- Considerar procesamiento asíncrono para casos extremos

### Calidad de Compresión
Si la calidad es insuficiente para OCR:
- Ajustar array `qualities` para probar niveles más altos primero
- Modificar `TARGET_SIZE` si es necesario
- Revisar configuración Sharp para balance calidad/tamaño