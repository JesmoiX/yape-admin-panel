# 🚀 Cómo publicar tu Panel Web en GitHub Pages

¡Sí! Puedes subir tu sistema a GitHub y verlo online totalmente **GRATIS** usando **GitHub Pages**. Como tu proyecto usa solo HTML, CSS y JS (conectado a Firebase), es perfecto para esto.

## Pasos para subirlo

### 1. Preparar el Repositorio
Abre tu terminal en la carpeta `YapeAdminPanel` y ejecuta:

```bash
git init
git add .
git commit -m "Mi primer deploy del Panel Yape"
```

### 2. Crear Repositorio en GitHub
1. Ve a [GitHub.com](https://github.com) y crea un **New Repository**.
2. Ponle un nombre (ej: `yape-admin-panel`).
3. **IMPORTANTE:** Déjalo como **Public** (si quieres usar Pages gratis) o Private (si tienes cuenta Pro).
4. Copia las líneas que te da GitHub para "push an existing repository". Se verán algo así:

```bash
git remote add origin https://github.com/TU_USUARIO/yape-admin-panel.git
git branch -M main
git push -u origin main
```

### 3. Activar GitHub Pages
1. Ve a la pestaña **Settings** de tu repositorio en GitHub.
2. En el menú de la izquierda, busca **Pages**.
3. En **Build and deployment** > **Branch**, selecciona `main` y la carpeta `/ (root)`.
4. Dale clic a **Save**.
5. Espera unos segundos y refresca la página. Verás un link arriba que dice:
   `Your site is live at https://tu-usuario.github.io/yape-admin-panel/`

## ⚠️ Consideraciones de Seguridad
Como es un proyecto web cliente (frontend), tus credenciales de Firebase (`apiKey`, etc.) quedarán visibles en el código (`js/firebase-config.js`).

*   **¿Es grave?** No necesariamente. Firebase está diseñado para esto.
*   **Lo que DEBES hacer:** Ve a la [Consola de Firebase](https://console.firebase.google.com/) > **Project Settings** > **General** y asegura tus "Reglas de Seguridad" (Security Rules) en la base de datos para que solo usuarios autenticados puedan leer/escribir.
*   **Restringir API Key:** En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), busca tu API Key y ponle una restricción "HTTP Referrer" para que solo acepte peticiones desde tu dominio de GitHub (ej: `https://jesmoi.github.io/*`).

¡Y listo! Tendrás tu panel accesible desde cualquier lugar. 🌍
