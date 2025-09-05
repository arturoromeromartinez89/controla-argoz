# CONTROL-A v1.8 — argozmx (estructura Vercel)

Esta carpeta está lista para desplegar en **Vercel**.

## Estructura
```
/public
  └── index.html   # pega aquí tu ERP completo
vercel.json        # indica a Vercel servir desde /public
README.md          # esta guía
ARGOZ_prompt_maestro.txt  # prompt maestro para el nuevo chat (desarrollador)
```

## Despliegue rápido
1. Abre https://vercel.com/new
2. Arrastra la carpeta raíz (donde está este README) y suelta en Vercel.
3. Framework: *Other*, Build Command vacío, Output Dir vacío (Vercel detecta /public).
4. Presiona **Deploy**.

> Para actualizar: vuelve a arrastrar la carpeta con tus cambios a **New Deployment** del proyecto.

---

### Notas
- Si ya tienes tu `index.html` completo del ERP, **reemplaza** `public/index.html` con tu contenido.
- Puedes agregar más archivos (imágenes, íconos) dentro de `/public`.
